package com.sentry.app.ui.main;

import com.sentry.app.data.local.prefs.SessionManager;
import com.sentry.app.R;
import com.sentry.app.utils.NetworkUtils;
import com.sentry.app.ui.dashboard.DashboardFragment;
import com.sentry.app.ui.products.ProductsFragment;
import com.sentry.app.ui.history.HistoryFragment;
import com.sentry.app.ui.common.LogoutDialogFragment;
import com.sentry.app.ui.auth.LoginActivity;
import com.sentry.app.ui.common.NotificationHelper;

import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import androidx.transition.ChangeBounds;
import androidx.transition.Fade;
import androidx.transition.Slide;
import androidx.transition.TransitionManager;
import androidx.transition.TransitionSet;

public class MainActivity extends AppCompatActivity {

    private int currentFragmentIndex = 0;
    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        
        sessionManager = new SessionManager(this);
        sessionManager.refreshTimestamp();

        if (savedInstanceState != null) {
            currentFragmentIndex = savedInstanceState.getInt("current_fragment_index", 0);
        }

        setupEdgeToEdge();
        setupNavigation(savedInstanceState);
        setupSidebarButtons();
        setupToggleMenu();
        setupScrim();
        updateProfileUI();
        checkLoginStatus();
        scheduleSync();
        monitorConnectivity();
    }

    private void monitorConnectivity() {
        boolean isConnected = NetworkUtils.isNetworkConnected(this);
        TextView status = findViewById(R.id.tv_offline_status);
        if (status != null) {
            status.setVisibility(isConnected ? View.GONE : View.VISIBLE);
        }

        android.net.ConnectivityManager connectivityManager = (android.net.ConnectivityManager) getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;

        connectivityManager.registerDefaultNetworkCallback(new android.net.ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull android.net.Network network) {
                runOnUiThread(() -> {
                    TextView tvStatus = findViewById(R.id.tv_offline_status);
                    if (tvStatus != null && tvStatus.getVisibility() == View.VISIBLE) {
                        tvStatus.setText("Back Online");
                        tvStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#22C55E")));
                        tvStatus.postDelayed(() -> {
                            tvStatus.animate().alpha(0f).setDuration(400).withEndAction(() -> {
                                tvStatus.setVisibility(View.GONE);
                                tvStatus.setAlpha(1f);
                                tvStatus.setText("Offline Mode");
                                tvStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.sidebar_btn_critical, getTheme())));
                            }).start();
                        }, 2000);
                    }

                    // Immediately sync any offline sales — don't wait for the 15-min periodic window
                    androidx.work.OneTimeWorkRequest immediateSyncRequest =
                            new androidx.work.OneTimeWorkRequest.Builder(
                                    com.sentry.app.worker.SyncWorker.class).build();
                    androidx.work.WorkManager.getInstance(MainActivity.this)
                            .enqueue(immediateSyncRequest);
                });
            }

            @Override
            public void onLost(@NonNull android.net.Network network) {
                runOnUiThread(() -> {
                    TextView tvStatus = findViewById(R.id.tv_offline_status);
                    if (tvStatus != null) {
                        tvStatus.animate().cancel();
                        tvStatus.setAlpha(1f);
                        tvStatus.setText("Offline Mode");
                        tvStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.sidebar_btn_critical, getTheme())));
                        tvStatus.setVisibility(View.VISIBLE);
                    }
                });
            }
        });
    }


    private void scheduleSync() {
        androidx.work.Constraints constraints = new androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build();

        androidx.work.PeriodicWorkRequest syncRequest =
                new androidx.work.PeriodicWorkRequest.Builder(com.sentry.app.worker.SyncWorker.class, 15, java.util.concurrent.TimeUnit.MINUTES)
                        .setConstraints(constraints)
                        .build();

        androidx.work.WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "SentrySync",
                androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
        );
    }

    private void checkLoginStatus() {
        if (getIntent().getBooleanExtra("show_login_success", false)) {
            getIntent().removeExtra("show_login_success");
            String userName = sessionManager.getUsername();
            NotificationHelper.showNotification(this, 
                getString(R.string.notif_login_success), 
                userName,
                getResources().getColor(R.color.sidebar_bg, getTheme()));
        }
    }

    private void updateProfileUI() {
        String fullName = sessionManager.getFullName();
        String userName = sessionManager.getUsername();

        TextView tvFullName = findViewById(R.id.tv_profile_full_name);
        TextView tvUserName = findViewById(R.id.tv_profile_username);
        TextView tvAvatar = findViewById(R.id.tv_avatar);

        if (tvFullName != null) tvFullName.setText(fullName);
        if (tvUserName != null) tvUserName.setText("@" + userName);

        if (tvAvatar != null && fullName != null && !fullName.isEmpty()) {
            String initials = getInitials(fullName);
            tvAvatar.setText(initials);
        }
    }

    private String getInitials(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) {
            String name = parts[0];
            if (name.length() >= 2) {
                return (name.substring(0, 1) + name.substring(name.length() - 1)).toUpperCase();
            }
            return name.toUpperCase();
        } else {
            String firstPart = parts[0];
            String lastPart = parts[parts.length - 1];
            return (firstPart.substring(0, 1) + lastPart.substring(0, 1)).toUpperCase();
        }
    }

    private void setupScrim() {
        View scrim = findViewById(R.id.scrim);
        if (scrim != null) {
            scrim.setOnClickListener(v -> toggleSidebar());
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt("current_fragment_index", currentFragmentIndex);
    }

    private void setupEdgeToEdge() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        View mainView = findViewById(R.id.main);
        if (mainView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(mainView, (v, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
                return insets;
            });
        }
    }

    private void setupNavigation(Bundle savedInstanceState) {
        if (savedInstanceState == null) {
            loadFragment(new DashboardFragment(), 0);
        }
    }

    private void setupSidebarButtons() {
        setSidebarClickListener(R.id.btn_dashboard, new DashboardFragment(), 0);
        setSidebarClickListener(R.id.btn_products, new ProductsFragment(), 1);
        setSidebarClickListener(R.id.btn_history, new HistoryFragment(), 2);

        Button btnLogout = findViewById(R.id.btn_log_out);
        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> showLogoutConfirmation());
        }
    }

    private void showLogoutConfirmation() {
        LogoutDialogFragment dialog = new LogoutDialogFragment();
        dialog.setLogoutListener(() -> {
            String userName = sessionManager.getUsername();
            sessionManager.clear();
            Intent intent = new Intent(this, LoginActivity.class);
            intent.putExtra("show_logout_success", true);
            intent.putExtra("logged_out_username", userName);
            startActivity(intent);
            finish();
        });
        dialog.show(getSupportFragmentManager(), "LogoutDialog");
    }

    private void setSidebarClickListener(int buttonId, Fragment fragment, int index) {
        Button button = findViewById(buttonId);
        if (button != null) {
            button.setOnClickListener(v -> {
                loadFragment(fragment, index);
                toggleSidebar();
            });
        }
    }

    private void setupToggleMenu() {
        ImageButton btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        if (btnToggleMenu != null) {
            btnToggleMenu.setOnClickListener(v -> toggleSidebar());
        }
    }

    private void toggleSidebar() {
        ViewGroup root = findViewById(R.id.main);
        View sidebar = findViewById(R.id.dash_menu);
        View contents = findViewById(R.id.dash_menu_contents);
        
        if (sidebar == null || contents == null || root == null) return;

        TransitionManager.endTransitions(root);

        boolean isVisible = sidebar.getVisibility() == View.VISIBLE;
        int nextVisibility = isVisible ? View.GONE : View.VISIBLE;

        applySidebarTransition(isVisible);

        sidebar.setVisibility(nextVisibility);
        contents.setVisibility(nextVisibility);
        
        View scrim = findViewById(R.id.scrim);
        if (scrim != null) {
            scrim.setVisibility(nextVisibility);
        }
        
        View btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        if (btnToggleMenu != null) {
            btnToggleMenu.setVisibility(View.VISIBLE);
            btnToggleMenu.setClickable(isVisible);
        }
    }

    private void applySidebarTransition(boolean isHiding) {
        TransitionSet set = new TransitionSet();
        set.setOrdering(TransitionSet.ORDERING_TOGETHER);

        long duration = 300;
        android.view.animation.Interpolator interpolator = new androidx.interpolator.view.animation.FastOutSlowInInterpolator();

        Slide sidebarSlide = new Slide(Gravity.START);
        sidebarSlide.addTarget(R.id.dash_menu);
        sidebarSlide.setDuration(duration);
        sidebarSlide.setInterpolator(interpolator);
        set.addTransition(sidebarSlide);

        Slide contentSlide = new Slide(Gravity.START);
        contentSlide.addTarget(R.id.dash_menu_contents);
        contentSlide.setDuration(duration);
        contentSlide.setInterpolator(interpolator);
        set.addTransition(contentSlide);

        Fade scrimFade = new Fade();
        scrimFade.addTarget(R.id.scrim);
        scrimFade.setDuration(duration);
        set.addTransition(scrimFade);

        set.addTransition(new ChangeBounds().setDuration(duration));

        TransitionManager.beginDelayedTransition((ViewGroup) findViewById(R.id.main), set);
    }

    private void loadFragment(Fragment fragment, int targetIndex) {
        if (findViewById(R.id.fragment_container) != null) {
            FragmentTransaction transaction = getSupportFragmentManager().beginTransaction();
            
            if (targetIndex > currentFragmentIndex) {
                transaction.setCustomAnimations(R.anim.slide_in_up, R.anim.slide_out_up);
            } else if (targetIndex < currentFragmentIndex) {
                transaction.setCustomAnimations(R.anim.slide_in_down, R.anim.slide_out_down);
            }
            
            currentFragmentIndex = targetIndex;
            transaction.replace(R.id.fragment_container, fragment);
            transaction.commit();
        }
    }
}
