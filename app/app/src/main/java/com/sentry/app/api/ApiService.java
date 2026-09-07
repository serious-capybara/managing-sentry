package com.sentry.app.api;

import com.sentry.app.data.LoginRequest;
import com.sentry.app.data.User;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface ApiService {
    @POST("login.php")
    Call<User> login(@Body LoginRequest request);
}
