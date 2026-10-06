<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

$database = new Database();
$conn = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->query("SELECT config_id, starting_capital, current_balance, last_updated_at FROM capital_configs ORDER BY config_id DESC LIMIT 1");
    $row = $stmt->fetch();
    $startingCapital = (float)($row['starting_capital'] ?? 20000.00);
    $currentBalance = (float)($row['current_balance'] ?? $startingCapital);
    Response::json([
        'capital' => $currentBalance,
        'starting_capital' => $startingCapital,
        'current_balance' => $currentBalance,
        'last_updated_at' => $row['last_updated_at'] ?? null
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$capital = filter_var($data['capital'] ?? $data['starting_capital'] ?? $data['current_balance'] ?? null, FILTER_VALIDATE_FLOAT);
if ($capital === false || $capital < 0) {
    Response::error('Capital must be a non-negative amount', 400);
}

$stmt = $conn->query("SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1");
$configId = $stmt->fetchColumn();

if ($configId) {
    $stmt = $conn->prepare("UPDATE capital_configs SET current_balance = ?, starting_capital = ?, last_updated_at = NOW() WHERE config_id = ?");
    $stmt->execute([$capital, $capital, $configId]);
} else {
    $stmt = $conn->prepare("INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) VALUES (?, ?, NOW())");
    $stmt->execute([$capital, $capital]);
}

Response::success('Capital saved', [
    'capital' => (float)$capital,
    'starting_capital' => (float)$capital,
    'current_balance' => (float)$capital
]);
