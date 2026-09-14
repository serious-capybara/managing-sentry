<?php
// get_history.php
// Fetches order history by joining orders, histories, and summing order_items.
include 'db_connect.php';
header('Content-Type: application/json');

$query = "
    SELECT
        o.transaction_timestamp,
        o.order_id,
        SUM(oi.quantity) as total_quantity,
        o.total_amount,
        h.order_status
    FROM orders o
    LEFT JOIN histories h ON o.order_id = h.order_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY o.order_id
    ORDER BY o.transaction_timestamp DESC
    LIMIT 10
";

$result = $conn->query($query);
$history = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $row['order_id'] = (int)$row['order_id'];
        $row['total_quantity'] = (int)$row['total_quantity'];
        $row['total_amount'] = (float)$row['total_amount'];
        $history[] = $row;
    }
}

echo json_encode($history);
?>
