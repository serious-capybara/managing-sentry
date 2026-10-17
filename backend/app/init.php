<?php

// Prevent any unexpected output from errors or notices
error_reporting(0);
ini_set('display_errors', 0);

// Simple autoloader matching folder casing
spl_autoload_register(function ($class) {
    $classPath = str_replace('\\', DIRECTORY_SEPARATOR, $class);
    $path = __DIR__ . DIRECTORY_SEPARATOR . $classPath . '.php';
    if (file_exists($path)) {
        require_once $path;
    }
});

// Load environment variables if .env exists
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            putenv(trim($parts[0]) . "=" . trim($parts[1]));
        }
    }
}

