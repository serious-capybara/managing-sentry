package com.sentry.app.data.remote.api;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class RetrofitClient {
    private static volatile Retrofit retrofit;
    //private static final String BASE_URL = "http://192.168.1.14:8000/";
    private static final String BASE_URL = "https://managing-sentry-app.vercel.app/";
    private static volatile String authToken;

    public static void setAuthToken(String token) {
        authToken = token;
    }

    public static String getAuthToken() {
        return authToken;
    }

    private static Retrofit getRetrofitInstance() {
        if (retrofit == null) {
            synchronized (RetrofitClient.class) {
                if (retrofit == null) {
                    Gson gson = new GsonBuilder()
                            .setStrictness(Strictness.LENIENT)
                            .create();

                    OkHttpClient okHttpClient = new OkHttpClient.Builder()
                            .addInterceptor(chain -> {
                                Request original = chain.request();
                                Request.Builder builder = original.newBuilder();
                                String token = getAuthToken();
                                if (token != null && !token.isEmpty()) {
                                    builder.header("Authorization", "Bearer " + token);
                                    builder.header("X-Token", token);
                                }
                                return chain.proceed(builder.build());
                            })
                            .connectTimeout(30, TimeUnit.SECONDS)
                            .readTimeout(30, TimeUnit.SECONDS)
                            .writeTimeout(30, TimeUnit.SECONDS)
                            .build();

                    retrofit = new Retrofit.Builder()
                            .baseUrl(BASE_URL)
                            .client(okHttpClient)
                            .addConverterFactory(GsonConverterFactory.create(gson))
                            .build();
                }
            }
        }
        return retrofit;
    }

    public static ApiService getApiService() {
        return getRetrofitInstance().create(ApiService.class);
    }
}
