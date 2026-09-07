<?php
header("Content-Type: application/json");
require_once "db.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data["user_name"]) || !isset($data["password"])) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid username or password"]);
    exit;
}

$userName = $data["user_name"];
$password = $data["password"];

try {
    $stmt = $pdo->prepare("SELECT user_id, full_name, user_name, password_hash, role FROM users WHERE user_name = ?");
    $stmt->execute([$userName]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user["password_hash"])) {
        unset($user["password_hash"]);
        echo json_encode($user);
    } else {
        http_response_code(401);
        echo json_encode(["error" => "Invalid username or password"]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Internal server error"]);
}
?>
