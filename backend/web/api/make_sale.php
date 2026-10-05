<?php

require_once __DIR__ . '/../init.php';

use config\Database;
use core\Auth;
use core\Response;

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$items = $data['items'] ?? [];
if (!is_array($items) || !$items) {
    Response::error('At least one sale item is required', 400);
}
Auth::requireWebAccess();

$requested = [];
foreach ($items as $item) {
    if (!is_array($item)) {
        Response::error('Each sale item must be an object', 400);
    }
    $productId = filter_var($item['product_id'] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
    if (!$productId || !$quantity || $quantity < 1) {
        Response::error('Each sale item needs a valid product and quantity', 400);
    }
    $requested[$productId] = ($requested[$productId] ?? 0) + $quantity;
}

$database = new Database();
$conn = $database->getConnection();

try {
    $conn->beginTransaction();
    $userId = (int)$conn->query("SELECT user_id FROM users ORDER BY user_id LIMIT 1")->fetchColumn();
    if ($userId <= 0) {
        throw new Exception('A database user is required to record sales');
    }

    $transactionId = bin2hex(random_bytes(16));
    $method = trim((string)($data['method'] ?? 'Cash'));
    $reference = trim((string)($data['reference'] ?? ''));
    $notes = trim((string)($data['notes'] ?? ''));
    $received = filter_var($data['amount_received'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($received === false || $received < 0) {
        Response::error('A valid amount received is required', 400);
    }
    $products = [];
    $total = 0.0;
    foreach ($requested as $productId => $quantity) {
        $stmt = $conn->prepare(
            "SELECT product_id, name, srp, base_cost, stock_quantity
             FROM products
             WHERE product_id = ? AND UPPER(status) <> 'INACTIVE'
             FOR UPDATE"
        );
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            $conn->rollBack();
            Response::error('A product in this sale no longer exists', 404);
        }
        if ($quantity > (int)$product['stock_quantity']) {
            $conn->rollBack();
            Response::error('Not enough stock for ' . $product['name'], 409);
        }
        $product['quantity'] = $quantity;
        $product['line_total'] = round((float)$product['srp'] * $quantity, 2);
        $total += $product['line_total'];
        $products[] = $product;
    }

    if ($method === 'Cash' && $received < $total) {
        $conn->rollBack();
        Response::error('Amount received is less than the sale total', 400);
    }
    $received = max((float)$received, $total);
    $change = max(0, $received - $total);
    $sale = $conn->prepare(
        "INSERT INTO sales
            (user_id, product_id, quantity, total_amount, transaction_id, product_name,
             unit_price, cost_per_unit, payment_method, payment_reference,
             amount_received, change_given, notes)
         VALUES
            (:user_id, :product_id, :quantity, :total_amount, :transaction_id, :product_name,
             :unit_price, :cost_per_unit, :payment_method, :payment_reference,
             :amount_received, :change_given, :notes)"
    );

    foreach ($products as $product) {
        $unitPrice = (float)$product['srp'];
        $unitCost = (float)$product['base_cost'];
        $sale->execute([
            'user_id' => $userId,
            'product_id' => $product['product_id'],
            'quantity' => $product['quantity'],
            'total_amount' => $product['line_total'],
            'transaction_id' => $transactionId,
            'product_name' => $product['name'],
            'unit_price' => $unitPrice,
            'cost_per_unit' => $unitCost,
            'payment_method' => $method,
            'payment_reference' => $reference,
            'amount_received' => $received,
            'change_given' => $change,
            'notes' => $notes
        ]);

        $update = $conn->prepare(
            "UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?"
        );
        $update->execute([$product['quantity'], $product['product_id']]);
        consumeExpiryStock($conn, (int)$product['product_id'], (int)$product['quantity']);

        $expiry = $conn->prepare(
            "UPDATE products
             SET expiration_date = (
                 SELECT MIN(expiry_date) FROM product_expiry_batches WHERE product_id = ?
             )
             WHERE product_id = ?"
        );
        $expiry->execute([$product['product_id'], $product['product_id']]);
    }

    $conn->commit();
    Response::success('Sale recorded', ['transaction_id' => $transactionId, 'total_amount' => $total]);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    Response::error($e->getMessage());
}

function consumeExpiryStock(PDO $conn, int $productId, int $quantity): void
{
    $stmt = $conn->prepare(
        "SELECT batch_id, quantity FROM product_expiry_batches
         WHERE product_id = ? ORDER BY expiry_date, added_at FOR UPDATE"
    );
    $stmt->execute([$productId]);
    $remaining = $quantity;
    foreach ($stmt->fetchAll() as $batch) {
        if ($remaining === 0) {
            break;
        }
        $taken = min($remaining, (int)$batch['quantity']);
        $remaining -= $taken;
        if ($taken === (int)$batch['quantity']) {
            $delete = $conn->prepare("DELETE FROM product_expiry_batches WHERE batch_id = ?");
            $delete->execute([$batch['batch_id']]);
        } else {
            $update = $conn->prepare("UPDATE product_expiry_batches SET quantity = quantity - ? WHERE batch_id = ?");
            $update->execute([$taken, $batch['batch_id']]);
        }
    }
}
