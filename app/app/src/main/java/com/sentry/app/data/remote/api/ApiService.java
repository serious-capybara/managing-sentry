package com.sentry.app.data.remote.api;

import com.sentry.app.data.remote.dto.ApiResponse;
import com.sentry.app.data.local.entity.History;
import com.sentry.app.data.remote.dto.LoginRequest;
import com.sentry.app.data.local.entity.Product;
import com.sentry.app.data.remote.dto.SaleRequest;
import com.sentry.app.data.remote.dto.User;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;

public interface ApiService {
    @POST("api/login.php")
    Call<User> login(@Body LoginRequest request);

    @GET("api/products.php?action=categories")
    Call<List<String>> getCategories();

    @GET("api/products.php")
    Call<List<Product>> getProducts();

    @POST("api/make_sale.php")
    Call<ApiResponse> makeSale(@Body SaleRequest request);

    @GET("api/get_history.php")
    Call<List<History>> getHistory();
}
