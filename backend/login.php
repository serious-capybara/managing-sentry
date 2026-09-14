<?php
// login.php
// Authenticates users against the 'users' table using PDO.
include 'db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);
$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(["error" => "Username and password are required"]);
    exit;
}

try {
    // Correct column name is 'username' per schema provided
    $stmt = $conn->prepare("SELECT user_id, full_name, username, password_hash, role FROM users WHERE username = :username");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    if ($user) {
        // Verifying password
        if (password_verify($password, $user['password_hash'])) {
            unset($user['password_hash']); // Security: remove hash from response
            echo json_encode($user);
        } else {
            http_response_code(401);
            echo json_encode(["error" => "Invalid password"]);
        }
    } else {
        http_response_code(404);
        echo json_encode(["error" => "User not found"]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
