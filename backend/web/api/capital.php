<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

Auth::requireWebAccess();

$database = new Database();
$conn = $database->getConnection();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $conn->query("SELECT config_id, starting_capital, current_balance, last_updated_at, operating_expenses, interest, taxes FROM capital_configs ORDER BY config_id DESC LIMIT 1");
        $row = $stmt->fetch();
        $startingCapital = (float)($row['starting_capital'] ?? 20000.00);
        $currentBalance = (float)($row['current_balance'] ?? $startingCapital);
        Response::json([
            'capital' => $currentBalance,
            'starting_capital' => $startingCapital,
            'current_balance' => $currentBalance,
            'operating_expenses' => (float)($row['operating_expenses'] ?? 0),
            'interest' => (float)($row['interest'] ?? 0),
            'taxes' => (float)($row['taxes'] ?? 0),
            'last_updated_at' => $row['last_updated_at'] ?? null
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Response::error('Method not allowed', 405);
    }

$data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (($data['action'] ?? '') === 'save_expense_totals') {
        $totals = [];
        foreach (['operating_expenses', 'interest', 'taxes'] as $key) {
            $value = filter_var($data[$key] ?? null, FILTER_VALIDATE_FLOAT);
            if ($value === false || !is_finite((float)$value) || $value < 0 || $value > 9999999999.99) {
                Response::error('Expense totals must be non-negative valid amounts', 400);
            }
            $totals[$key] = round((float)$value, 2);
        }

        $stmt = $conn->query("SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1");
        $configId = $stmt->fetchColumn();
        if ($configId) {
            $stmt = $conn->prepare(
                "UPDATE capital_configs
                 SET operating_expenses = ?, interest = ?, taxes = ?, last_updated_at = NOW()
                 WHERE config_id = ?"
            );
            $stmt->execute([
                $totals['operating_expenses'],
                $totals['interest'],
                $totals['taxes'],
                $configId
            ]);
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO capital_configs
                 (starting_capital, current_balance, operating_expenses, interest, taxes, last_updated_at)
                 VALUES (20000, 20000, ?, ?, ?, NOW())"
            );
            $stmt->execute([
                $totals['operating_expenses'],
                $totals['interest'],
                $totals['taxes']
            ]);
        }

        Response::success('Expense totals saved', $totals);
    }

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
} catch (PDOException $exception) {
    error_log('Capital API database error: ' . $exception->getMessage());
    $sqlState = $exception->errorInfo[0] ?? $exception->getCode();
    if ($sqlState === '42703') {
        Response::error('The database is missing the expense-total columns. Run backend/web/migrations/001_add_expense_totals_to_capital_configs.sql in pgAdmin, then refresh the portal.');
    }
    Response::error('Could not save or load capital data. Check the PHP server log and database connection.');
}
