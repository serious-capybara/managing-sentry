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

