package com.sentry.app.ui.auth;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.EditText;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.viewpager2.widget.CompositePageTransformer;
import androidx.viewpager2.widget.MarginPageTransformer;
import androidx.viewpager2.widget.ViewPager2;

import com.sentry.app.R;
import com.sentry.app.data.remote.api.RetrofitClient;
import com.sentry.app.data.remote.dto.LoginRequest;
import com.sentry.app.data.local.prefs.SessionManager;
import com.sentry.app.data.remote.dto.User;
import com.google.gson.Gson;
import com.sentry.app.ui.adapter.CarouselAdapter;
import com.sentry.app.ui.common.NotificationHelper;
import com.sentry.app.ui.main.MainActivity;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private EditText usernameInput, passwordInput;
    private Button loginButton;
    private ViewPager2 carouselPager;
    private SessionManager sessionManager;

    private final Handler carouselHandler = new Handler(Looper.getMainLooper());
    private final int[] carouselImages = {
            R.drawable.login_img_1,
            R.drawable.login_img_2,
            R.drawable.login_img_3
    };

    private final Runnable carouselTask = new Runnable() {
        @Override
        public void run() {
            int nextItem = carouselPager.getCurrentItem() + 1;
            carouselPager.setCurrentItem(nextItem, true);
            carouselHandler.postDelayed(this, 4000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
        
        setupOrientationMode();
        sessionManager = new SessionManager(this);

        if (sessionManager.isSessionActive()) {
            launchDashboard(false);
            return;
        }

        setContentView(R.layout.activity_login);
        initializeViews();
        configureCarousel();
        configureLoginAction();
        startAutoSlide();
        checkLogoutStatus();
    }

    @SuppressWarnings("all")
    private void checkLogoutStatus() {
        if (getIntent().getBooleanExtra("show_logout_success", false)) {
            getIntent().removeExtra("show_logout_success");
            String rawUserName = getIntent().getStringExtra("logged_out_username");
            String userName;
            if (rawUserName != null) {
                userName = rawUserName;
            } else {
                userName = "User";
            }
            
            NotificationHelper.showNotification(this, 
                getString(R.string.notif_logout_success), 
                userName,
                getResources().getColor(R.color.pill_bg_logout, getTheme()));
        }
    }

    @SuppressWarnings("all")
    private void setupOrientationMode() {
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }

    private void initializeViews() {
        usernameInput = findViewById(R.id.et_email);
        passwordInput = findViewById(R.id.et_password);
        loginButton = findViewById(R.id.btn_login);
        carouselPager = findViewById(R.id.vp_carousel);
    }

    private void configureCarousel() {
        carouselPager.setAdapter(new CarouselAdapter(carouselImages));

        int midPoint = (Integer.MAX_VALUE / 2) - ((Integer.MAX_VALUE / 2) % carouselImages.length);
        carouselPager.setCurrentItem(midPoint, false);

        CompositePageTransformer transformer = new CompositePageTransformer();
        transformer.addTransformer(new MarginPageTransformer(40));
        transformer.addTransformer((page, position) -> {
            float range = 1 - Math.abs(position);
            page.setScaleY(0.85f + range * 0.15f);
            page.setAlpha(0.5f + range * 0.5f);
        });
        carouselPager.setPageTransformer(transformer);
    }

    private void configureLoginAction() {
        loginButton.setOnClickListener(v -> performLogin());
    }

    private void performLogin() {
        String username = usernameInput.getText().toString().trim();
        String password = passwordInput.getText().toString().trim();

        if (username.isEmpty() || password.isEmpty()) {
            showErrorNotification("Please enter credentials");
            return;
        }

        setLoadingState(true);
        LoginRequest request = new LoginRequest(username, password);

        RetrofitClient.getApiService().login(request).enqueue(new Callback<>() {
            @Override
            public void onResponse(@NonNull Call<User> call, @NonNull Response<User> response) {
                setLoadingState(false);
                if (response.isSuccessful() && response.body() != null) {
                    sessionManager.saveUser(response.body());
                    launchDashboard(true);
                } else {
                    handleLoginError(response);
                }
            }

            @Override
            public void onFailure(@NonNull Call<User> call, @NonNull Throwable t) {
                setLoadingState(false);
                showErrorNotification("Network Connection Error");
            }
        });
    }

    private void handleLoginError(Response<User> response) {
        String errorMessage = determineErrorMessage(response);
        showErrorNotification(errorMessage);
    }

    private String determineErrorMessage(Response<User> response) {
        try (okhttp3.ResponseBody errorBody = response.errorBody()) {
            if (errorBody != null) {
                String errorJson = errorBody.string();
                ErrorResponse errorObj = new Gson().fromJson(errorJson, ErrorResponse.class);
                if (errorObj != null && errorObj.error != null) {
                    return errorObj.error;
                }
            } else {
                switch (response.code()) {
                    case 401:
                        return "Invalid username or password";
                    case 404:
                        return "Service unavailable";
                    default:
                        break;
                }
            }
        } catch (Exception ignored) {}
        return "Login Failed";
    }

    private void setLoadingState(boolean isLoading) {
        loginButton.setEnabled(!isLoading);
        loginButton.setAlpha(isLoading ? 0.5f : 1.0f);
        usernameInput.setEnabled(!isLoading);
        passwordInput.setEnabled(!isLoading);
    }

    private void launchDashboard(boolean isFirstLogin) {
        Intent intent = new Intent(this, MainActivity.class);
        if (isFirstLogin) {
            intent.putExtra("show_login_success", true);
        }
        startActivity(intent);
        finish();
    }

    private void startAutoSlide() {
        carouselHandler.postDelayed(carouselTask, 4000);
    }

    private void showErrorNotification(String message) {
        NotificationHelper.showNotification(this, 
            message, 
            null,
            getResources().getColor(R.color.pill_bg_logout, getTheme()));
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        carouselHandler.removeCallbacks(carouselTask);
    }

    private static class ErrorResponse {
        String error;
    }
}
