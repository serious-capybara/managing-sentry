package com.sentry.app.data;

import com.google.gson.annotations.SerializedName;

public class LoginRequest {
    @SerializedName("user_name")
    private String userName;
    
    private String password;

    public LoginRequest(String userName, String password) {
        this.userName = userName;
        this.password = password;
    }
}
