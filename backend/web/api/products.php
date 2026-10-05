<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

$database = new Database();
$conn = $database->getConnection();
$action = $_GET['action'] ?? 'list';
$data = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'categories') {
            $stmt = $conn->query("SELECT DISTINCT category FROM products WHERE UPPER(status) <> 'INACTIVE' ORDER BY category");
            Response::json($stmt->fetchAll(PDO::FETCH_COLUMN));
        }

        $stmt = $conn->query(
            "SELECT p.product_id, p.name, p.category, p.srp, p.base_cost,
                    p.stock_quantity, p.stock_baseline, p.expiration_date,
                    p.low_stock_alert_level, p.description,
                    COALESCE(SUM(s.quantity), 0) AS sold
             FROM products p
             LEFT JOIN sales s ON s.product_id = p.product_id
             WHERE UPPER(p.status) <> 'INACTIVE'
             GROUP BY p.product_id
             ORDER BY p.name"
        );
        $products = $stmt->fetchAll();
        $batchStmt = $conn->query(
            "SELECT product_id, expiry_date, quantity, added_at
             FROM product_expiry_batches
             ORDER BY expiry_date, added_at"
        );
        $batches = [];
        foreach ($batchStmt->fetchAll() as $batch) {
            $batches[$batch['product_id']][] = [
                'expiry' => $batch['expiry_date'],
                'qty' => (int)$batch['quantity'],
                'addedAt' => $batch['added_at']
            ];
        }

        foreach ($products as &$product) {
            $product['id'] = (int)$product['product_id'];
            $product['price'] = (float)$product['srp'];
            $product['cost'] = (float)$product['base_cost'];
            $product['stock'] = (int)$product['stock_quantity'];
            $product['stockBaseline'] = (int)$product['stock_baseline'];
            $product['expiry'] = $product['expiration_date'] ?? '';
            $product['expiryBatches'] = $batches[$product['product_id']] ?? [];
            $product['lowStockAlertLevel'] = (int)$product['low_stock_alert_level'];
            $product['sold'] = (int)$product['sold'];
        }
        unset($product);
        Response::json($products);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Response::error('Method not allowed', 405);
    }

    if ($action === 'add') {
        $name = trim((string)($data['name'] ?? ''));
        $category = trim((string)($data['category'] ?? ''));
        $stock = filter_var($data['stock'] ?? null, FILTER_VALIDATE_INT);
        $price = filter_var($data['price'] ?? null, FILTER_VALIDATE_FLOAT);
        $cost = filter_var($data['cost'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($name === '' || $category === '' || $stock === false || $stock < 0 || $price === false || $price < 0 || $cost === false || $cost < 0) {
            Response::error('Valid name, category, stock, and prices are required', 400);
        }

        $conn->beginTransaction();
        $stmt = $conn->prepare(
            "INSERT INTO products (name, category, srp, base_cost, stock_quantity, stock_baseline, expiration_date, description, status)
             VALUES (:name, :category, :price, :cost, :stock, :stock, :expiry, :description, 'ACTIVE')
             RETURNING product_id"
        );
        $expiry = trim((string)($data['expiry'] ?? ''));
        $stmt->execute([
            'name' => $name,
            'category' => $category,
            'price' => $price,
            'cost' => $cost,
            'stock' => $stock,
            'expiry' => $expiry !== '' ? $expiry : null,
            'description' => trim((string)($data['description'] ?? ''))
        ]);
        $productId = (int)$stmt->fetchColumn();

        if ($expiry !== '' && $stock > 0) {
            $stmt = $conn->prepare(
                "INSERT INTO product_expiry_batches (product_id, expiry_date, quantity)
                 VALUES (?, ?, ?)"
            );
            $stmt->execute([$productId, $expiry, $stock]);
        }
        $stmt = $conn->prepare(
            "INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, unit_cost, notes)
             VALUES (?, ?, 'PRODUCT ADD', ?, ?, 'Product added to inventory.')"
        );
        $stmt->execute([$productId, $name, $stock, $cost]);
        $conn->commit();
        Response::success('Product added', ['product_id' => $productId]);
    }

    if ($action === 'stock') {
        $productId = filter_var($data['product_id'] ?? null, FILTER_VALIDATE_INT);
        $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_INT);
        $type = $data['type'] ?? '';
        if (!$productId || !$quantity || $quantity < 1 || !in_array($type, ['STOCK IN', 'STOCK OUT'], true)) {
            Response::error('Valid product, quantity, and stock movement type are required', 400);
        }

        $conn->beginTransaction();
        $stmt = $conn->prepare("SELECT * FROM products WHERE product_id = ? AND UPPER(status) <> 'INACTIVE' FOR UPDATE");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            throw new Exception('Product not found');
        }

        $oldStock = (int)$product['stock_quantity'];
        if ($type === 'STOCK OUT' && $quantity > $oldStock) {
            $conn->rollBack();
            Response::error('Stock out quantity exceeds available stock', 400);
        }
        $newStock = $type === 'STOCK IN' ? $oldStock + $quantity : $oldStock - $quantity;
        $baseline = $type === 'STOCK IN' ? $newStock : (int)$product['stock_baseline'];
        $stmt = $conn->prepare(
            "UPDATE products SET stock_quantity = ?, stock_baseline = ? WHERE product_id = ?"
        );
        $stmt->execute([$newStock, $baseline, $productId]);

        if ($type === 'STOCK IN' && !empty($data['expiry'])) {
            $stmt = $conn->prepare(
                "INSERT INTO product_expiry_batches (product_id, expiry_date, quantity)
                 VALUES (?, ?, ?)
                 ON CONFLICT (product_id, expiry_date)
                 DO UPDATE SET quantity = product_expiry_batches.quantity + EXCLUDED.quantity"
            );
            $stmt->execute([$productId, $data['expiry'], $quantity]);
        } elseif ($type === 'STOCK OUT') {
            consumeExpiryStock($conn, $productId, $quantity);
        }

        $stmt = $conn->prepare(
            "UPDATE products
             SET expiration_date = (
                 SELECT MIN(expiry_date) FROM product_expiry_batches WHERE product_id = ?
             )
             WHERE product_id = ?"
        );
        $stmt->execute([$productId, $productId]);
        $stmt = $conn->prepare(
            "INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, unit_cost, reference, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $productId,
            $product['name'],
            $type,
            $quantity,
            (float)$product['base_cost'],
            trim((string)($data['reference'] ?? '')),
            trim((string)($data['notes'] ?? ''))
        ]);
        $conn->commit();
        Response::success('Stock updated');
    }

    if ($action === 'delete') {
        $productId = filter_var($data['product_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$productId) {
            Response::error('A valid product is required', 400);
        }
        $conn->beginTransaction();
        $stmt = $conn->prepare("SELECT name, stock_quantity, base_cost FROM products WHERE product_id = ? AND UPPER(status) <> 'INACTIVE' FOR UPDATE");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            throw new Exception('Product not found');
        }
        $stmt = $conn->prepare("UPDATE products SET status = 'INACTIVE' WHERE product_id = ?");
        $stmt->execute([$productId]);
        $stmt = $conn->prepare(
            "INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, unit_cost, notes)
             VALUES (?, ?, 'PRODUCT DELETE', ?, ?, 'Product removed from inventory.')"
        );
        $stmt->execute([$productId, $product['name'], $product['stock_quantity'], $product['base_cost']]);
        $conn->commit();
        Response::success('Product removed');
    }

    Response::error('Unknown product action', 400);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    Response::error($e->getMessage());
}

function consumeExpiryStock(PDO $conn, int $productId, int $quantity): void
{
    $stmt = $conn->prepare(
        "SELECT batch_id, quantity FROM product_expiry_batches
         WHERE product_id = ? ORDER BY expiry_date, added_at FOR UPDATE"
    );
    $stmt->execute([$productId]);
    $remaining = $quantity;
    foreach ($stmt->fetchAll() as $batch) {
        if ($remaining === 0) {
            break;
        }
        $taken = min($remaining, (int)$batch['quantity']);
        $remaining -= $taken;
        if ($taken === (int)$batch['quantity']) {
            $delete = $conn->prepare("DELETE FROM product_expiry_batches WHERE batch_id = ?");
            $delete->execute([$batch['batch_id']]);
        } else {
            $update = $conn->prepare("UPDATE product_expiry_batches SET quantity = quantity - ? WHERE batch_id = ?");
            $update->execute([$taken, $batch['batch_id']]);
        }
    }
}
