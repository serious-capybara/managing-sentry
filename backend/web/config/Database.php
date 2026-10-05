<?php

namespace config;

use PDO;
use PDOException;

class Database {
    private $host;
    private $port;
    private $db_name;
    private $username;
    private $password;
    public $conn;

    public function __construct() {
        $config = self::loadConfiguration();
        $this->host = $config['DB_HOST'] ?? '';
        $this->port = $config['DB_PORT'] ?? '';
        $this->db_name = $config['DB_NAME'] ?? '';
        $this->username = $config['DB_USER'] ?? '';
        $this->password = $config['DB_PASSWORD'] ?? '';
    }

    public function getConnection() {
        $this->conn = null;

        try {
            if ($this->host === '' || $this->port === '' || $this->db_name === '' || $this->username === '') {
                throw new PDOException('Database configuration is incomplete');
            }
            $dsn = "pgsql:host=" . $this->host . ";port=" . $this->port . ";dbname=" . $this->db_name;
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch (PDOException $exception) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(["error" => "Database connection error: " . $exception->getMessage()]);
            exit;
        }

        return $this->conn;
    }

    private static function loadConfiguration(): array
    {
        $config = [];
        $path = __DIR__ . '/../.env';

        if (is_readable($path)) {
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                    continue;
                }
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key, " \t\n\r\0\x0B\xEF\xBB\xBF");
                $value = trim($value);
                if (strlen($value) >= 2 && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
                    $value = substr($value, 1, -1);
                }
                $config[$key] = $value;
            }
        }

        foreach (['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as $key) {
            if (!array_key_exists($key, $config)) {
                $environmentValue = getenv($key);
                if ($environmentValue !== false) {
                    $config[$key] = $environmentValue;
                }
            }
        }

        return $config;
    }
}
