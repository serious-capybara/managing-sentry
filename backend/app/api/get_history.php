<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Response;
use Exception;
use DateTime;

$database = new Database();
$conn = $database->getConnection();

try {
    // Exact SQL query matching the FastAPI backend implementation that works for your app
    $query = "
        SELECT
            o.transaction_timestamp,
            o.order_id,
            COALESCE(SUM(oi.quantity), 0) AS total_quantity,
            o.total_amount,
            o.notes,
            COALESCE(h.order_status, 'PENDING') AS order_status
        FROM orders o
        LEFT JOIN histories h ON o.order_id = h.order_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        GROUP BY o.order_id, o.transaction_timestamp, o.total_amount, o.notes, h.order_status
        ORDER BY o.transaction_timestamp DESC
    ";

    $stmt = $conn->query($query);
    $rows = $stmt->fetchAll();

    $formattedHistory = [];
    foreach ($rows as $row) {
        $timestamp = $row['transaction_timestamp'];
        if ($timestamp) {
            try {
                $dt = new DateTime($timestamp);
                $timestamp = $dt->format('Y-m-d H:i:s');
            } catch (Exception $e) {
                // Keep original string if parsing fails
            }
        }

        $formattedHistory[] = [
            'transaction_timestamp' => $timestamp ?? '',
            'order_id' => (int)$row['order_id'],
            'total_quantity' => (int)$row['total_quantity'],
            'total_amount' => (float)$row['total_amount'],
            'order_status' => $row['order_status'] ?? 'COMPLETED',
            'notes' => $row['notes'] ?? ''
        ];
    }

    Response::json($formattedHistory);
} catch (Exception $e) {
    Response::error($e->getMessage());
}
