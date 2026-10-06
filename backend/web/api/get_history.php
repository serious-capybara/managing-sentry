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
        SELECT
            o.order_id AS entry_id,
            o.order_id,
            o.user_id,
            o.transaction_timestamp AS created_at,
            'SALE' AS type,
            COALESCE(
                string_agg(p.name || ' (x' || oi.quantity || ')', ', '),
                'Order #' || o.order_id
            ) AS name,
            COALESCE(SUM(oi.quantity), 0) AS qty,
            o.total_amount AS amount,
            COALESCE(
                SUM(oi.cost_snapshot * oi.quantity) / NULLIF(SUM(oi.quantity), 0),
                0
            ) AS cost_per_unit,
            o.notes,
            COALESCE(h.order_status, 'COMPLETED') AS order_status
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.order_id
        LEFT JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN histories h ON h.order_id = o.order_id
        GROUP BY o.order_id, o.user_id, o.transaction_timestamp, o.total_amount, o.notes, h.order_status

        UNION ALL

        SELECT
            sa.adjustment_id AS entry_id,
            NULL AS order_id,
            sa.user_id,
            sa.transaction_date AS created_at,
            sa.adjustment_type AS type,
            p.name,
            sa.quantity_changed AS qty,
            (sa.unit_cost * ABS(sa.quantity_changed)) AS amount,
            sa.unit_cost AS cost_per_unit,
            sa.audit_notes AS notes,
            'COMPLETED' AS order_status
        FROM stock_adjustments sa
        LEFT JOIN products p ON p.product_id = sa.product_id

        ORDER BY created_at DESC, entry_id DESC
    ";

    $history = $conn->query($query)->fetchAll();
    foreach ($history as &$entry) {
        $entry['order_id'] = $entry['order_id'] !== null ? (int)$entry['order_id'] : null;
        $entry['qty'] = (int)$entry['qty'];
        $entry['amount'] = (float)$entry['amount'];
        $entry['costPerUnit'] = (float)$entry['cost_per_unit'];
        $entry['date'] = $entry['created_at'];
        $entry['total_quantity'] = (int)$entry['qty'];
        $entry['total_amount'] = (float)$entry['amount'];
        $entry['transaction_timestamp'] = $entry['created_at'];
        $entry['order_status'] = $entry['order_status'] ?? 'COMPLETED';
        $entry['notes'] = $entry['notes'] ?? '';
        $entry['ref'] = '';
        unset($entry['cost_per_unit'], $entry['created_at']);
    }
    unset($entry);
    Response::json($history);
} catch (Exception $e) {
    Response::error($e->getMessage());
}
