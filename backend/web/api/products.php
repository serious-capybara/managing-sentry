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
            $stmt = $conn->query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC");
            Response::json($stmt->fetchAll(PDO::FETCH_COLUMN));
        }

        $stmt = $conn->query(
            "SELECT p.product_id, p.name, p.category, p.base_cost, p.markup_amount,
                    p.retail_price, p.stock_quantity, p.expiration_date,
                    p.low_stock_alert_level,
<<<<<<< HEAD
                    COALESCE(SUM(oi.quantity), 0) AS sold
=======
                    COALESCE(SUM(oi.quantity), 0) AS sold,
                    COALESCE(SUM(oi.quantity * oi.price_snapshot), 0) AS sold_revenue,
                    COALESCE(SUM(oi.quantity * oi.cost_snapshot), 0) AS sold_cogs
>>>>>>> Clary
             FROM products p
             LEFT JOIN order_items oi ON oi.product_id = p.product_id
             GROUP BY p.product_id, p.name, p.category, p.base_cost, p.markup_amount,
                      p.retail_price, p.stock_quantity, p.expiration_date, p.low_stock_alert_level
             ORDER BY p.name ASC"
        );
        $products = $stmt->fetchAll();

        foreach ($products as &$product) {
            $product['product_id'] = (int)$product['product_id'];
            $product['id'] = (int)$product['product_id'];
            $product['base_cost'] = (float)$product['base_cost'];
            $product['cost'] = (float)$product['base_cost'];
            $product['markup_amount'] = (float)$product['markup_amount'];
            $product['retail_price'] = (float)$product['retail_price'];
            $product['price'] = (float)$product['retail_price'];
            $product['srp'] = (float)$product['retail_price'];
            $product['stock_quantity'] = (int)$product['stock_quantity'];
            $product['stock'] = (int)$product['stock_quantity'];
            $product['stockBaseline'] = (int)$product['stock_quantity'];
            $product['expiration_date'] = $product['expiration_date'] ?? null;
            $product['expiry'] = $product['expiration_date'] ?? '';
            $product['expiryBatches'] = $product['expiration_date'] ? [[
                'expiry' => $product['expiration_date'],
                'qty' => (int)$product['stock_quantity'],
                'addedAt' => date('c')
            ]] : [];
            $product['low_stock_alert_level'] = (int)($product['low_stock_alert_level'] ?? 20);
            $product['lowStockAlertLevel'] = (int)($product['low_stock_alert_level'] ?? 20);
            $product['sold'] = (int)$product['sold'];
            $product['sold_revenue'] = (float)$product['sold_revenue'];
            $product['sold_cogs'] = (float)$product['sold_cogs'];
        }
        unset($product);
        Response::json($products);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Response::error('Method not allowed', 405);
    }

    $userId = $_SESSION['user']['user_id'] ?? (int)$conn->query("SELECT user_id FROM users ORDER BY user_id LIMIT 1")->fetchColumn();
    if ($userId <= 0) {
        throw new Exception('A valid user account is required to perform inventory actions');
    }

    if ($action === 'add') {
        $name = trim((string)($data['name'] ?? ''));
        $category = trim((string)($data['category'] ?? ''));
        $stock = filter_var($data['stock'] ?? $data['stock_quantity'] ?? null, FILTER_VALIDATE_INT);
        $price = filter_var($data['price'] ?? $data['retail_price'] ?? null, FILTER_VALIDATE_FLOAT);
        $cost = filter_var($data['cost'] ?? $data['base_cost'] ?? null, FILTER_VALIDATE_FLOAT);
        $alertLevel = filter_var($data['low_stock_alert_level'] ?? $data['lowStockAlertLevel'] ?? 20, FILTER_VALIDATE_INT) ?: 20;

        if ($name === '' || $category === '' || $stock === false || $stock < 0 || $price === false || $price < 0 || $cost === false || $cost < 0) {
            Response::error('Valid name, category, stock, and prices are required', 400);
        }

        $markup = max(0.0, round($price - $cost, 2));
        $expiry = trim((string)($data['expiry'] ?? $data['expiration_date'] ?? ''));

        $conn->beginTransaction();
        $stmt = $conn->prepare(
            "INSERT INTO products (name, category, base_cost, markup_amount, retail_price, stock_quantity, expiration_date, low_stock_alert_level)
             VALUES (:name, :category, :base_cost, :markup_amount, :retail_price, :stock_quantity, :expiration_date, :low_stock_alert_level)
             RETURNING product_id"
        );
        $stmt->execute([
            'name' => $name,
            'category' => $category,
            'base_cost' => $cost,
            'markup_amount' => $markup,
            'retail_price' => $price,
            'stock_quantity' => $stock,
            'expiration_date' => $expiry !== '' ? $expiry : null,
            'low_stock_alert_level' => $alertLevel
        ]);
        $productId = (int)$stmt->fetchColumn();

        $stmt = $conn->prepare(
            "INSERT INTO stock_adjustments (product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes)
             VALUES (?, ?, 'STOCK IN', ?, ?, NOW(), 'Product added to inventory')"
        );
        $stmt->execute([$productId, $userId, $stock, $cost]);

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
        $stmt = $conn->prepare("SELECT * FROM products WHERE product_id = ? FOR UPDATE");
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
        $expiry = trim((string)($data['expiry'] ?? ''));

        if ($type === 'STOCK IN' && $expiry !== '') {
            $stmt = $conn->prepare("UPDATE products SET stock_quantity = ?, expiration_date = ? WHERE product_id = ?");
            $stmt->execute([$newStock, $expiry, $productId]);
        } else {
            $stmt = $conn->prepare("UPDATE products SET stock_quantity = ? WHERE product_id = ?");
            $stmt->execute([$newStock, $productId]);
        }

        $ref = trim((string)($data['reference'] ?? ''));
        $notes = trim((string)($data['notes'] ?? ''));
        $auditNotes = trim(($ref ? "Ref: $ref. " : "") . $notes);

        $stmt = $conn->prepare(
            "INSERT INTO stock_adjustments (product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes)
             VALUES (?, ?, ?, ?, ?, NOW(), ?)"
        );
        $stmt->execute([
            $productId,
            $userId,
            $type,
            $type === 'STOCK OUT' ? -$quantity : $quantity,
            (float)$product['base_cost'],
            $auditNotes !== '' ? $auditNotes : null
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
        $stmt = $conn->prepare("SELECT product_id, name, stock_quantity, base_cost FROM products WHERE product_id = ? FOR UPDATE");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            throw new Exception('Product not found');
        }

        $currentStock = (int)$product['stock_quantity'];

        if ($currentStock > 0) {
            $stmt = $conn->prepare(
                "INSERT INTO stock_adjustments (product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes)
                 VALUES (?, ?, 'STOCK OUT', ?, ?, NOW(), 'Product removed from inventory')"
            );
            $stmt->execute([$productId, $userId, -$currentStock, (float)$product['base_cost']]);
        }

        try {
            $stmt = $conn->prepare("DELETE FROM products WHERE product_id = ?");
            $stmt->execute([$productId]);
        } catch (PDOException $pe) {
            $stmt = $conn->prepare("UPDATE products SET stock_quantity = 0 WHERE product_id = ?");
            $stmt->execute([$productId]);
        }

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
