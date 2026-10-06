<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$database = new Database();
$conn = $database->getConnection();
$conn->beginTransaction();

try {
    $conn->exec('DELETE FROM histories');
    $conn->exec('DELETE FROM order_items');
    $conn->exec('DELETE FROM orders');
    $conn->exec('DELETE FROM stock_adjustments');
    $conn->exec('UPDATE products SET stock_quantity = 0');

    $stmt = $conn->query('SELECT config_id, starting_capital FROM capital_configs ORDER BY config_id DESC LIMIT 1');
    $config = $stmt->fetch();
    if ($config) {
        $update = $conn->prepare('UPDATE capital_configs SET current_balance = starting_capital, last_updated_at = NOW() WHERE config_id = ?');
        $update->execute([$config['config_id']]);
    } else {
        $insert = $conn->prepare('INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) VALUES (20000, 20000, NOW())');
        $insert->execute();
    }

    $conn->commit();
    Response::success('Dashboard data reset');
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    Response::error($e->getMessage());
}
