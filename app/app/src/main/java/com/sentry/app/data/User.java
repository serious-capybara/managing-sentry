package com.sentry.app.data;

import com.google.gson.annotations.SerializedName;

public class User {
    @SerializedName("user_id")
    private int userId;
    
    @SerializedName("full_name")
    private String fullName;
    
    @SerializedName("user_name")
    private String userName;
    
    private String role;

    public int getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getUserName() {
        return userName;
    }

    public String getRole() {
        return role;
    }
}
