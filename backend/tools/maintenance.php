<?php

require_once __DIR__ . '/../init.php';

use Config\Database;

$action = $_GET['action'] ?? 'status';
$database = new Database();
$conn = $database->getConnection();

echo "<pre>";
switch ($action) {
    case 'schema':
        $table = $_GET['table'] ?? 'products';
        $stmt = $conn->query("SELECT column_name FROM information_schema.columns WHERE table_name = '$table'");
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "Columns in '$table': " . implode(', ', $columns);
        break;

    case 'add_notes':
        try {
            $conn->exec("ALTER TABLE orders ADD COLUMN notes TEXT");
            echo "Notes column added to orders table.";
        } catch (Exception $e) {
            echo "Error adding column: " . $e->getMessage();
        }
        break;

    case 'test':
        echo "Database connection successful.";
        break;

    default:
        echo "Available actions: schema&table=NAME, add_notes, test";
        break;
}
echo "</pre>";
