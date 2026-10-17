<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$items = $data['items'] ?? [];
if (!is_array($items) || !$items) {
    Response::error('At least one sale item is required', 400);
}

$requested = [];
foreach ($items as $item) {
    if (!is_array($item)) {
        Response::error('Each sale item must be an object', 400);
    }
    $productId = filter_var($item['product_id'] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
    if (!$productId || !$quantity || $quantity < 1) {
        Response::error('Each sale item needs a valid product and quantity', 400);
    }
    $requested[$productId] = ($requested[$productId] ?? 0) + $quantity;
}

$database = new Database();
$conn = $database->getConnection();

try {
    $conn->beginTransaction();
    $userId = $_SESSION['user']['user_id'] ?? (int)$conn->query("SELECT user_id FROM users ORDER BY user_id LIMIT 1")->fetchColumn();
    if ($userId <= 0) {
        throw new Exception('A database user is required to record sales');
    }

    $method = trim((string)($data['method'] ?? 'Cash'));
    $reference = trim((string)($data['reference'] ?? ''));
    $notes = trim((string)($data['notes'] ?? ''));
    $received = filter_var($data['amount_received'] ?? $data['amount_tendered'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($received === false || $received < 0) {
        Response::error('A valid amount received is required', 400);
    }

    $products = [];
    $total = 0.0;
    foreach ($requested as $productId => $quantity) {
        $stmt = $conn->prepare(
            "SELECT product_id, name, retail_price, base_cost, stock_quantity
             FROM products
             WHERE product_id = ?
             FOR UPDATE"
        );
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            $conn->rollBack();
            Response::error('A product in this sale no longer exists', 404);
        }
        if ($quantity > (int)$product['stock_quantity']) {
            $conn->rollBack();
            Response::error('Not enough stock for ' . $product['name'], 409);
        }
        $product['quantity'] = $quantity;
        $product['line_total'] = round((float)$product['retail_price'] * $quantity, 2);
        $total += $product['line_total'];
        $products[] = $product;
    }

    if ($method === 'Cash' && $received < $total) {
        $conn->rollBack();
        Response::error('Amount received is less than the sale total', 400);
    }
    $received = max((float)$received, $total);
    $change = max(0, $received - $total);

    $fullNotes = trim(($method !== 'Cash' ? "Payment: $method. " : "") . ($reference ? "Ref: $reference. " : "") . $notes);

    // 1. Create the main orders record
    $orderStmt = $conn->prepare(
        "INSERT INTO orders (user_id, transaction_timestamp, total_amount, amount_tendered, change_given, notes)
         VALUES (?, NOW(), ?, ?, ?, ?)
         RETURNING order_id"
    );
    $orderStmt->execute([
        $userId,
        $total,
        $received,
        $change,
        $fullNotes !== '' ? $fullNotes : null
    ]);
    $orderId = (int)$orderStmt->fetchColumn();

    // 2. Process each item in order_items and update product stock
    $itemStmt = $conn->prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, cost_snapshot, price_snapshot, line_subtotal)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stockStmt = $conn->prepare(
        "UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?"
    );

    foreach ($products as $product) {
        $unitPrice = (float)$product['retail_price'];
        $unitCost = (float)$product['base_cost'];

        $itemStmt->execute([
            $orderId,
            $product['product_id'],
            $product['quantity'],
            $unitCost,
            $unitPrice,
            $product['line_total']
        ]);

        $stockStmt->execute([$product['quantity'], $product['product_id']]);
    }

    // 3. Insert into histories
    $histStmt = $conn->prepare(
        "INSERT INTO histories (order_id, status_timestamp, order_status)
         VALUES (?, NOW(), 'COMPLETED')"
    );
    $histStmt->execute([$orderId]);

    // 4. Update capital_configs
    $capStmt = $conn->query("SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1");
    $configId = $capStmt->fetchColumn();
    if ($configId) {
        $updateCap = $conn->prepare("UPDATE capital_configs SET current_balance = current_balance + ?, last_updated_at = NOW() WHERE config_id = ?");
        $updateCap->execute([$total, $configId]);
    } else {
        $insertCap = $conn->prepare("INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) VALUES (20000, ?, NOW())");
        $insertCap->execute([20000 + $total]);
    }

    $conn->commit();
    Response::success('Sale recorded', [
        'order_id' => $orderId,
        'transaction_id' => $orderId,
        'total_amount' => $total
    ]);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    Response::error($e->getMessage());
}
