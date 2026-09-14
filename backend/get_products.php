<?php
// get_products.php
// Retrieves all products from the 'products' table.
include 'db_connect.php';
header('Content-Type: application/json');

$query = "SELECT product_id, name, base_cost, markup_amount, retail_price, stock_quantity, expiration_date, low_stock_alert_level FROM products";
$result = $conn->query($query);

$products = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        // Ensure numeric types are cast correctly if needed
        $row['product_id'] = (int)$row['product_id'];
        $row['base_cost'] = (float)$row['base_cost'];
        $row['retail_price'] = (float)$row['retail_price'];
        $row['stock_quantity'] = (int)$row['stock_quantity'];
        $products[] = $row;
    }
}

echo json_encode($products);
?>
