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

/**
 * Safely check if a column in PostgreSQL is an identity or has an auto-increment sequence default.
 */
function isIdentityOrSequenceColumn($conn, $table, $column) {
    try {
        $stmt = $conn->prepare("
            SELECT is_identity, column_default
            FROM information_schema.columns
            WHERE table_name = :table AND column_name = :column
        ");
        $stmt->execute(['table' => $table, 'column' => $column]);
        $row = $stmt->fetch();
        if ($row) {
            if ($row['is_identity'] === 'YES') return true;
            if ($row['column_default'] !== null && strpos($row['column_default'], 'nextval') !== false) return true;
        }
        return false;
    } catch (Exception $e) {
        return false;
    }
}

/**
 * Safely insert a new product row without aborting the active transaction block.
 */
function insertProduct($conn, $name, $category, $cost, $markup, $price, $stock, $expiry, $alertLevel) {
    $hasAutoId = isIdentityOrSequenceColumn($conn, 'products', 'product_id');

    if ($hasAutoId) {
        // Strategy 1: Sequence or IDENTITY exists — omit product_id so PostgreSQL generates it automatically
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
        return (int)$stmt->fetchColumn();
    } else {
        // Strategy 2: Plain integer NOT NULL without default — calculate next max ID explicitly
        $nextProductId = (int)$conn->query("SELECT COALESCE(MAX(product_id), 0) + 1 FROM products")->fetchColumn();
        $stmt = $conn->prepare(
            "INSERT INTO products (product_id, name, category, base_cost, markup_amount, retail_price, stock_quantity, expiration_date, low_stock_alert_level)
             VALUES (:product_id, :name, :category, :base_cost, :markup_amount, :retail_price, :stock_quantity, :expiration_date, :low_stock_alert_level)
             RETURNING product_id"
        );
        $stmt->execute([
            'product_id' => $nextProductId,
            'name' => $name,
            'category' => $category,
            'base_cost' => $cost,
            'markup_amount' => $markup,
            'retail_price' => $price,
            'stock_quantity' => $stock,
            'expiration_date' => $expiry !== '' ? $expiry : null,
            'low_stock_alert_level' => $alertLevel
        ]);
        return $nextProductId;
    }
}

/**
 * Safely insert a stock adjustment row without aborting the active transaction block.
 */
function insertStockAdjustment($conn, $productId, $userId, $type, $qtyChanged, $unitCost, $notes) {
    $hasAutoId = isIdentityOrSequenceColumn($conn, 'stock_adjustments', 'adjustment_id');

    if ($hasAutoId) {
        // Strategy 1: Sequence or IDENTITY exists — omit adjustment_id so PostgreSQL generates it automatically
        $stmt = $conn->prepare(
            "INSERT INTO stock_adjustments (product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes)
             VALUES (?, ?, ?, ?, ?, NOW(), ?)"
        );
        $stmt->execute([
            $productId,
            $userId,
            $type,
            $qtyChanged,
            $unitCost,
            $notes !== '' ? $notes : null
        ]);
    } else {
        // Strategy 2: Plain integer NOT NULL without default — calculate next max ID explicitly
        $nextAdjId = (int)$conn->query("SELECT COALESCE(MAX(adjustment_id), 0) + 1 FROM stock_adjustments")->fetchColumn();
        $stmt = $conn->prepare(
            "INSERT INTO stock_adjustments (adjustment_id, product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)"
        );
        $stmt->execute([
            $nextAdjId,
            $productId,
            $userId,
            $type,
            $qtyChanged,
            $unitCost,
            $notes !== '' ? $notes : null
        ]);
    }
}

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
                    COALESCE(SUM(oi.quantity), 0) AS sold,
                    COALESCE(SUM(oi.quantity * oi.price_snapshot), 0) AS sold_revenue,
                    COALESCE(SUM(oi.quantity * oi.cost_snapshot), 0) AS sold_cogs
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

        $stmt = $conn->prepare("SELECT product_id, stock_quantity FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))");
        $stmt->execute([$name]);
        $existing = $stmt->fetch();

        if ($existing) {
            $productId = (int)$existing['product_id'];
            $stmt = $conn->prepare(
                "UPDATE products
                 SET category = :category,
                     base_cost = :base_cost,
                     markup_amount = :markup_amount,
                     retail_price = :retail_price,
                     stock_quantity = stock_quantity + :stock_quantity,
                     expiration_date = :expiration_date,
                     low_stock_alert_level = :low_stock_alert_level
                 WHERE product_id = :product_id"
            );
            $stmt->execute([
                'category' => $category,
                'base_cost' => $cost,
                'markup_amount' => $markup,
                'retail_price' => $price,
                'stock_quantity' => $stock,
                'expiration_date' => $expiry !== '' ? $expiry : null,
                'low_stock_alert_level' => $alertLevel,
                'product_id' => $productId
            ]);
            insertStockAdjustment($conn, $productId, $userId, 'STOCK IN', $stock, $cost, 'Product re-activated and restocked');
        } else {
            $productId = insertProduct($conn, $name, $category, $cost, $markup, $price, $stock, $expiry, $alertLevel);
            insertStockAdjustment($conn, $productId, $userId, 'STOCK IN', $stock, $cost, 'Product added to inventory');
        }

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

        insertStockAdjustment(
            $conn,
            $productId,
            $userId,
            $type,
            $type === 'STOCK OUT' ? -$quantity : $quantity,
            (float)$product['base_cost'],
            $auditNotes
        );

        $conn->commit();
        Response::success('Stock updated');
    }

    if ($action === 'delete') {
        $productId = filter_var($data['product_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$productId) {
            Response::error('A valid product is required', 400);
        }
        $conn->beginTransaction();
        try {
            $stmt = $conn->prepare("SELECT product_id, name, stock_quantity, base_cost FROM products WHERE product_id = ? FOR UPDATE");
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            if (!$product) {
                throw new Exception('Product not found');
            }

            $currentStock = (int)$product['stock_quantity'];

            if ($currentStock > 0) {
                insertStockAdjustment(
                    $conn,
                    $productId,
                    $userId,
                    'STOCK OUT',
                    -$currentStock,
                    (float)$product['base_cost'],
                    'Product removed from inventory'
                );
            }

            $stmt = $conn->prepare("DELETE FROM products WHERE product_id = ?");
            $stmt->execute([$productId]);

            $conn->commit();
            Response::success('Product removed');
        } catch (Exception $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("SELECT COUNT(*) FROM order_items WHERE product_id = ?");
                $stmt->execute([$productId]);
                $hasOrders = (int)$stmt->fetchColumn() > 0;

                if ($hasOrders) {
                    $stmt = $conn->prepare("UPDATE products SET stock_quantity = 0 WHERE product_id = ?");
                    $stmt->execute([$productId]);
                    $conn->commit();
                    Response::success('Product has sales history; stock zeroed out.');
                } else {
                    $stmt = $conn->prepare("DELETE FROM stock_adjustments WHERE product_id = ?");
                    $stmt->execute([$productId]);

                    $stmt = $conn->prepare("DELETE FROM products WHERE product_id = ?");
                    $stmt->execute([$productId]);
                    $conn->commit();
                    Response::success('Product removed');
                }
            } catch (Exception $fallbackErr) {
                if ($conn->inTransaction()) {
                    $conn->rollBack();
                }
                Response::error('Could not remove product: ' . $fallbackErr->getMessage());
            }
        }
    }

    Response::error('Unknown product action', 400);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    Response::error($e->getMessage());
}
