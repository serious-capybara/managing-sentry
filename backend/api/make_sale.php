<?php

require_once __DIR__ . '/../init.php';

use Config\Database;
use Core\Response;

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['items']) || empty($data['items'])) {
    Response::error("Invalid sale data", 400);
}

$database = new Database();
$conn = $database->getConnection();

$conn->beginTransaction();

try {
    // 1. Create the main Order record
    $stmt = $conn->prepare("INSERT INTO orders (user_id, total_amount, amount_tendered, change_given, notes) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $data['user_id'],
        $data['total_amount'],
        $data['amount_tendered'],
        $data['change_given'],
        $data['notes'] ?? ''
    ]);
    $order_id = $conn->lastInsertId();

    // 2. Process each item in the order
    foreach ($data['items'] as $item) {
        $stmt_item = $conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, cost_snapshot, price_snapshot, line_subtotal) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt_item->execute([
            $order_id,
            $item['product_id'],
            $item['quantity'],
            $item['cost_snapshot'],
            $item['price_snapshot'],
            $item['line_subtotal']
        ]);

        $stmt_stock = $conn->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?");
        $stmt_stock->execute([$item['quantity'], $item['product_id']]);
    }

    // 3. Log into Histories
    $stmt_hist = $conn->prepare("INSERT INTO histories (order_id, order_status) VALUES (?, 'COMPLETED')");
    $stmt_hist->execute([$order_id]);

    // 4. Update Capital Configuration
    $stmt_cap = $conn->prepare("UPDATE capital_configs SET current_balance = current_balance + ? WHERE config_id = (SELECT config_id FROM capital_configs ORDER BY last_updated_at DESC LIMIT 1)");
    $stmt_cap->execute([$data['total_amount']]);

    $conn->commit();
    Response::success("Sale processed successfully", ["order_id" => $order_id]);

} catch (Exception $e) {
    $conn->rollBack();
    Response::error("Transaction failed: " . $e->getMessage());
}
