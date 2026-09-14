<?php
// make_sale.php
// Processes a sale transaction across multiple tables.
include 'db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['items']) || empty($data['items'])) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid sale data"]);
    exit;
}

$conn->beginTransaction();

try {
    // 1. Create the main Order record
    $stmt = $conn->prepare("INSERT INTO orders (user_id, total_amount, amount_tendered, change_given) VALUES (?, ?, ?, ?)");
    $stmt->execute([$data['user_id'], $data['total_amount'], $data['amount_tendered'], $data['change_given']]);
    $order_id = $conn->lastInsertId();

    // 2. Process each item in the order
    foreach ($data['items'] as $item) {
        // Record the individual item sold
        $stmt_item = $conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, cost_snapshot, price_snapshot, line_subtotal) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt_item->execute([$order_id, $item['product_id'], $item['quantity'], $item['cost_snapshot'], $item['price_snapshot'], $item['line_subtotal']]);

        // Deduct quantity from stock
        $stmt_stock = $conn->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?");
        $stmt_stock->execute([$item['quantity'], $item['product_id']]);
    }

    // 3. Log into Histories
    $status = "COMPLETED";
    $stmt_hist = $conn->prepare("INSERT INTO histories (order_id, order_status) VALUES (?, ?)");
    $stmt_hist->execute([$order_id, $status]);

    // 4. Update Capital Configuration (Balance)
    // We update the most recent config record using a subquery for PostgreSQL compatibility
    $stmt_cap = $conn->prepare("UPDATE capital_configs SET current_balance = current_balance + ? WHERE config_id = (SELECT config_id FROM capital_configs ORDER BY last_updated_at DESC LIMIT 1)");
    $stmt_cap->execute([$data['total_amount']]);

    $conn->commit();
    echo json_encode(["success" => true, "order_id" => $order_id, "message" => "Sale processed successfully"]);

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["error" => "Transaction failed: " . $e->getMessage()]);
}
?>
