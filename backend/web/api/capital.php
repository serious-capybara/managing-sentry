 <?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

$database = new Database();
$conn = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->query("SELECT setting_value FROM dashboard_settings WHERE setting_key = 'capital'");
    Response::json(['capital' => (float)$stmt->fetchColumn()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$capital = filter_var($data['capital'] ?? null, FILTER_VALIDATE_FLOAT);
if ($capital === false || $capital < 0) {
    Response::error('Capital must be a non-negative amount', 400);
}

$stmt = $conn->prepare(
    "INSERT INTO dashboard_settings (setting_key, setting_value)
     VALUES ('capital', ?)
     ON CONFLICT (setting_key)
     DO UPDATE SET setting_value = EXCLUDED.setting_value"
);
$stmt->execute([$capital]);
Response::success('Capital saved', ['capital' => (float)$capital]);
