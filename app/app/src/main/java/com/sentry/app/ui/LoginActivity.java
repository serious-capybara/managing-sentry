package com.sentry.app.ui;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager2.widget.CompositePageTransformer;
import androidx.viewpager2.widget.MarginPageTransformer;
import androidx.viewpager2.widget.ViewPager2;

import com.sentry.app.R;
import com.sentry.app.api.RetrofitClient;
import com.sentry.app.data.LoginRequest;
import com.sentry.app.data.SessionManager;
import com.sentry.app.data.User;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * LoginActivity handles user authentication and session management.
 * Follows Clean Code principles for separation of concerns.
 */
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
            launchDashboard();
            return;
        }

        setContentView(R.layout.login_interface);
        initializeViews();
        configureCarousel();
        configureLoginAction();
        startAutoSlide();
        checkLogoutStatus();
    }

    private void checkLogoutStatus() {
        if (getIntent().getBooleanExtra("show_logout_success", false)) {
            String userName = getIntent().getStringExtra("logged_out_username");
            if (userName == null) userName = "User";
            NotificationHelper.showNotification(this, 
                getString(R.string.notif_logout_success), 
                userName,
                getResources().getColor(R.color.pill_bg_logout, getTheme()));
        }
    }

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
        CarouselAdapter adapter = new CarouselAdapter(carouselImages);
        carouselPager.setAdapter(adapter);

        // Professional infinite scroll start position
        int midPoint = (Integer.MAX_VALUE / 2) - ((Integer.MAX_VALUE / 2) % carouselImages.length);
        carouselPager.setCurrentItem(midPoint, false);

        // Smooth sliding transformer
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
            showToast("Please enter credentials");
            return;
        }

        setLoadingState(true);
        LoginRequest request = new LoginRequest(username, password);

        RetrofitClient.getApiService().login(request).enqueue(new Callback<User>() {
            @Override
            public void onResponse(@NonNull Call<User> call, @NonNull Response<User> response) {
                setLoadingState(false);
                if (response.isSuccessful() && response.body() != null) {
                    sessionManager.saveUser(response.body());
                    launchDashboard();
                } else {
                    handleAuthError(response.code());
                }
            }

            @Override
            public void onFailure(@NonNull Call<User> call, @NonNull Throwable t) {
                setLoadingState(false);
                showToast("Network Error: " + t.getMessage());
            }
        });
    }

    private void setLoadingState(boolean isLoading) {
        loginButton.setEnabled(!isLoading);
        loginButton.setAlpha(isLoading ? 0.5f : 1.0f);
        usernameInput.setEnabled(!isLoading);
        passwordInput.setEnabled(!isLoading);
    }

    private void handleAuthError(int code) {
        String message = "Login Failed: " + code;
        if (code == 401) message = "Invalid username or password";
        else if (code == 404) message = "Service not found";
        showToast(message);
    }

    private void launchDashboard() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("show_login_success", true);
        startActivity(intent);
        finish();
    }

    private void startAutoSlide() {
        carouselHandler.postDelayed(carouselTask, 4000);
    }

    private void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        carouselHandler.removeCallbacks(carouselTask);
    }

    private static class CarouselAdapter extends RecyclerView.Adapter<CarouselAdapter.ViewHolder> {
        private final int[] items;

        CarouselAdapter(int[] items) {
            this.items = items;
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.carousel_item, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            holder.image.setImageResource(items[position % items.length]);
        }

        @Override
        public int getItemCount() {
            return Integer.MAX_VALUE;
        }

        static class ViewHolder extends RecyclerView.ViewHolder {
            final ImageView image;
            ViewHolder(View itemView) {
                super(itemView);
                image = itemView.findViewById(R.id.img_carousel_item);
            }
        }
    }
}
