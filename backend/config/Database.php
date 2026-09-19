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
        $this->host = getenv("DB_HOST");
        $this->port = getenv("DB_PORT");
        $this->db_name = getenv("DB_NAME");
        $this->username = getenv("DB_USER");
        $this->password = getenv("DB_PASSWORD");
    }

    public function getConnection() {
        $this->conn = null;

        try {
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
}
