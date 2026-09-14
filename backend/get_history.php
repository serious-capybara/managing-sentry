<?php
// get_history.php
// Fetches order history by joining orders, histories, and summing order_items.
include 'db_connect.php';
header('Content-Type: application/json');

try {
    $query = "
        SELECT
            o.transaction_timestamp,
            o.order_id,
            COALESCE(SUM(oi.quantity), 0) as total_quantity,
            o.total_amount,
            h.order_status
        FROM orders o
        LEFT JOIN histories h ON o.order_id = h.order_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        GROUP BY o.order_id, o.transaction_timestamp, o.total_amount, h.order_status
        ORDER BY o.transaction_timestamp DESC
        LIMIT 20
    ";

    $stmt = $conn->query($query);
    $history = [];

    while ($row = $stmt->fetch()) {
        $history[] = [
            'transaction_timestamp' => $row['transaction_timestamp'],
            'order_id' => (int)$row['order_id'],
            'total_quantity' => (int)$row['total_quantity'],
            'total_amount' => (float)$row['total_amount'],
            'order_status' => $row['order_status'] ?? 'PENDING'
        ];
    }
    echo json_encode($history);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
