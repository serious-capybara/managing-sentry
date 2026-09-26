<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Response;
use Exception;

$database = new Database();
$conn = $database->getConnection();

try {
    $query = "SELECT h.history_id, h.order_id, h.order_status, h.updated_at,
                     o.total_amount, o.amount_tendered, o.change_given, o.created_at, o.notes,
                     u.full_name as cashier_name
              FROM histories h
              JOIN orders o ON h.order_id = o.order_id
              JOIN users u ON o.user_id = u.user_id
              ORDER BY o.created_at DESC";

    $stmt = $conn->query($query);
    $history = $stmt->fetchAll();

    Response::json($history);
} catch (Exception $e) {
    Response::error($e->getMessage());
}
