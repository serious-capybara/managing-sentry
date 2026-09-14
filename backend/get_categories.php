<?php
include 'db_connect.php';
header('Content-Type: application/json');

try {
    $stmt = $conn->query("SELECT DISTINCT category FROM products ORDER BY category ASC");
    $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode($categories);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
