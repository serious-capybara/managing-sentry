<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

$database = new Database();
$conn = $database->getConnection();

try {
    $query = "
        SELECT sale_id AS entry_id, sale_timestamp AS created_at, 'SALE' AS type,
               COALESCE(product_name, name) AS name, quantity AS qty, total_amount AS amount,
               cost_per_unit AS cost_per_unit, payment_method AS method,
               payment_reference AS reference, notes
        FROM sales
        LEFT JOIN products USING (product_id)
        UNION ALL
        SELECT movement_id AS entry_id, created_at, movement_type AS type,
               product_name AS name, quantity AS qty, unit_cost * quantity AS amount,
               unit_cost AS cost_per_unit, '' AS method, reference, notes
        FROM stock_movements
        ORDER BY created_at DESC, entry_id DESC";
    $history = $conn->query($query)->fetchAll();
    foreach ($history as &$entry) {
        $entry['qty'] = (int)$entry['qty'];
        $entry['amount'] = (float)$entry['amount'];
        $entry['costPerUnit'] = (float)$entry['cost_per_unit'];
        $entry['date'] = $entry['created_at'];
        $entry['ref'] = $entry['reference'];
        unset($entry['cost_per_unit'], $entry['created_at'], $entry['reference']);
    }
    unset($entry);
    Response::json($history);
} catch (Exception $e) {
    Response::error($e->getMessage());
}
