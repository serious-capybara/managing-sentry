<?php
// get_products.php
// Retrieves all products from the 'products' table.
include 'db_connect.php';
header('Content-Type: application/json');

try {
    $query = "SELECT * FROM products";
    $stmt = $conn->query($query);
    $products = [];

    while ($row = $stmt->fetch()) {
        // Map common variations of column names to match the Android data models
        $product = [
            'product_id' => (int)($row['product_id'] ?? 0),
            'name' => $row['name'] ?? 'Unknown',
            'category' => $row['category'] ?? 'General',
            'base_cost' => (float)($row['base_cost'] ?? 0),
            'markup_amount' => (float)($row['markup_amount'] ?? 0),
            // Fallback for 'srp' vs 'retail_price'
            'retail_price' => (float)($row['retail_price'] ?? $row['srp'] ?? 0),
            'stock_quantity' => (int)($row['stock_quantity'] ?? 0),
            'expiration_date' => $row['expiration_date'] ?? null,
            'low_stock_alert_level' => (int)($row['low_stock_alert_level'] ?? 5)
        ];
        $products[] = $product;
    }
    echo json_encode($products);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
