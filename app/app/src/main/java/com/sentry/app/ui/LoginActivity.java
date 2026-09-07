package com.sentry.app.ui;

import com.sentry.app.R;
import android.content.SharedPreferences;
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

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager2.widget.CompositePageTransformer;
import androidx.viewpager2.widget.MarginPageTransformer;
import androidx.viewpager2.widget.ViewPager2;

import com.sentry.app.api.RetrofitClient;
import com.sentry.app.data.LoginRequest;
import com.sentry.app.data.User;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private EditText etEmail, etPassword;
    private Button btnLogin;
    private ViewPager2 vpCarousel;

    // Carousel variables
    private final Handler carouselHandler = new Handler(Looper.getMainLooper());
    private final int[] carouselImages = {
            R.drawable.login_img_1,
            R.drawable.login_img_2,
            R.drawable.login_img_3
    };

    private final Runnable carouselRunnable = new Runnable() {
        @Override
        public void run() {
            vpCarousel.setCurrentItem(vpCarousel.getCurrentItem() + 1, true);
            carouselHandler.postDelayed(this, 4000); // Change image every 4 seconds
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Lock orientation to portrait if it's a phone (not a tablet)
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }

        // Check for existing session (7-day rule)
        if (isSessionValid()) {
            navigateToMain();
            return;
        }
        
        setContentView(R.layout.login_interface);

        initViews();
        setupCarousel();
        setupLoginListener();
        startImageCarousel();
    }

    private boolean isSessionValid() {
        SharedPreferences prefs = getSharedPreferences("sentry_prefs", MODE_PRIVATE);
        int userId = prefs.getInt("user_id", -1);
        long lastUse = prefs.getLong("last_use_timestamp", 0);
        
        if (userId == -1) return false;

        long sevenDaysMillis = 7L * 24 * 60 * 60 * 1000;
        return (System.currentTimeMillis() - lastUse) < sevenDaysMillis;
    }

    private void initViews() {
        etEmail = findViewById(R.id.et_email);
        etPassword = findViewById(R.id.et_password);
        btnLogin = findViewById(R.id.btn_login);
        vpCarousel = findViewById(R.id.vp_carousel);
    }

    private void setupCarousel() {
        CarouselAdapter adapter = new CarouselAdapter(carouselImages);
        vpCarousel.setAdapter(adapter);
        
        // Set current item to a large number to enable pseudo-infinite scrolling
        // Starting at a multiple of images.length to ensure we start at the first image
        int initialPosition = (Integer.MAX_VALUE / 2) - ((Integer.MAX_VALUE / 2) % carouselImages.length);
        vpCarousel.setCurrentItem(initialPosition, false);

        // Simple smooth slide transition
        CompositePageTransformer compositePageTransformer = new CompositePageTransformer();
        compositePageTransformer.addTransformer(new MarginPageTransformer(40));
        compositePageTransformer.addTransformer((page, position) -> {
            float r = 1 - Math.abs(position);
            page.setScaleY(0.85f + r * 0.15f);
            page.setAlpha(0.5f + r * 0.5f);
        });
        
        vpCarousel.setPageTransformer(compositePageTransformer);
    }

    private void setupLoginListener() {
        btnLogin.setOnClickListener(v -> {
            String userName = etEmail.getText().toString().trim();
            String password = etPassword.getText().toString().trim();

            if (userName.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please enter username and password", Toast.LENGTH_SHORT).show();
                return;
            }

            RetrofitClient.getApiService().login(new LoginRequest(userName, password))
                    .enqueue(new Callback<User>() {
                        @Override
                        public void onResponse(Call<User> call, Response<User> response) {
                            if (response.isSuccessful() && response.body() != null) {
                                saveUser(response.body());
                                navigateToMain();
                            } else {
                                String errorMsg = "Login Failed: " + response.code();
                                if (response.code() == 404) errorMsg = "Server file not found (404)";
                                if (response.code() == 401) errorMsg = "Invalid username or password (401)";
                                Toast.makeText(LoginActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                            }
                        }

                        @Override
                        public void onFailure(Call<User> call, Throwable t) {
                            Toast.makeText(LoginActivity.this, "Network Error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
        });
    }

    private void saveUser(User user) {
        SharedPreferences prefs = getSharedPreferences("sentry_prefs", MODE_PRIVATE);
        prefs.edit()
                .putInt("user_id", user.getUserId())
                .putString("full_name", user.getFullName())
                .putString("user_name", user.getUserName())
                .putString("role", user.getRole())
                .putLong("last_use_timestamp", System.currentTimeMillis())
                .apply();
    }

    private void startImageCarousel() {
        carouselHandler.postDelayed(carouselRunnable, 4000);
    }

    private void navigateToMain() {
        Intent intent = new Intent(this, MainActivity.class);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        carouselHandler.removeCallbacks(carouselRunnable);
    }

    // Inner Adapter for Carousel
    private static class CarouselAdapter extends RecyclerView.Adapter<CarouselAdapter.ViewHolder> {
        private final int[] images;

        CarouselAdapter(int[] images) {
            this.images = images;
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.carousel_item, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            holder.imageView.setImageResource(images[position % images.length]);
        }

        @Override
        public int getItemCount() {
            return Integer.MAX_VALUE;
        }

        static class ViewHolder extends RecyclerView.ViewHolder {
            ImageView imageView;
            ViewHolder(View itemView) {
                super(itemView);
                imageView = itemView.findViewById(R.id.img_carousel_item);
            }
        }
    }
}