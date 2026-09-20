package com.sentry.app.data.remote.dto;

import com.google.gson.annotations.SerializedName;

public class User {
    @SerializedName("user_id")
    private int userId;
    
    @SerializedName("full_name")
    private String fullName;
    
    @SerializedName("username")
    private String username;
    
    private String role;

    public int getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getUsername() {
        return username;
    }

    public String getRole() {
        return role;
    }
}
