package com.sentry.app.api;

import com.sentry.app.data.ApiResponse;
import com.sentry.app.data.History;
import com.sentry.app.data.LoginRequest;
import com.sentry.app.data.Product;
import com.sentry.app.data.SaleRequest;
import com.sentry.app.data.User;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;

public interface ApiService {
    @POST("login.php")
    Call<User> login(@Body LoginRequest request);

    @GET("get_categories.php")
    Call<List<String>> getCategories();

    @GET("get_products.php")
    Call<List<Product>> getProducts();

    @POST("make_sale.php")
    Call<ApiResponse> makeSale(@Body SaleRequest request);

    @GET("get_history.php")
    Call<List<History>> getHistory();
}
