<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

$data = json_decode(file_get_contents("php://input"), true) ?? [];
$action = $_GET['action'] ?? 'login';

if ($action === 'logout') {
    Auth::signOut();
    Response::success('Signed out');
}

$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if (!is_string($username) || !is_string($password) || $username === '' || $password === '') {
    Response::error("Username and password are required", 400);
}

$database = new Database();
$conn = $database->getConnection();

try {
    $stmt = $conn->prepare("SELECT user_id, full_name, user_name AS username, password_hash, role FROM users WHERE user_name = :username");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        Response::error("Invalid username or password", 401);
    }
    if (!in_array(strtolower(trim((string)$user['role'])), ['admin', 'manager'], true)) {
        Response::error("The web portal is only available to Admin and Manager accounts", 403);
    }

    unset($user['password_hash']);
    Auth::signIn($user);
    Response::json($user);

} catch (\PDOException $e) {
    Response::error("Database error: " . $e->getMessage());
}
