<?php

namespace core;

class Auth
{
    public static function start(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }
    }

    public static function signIn(array $user): string
    {
        self::start();
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'user_id' => (int)$user['user_id'],
            'full_name' => $user['full_name'] ?? '',
            'username' => $user['username'] ?? '',
            'role' => $user['role'] ?? ''
        ];
        $tokenPayload = json_encode($_SESSION['user']);
        return base64_encode($tokenPayload);
    }

    public static function requireAppAccess(): array
    {
        self::start();
        if (isset($_SESSION['user']) && !empty($_SESSION['user']['user_id'])) {
            return $_SESSION['user'];
        }

        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $token = '';
        if (str_starts_with($authHeader, 'Bearer ')) {
            $token = trim(substr($authHeader, 7));
        } elseif (isset($headers['X-Token'])) {
            $token = trim($headers['X-Token']);
        } elseif (isset($_SERVER['HTTP_X_TOKEN'])) {
            $token = trim($_SERVER['HTTP_X_TOKEN']);
        } elseif (isset($_GET['token'])) {
            $token = trim($_GET['token']);
        }

        if ($token !== '') {
            $decoded = json_decode(base64_decode($token), true);
            if (is_array($decoded) && isset($decoded['user_id'])) {
                $_SESSION['user'] = $decoded;
                return $decoded;
            }
        }

        Response::error('Authentication required. Please sign in.', 401);
    }
}
