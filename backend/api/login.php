<?php

require_once __DIR__ . '/../init.php';

use Config\Database;
use Core\Response;

$data = json_decode(file_get_contents("php://input"), true);
$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if (empty($username) || empty($password)) {
    Response::error("Username and password are required", 400);
}

$database = new Database();
$conn = $database->getConnection();

try {
    $stmt = $conn->prepare("SELECT user_id, full_name, username, password_hash, role FROM users WHERE username = :username");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    if (!$user) {
        Response::error("User not found", 404);
    }

    if (!password_verify($password, $user['password_hash'])) {
        Response::error("Invalid password", 401);
    }

    unset($user['password_hash']);
    Response::json($user);

} catch (PDOException $e) {
    Response::error("Database error: " . $e->getMessage());
}
