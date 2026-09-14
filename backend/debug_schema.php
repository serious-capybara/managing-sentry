<?php
include 'db_connect.php';
try {
    $stmt = $conn->query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    file_put_contents('schema_debug.txt', implode(', ', $columns));

    $stmt = $conn->query("SELECT * FROM products LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    file_put_contents('data_debug.txt', json_encode($row));
} catch (Exception $e) {
    file_put_contents('error_debug.txt', $e->getMessage());
}
?>
