<?php
// db_connect.php
// This file handles the database connection using the provided schema.

$host = "localhost";
$user = "root";
$pass = "";
$db   = "sentry_db"; // Ensure this matches your MySQL database name

$conn = new mysqli($host, $user, $pass, $db);

if ($conn->connect_error) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

// Set charset to utf8mb4 for better compatibility
$conn->set_charset("utf8mb4");
?>
