<?php
include 'db_connect.php';
header('Content-Type: application/json');

try {
    $stmt = $conn->query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode($columns);
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}
?>
