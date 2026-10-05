<?php

namespace core;

class Auth
{
    private const ALLOWED_ROLES = ['admin', 'manager'];

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

    public static function signIn(array $user): void
    {
        self::start();
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'user_id' => (int)$user['user_id'],
            'full_name' => $user['full_name'],
            'role' => $user['role']
        ];
    }

    public static function requireWebAccess(): void
    {
        self::start();
        $user = $_SESSION['user'] ?? null;
        if (!$user) {
            Response::error('Please sign in to the web portal', 401);
        }
        if (!in_array(strtolower(trim((string)$user['role'])), self::ALLOWED_ROLES, true)) {
            Response::error('The web portal is only available to Admin and Manager accounts', 403);
        }
    }

    public static function signOut(): void
    {
        self::start();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax'
            ]);
        }
        session_destroy();
    }
}
