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
    $conn->exec('DELETE FROM sales');
    $conn->exec('DELETE FROM stock_movements');
    $conn->exec('DELETE FROM product_expiry_batches');
    $conn->exec("UPDATE products SET status = 'INACTIVE', stock_quantity = 0, stock_baseline = 0");
    $stmt = $conn->prepare(
        "UPDATE dashboard_settings SET setting_value = 20000 WHERE setting_key = 'capital'"
    );
    $stmt->execute();
    $conn->commit();
    Response::success('Dashboard data reset');
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    Response::error($e->getMessage());
}
