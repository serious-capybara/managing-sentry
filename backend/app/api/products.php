<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Response;
use Exception;
use PDO;

$action = $_GET['action'] ?? 'list';
$database = new Database();
$conn = $database->getConnection();

try {
    if ($action === 'categories') {
        $stmt = $conn->query("SELECT DISTINCT category FROM products ORDER BY category ASC");
        $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);
        Response::json($categories);
    } else {
        $stmt = $conn->query("SELECT * FROM products");
        $products = [];

        while ($row = $stmt->fetch()) {
            $products[] = [
                'product_id' => (int)($row['product_id'] ?? 0),
                'name' => $row['name'] ?? 'Unknown',
                'category' => $row['category'] ?? 'General',
                'base_cost' => (float)($row['base_cost'] ?? 0),
                'markup_amount' => (float)($row['markup_amount'] ?? 0),
                'retail_price' => (float)($row['retail_price'] ?? $row['srp'] ?? 0),
                'stock_quantity' => (int)($row['stock_quantity'] ?? 0),
                'expiration_date' => $row['expiration_date'] ?? null,
                'low_stock_alert_level' => (int)($row['low_stock_alert_level'] ?? 5)
            ];
        }
        Response::json($products);
    }
} catch (Exception $e) {
    Response::error($e->getMessage());
}
