package com.sentry.app.data.remote.dto;

public class ApiResponse {
    private boolean success;
    private String message;

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }
}
