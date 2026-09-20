package com.sentry.app.ui.main;

import com.sentry.app.data.local.prefs.SessionManager;
import com.sentry.app.R;
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
import androidx.transition.Fade;
import androidx.transition.Slide;
import androidx.transition.TransitionManager;
import androidx.transition.TransitionSet;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private View scrim, sidebar;
    private ViewGroup sidebarContents;
    private TextView tvOfflineStatus;
    private SessionManager sessionManager;
    private int currentLevel = 0;
    private final Map<Class<? extends Fragment>, Integer> fragmentLevels = new HashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        fragmentLevels.put(DashboardFragment.class, 0);
        fragmentLevels.put(ProductsFragment.class, 1);
        fragmentLevels.put(HistoryFragment.class, 2);

        sessionManager = new SessionManager(this);
        initializeUI();
        setupInsets();
        setupNetworkMonitoring();
        setupWorker();

        if (savedInstanceState == null) {
            boolean showLoginSuccess = getIntent().getBooleanExtra("show_login_success", false);
            if (showLoginSuccess) {
                getIntent().removeExtra("show_login_success");
                NotificationHelper.showNotification(this, 
                    getString(R.string.notif_login_success), 
                    sessionManager.getFullName(),
                    getResources().getColor(R.color.sidebar_bg, getTheme()));
            }
            loadFragment(new DashboardFragment(), false);
        }
    }

    private void setupNetworkMonitoring() {
        tvOfflineStatus = findViewById(R.id.tv_offline_status);
        ViewCompat.setOnApplyWindowInsetsListener(tvOfflineStatus, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            params.topMargin = systemBars.top + (int) (16 * getResources().getDisplayMetrics().density);
            return insets;
        });
    }

    public void updateGlobalNetworkStatus(boolean isConnected) {
        if (tvOfflineStatus == null) return;
        if (isConnected) {
            if (tvOfflineStatus.getVisibility() == View.VISIBLE) {
                tvOfflineStatus.setText(R.string.status_back_online);
                tvOfflineStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.sidebar_btn_primary, getTheme())));
                tvOfflineStatus.postDelayed(this::hideOfflinePill, 2000);
            }
        } else {
            tvOfflineStatus.setVisibility(View.VISIBLE);
            tvOfflineStatus.setAlpha(1f);
            tvOfflineStatus.setText(R.string.status_offline_mode);
            tvOfflineStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.sidebar_btn_critical, getTheme())));
        }
    }

    private void hideOfflinePill() {
        tvOfflineStatus.animate().alpha(0f).setDuration(400).withEndAction(() -> {
            tvOfflineStatus.setVisibility(View.GONE);
            tvOfflineStatus.setAlpha(1f);
            tvOfflineStatus.setText(R.string.status_offline_mode);
            tvOfflineStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.sidebar_btn_critical, getTheme())));
        }).start();
    }

    private void setupInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
    }

    private void initializeUI() {
        scrim = findViewById(R.id.scrim);
        sidebar = findViewById(R.id.dash_menu);
        sidebarContents = findViewById(R.id.dash_menu_contents);
        ImageButton btnToggle = findViewById(R.id.btn_toggle_menu);

        btnToggle.setOnClickListener(v -> toggleSidebar(true));
        scrim.setOnClickListener(v -> toggleSidebar(false));

        setupProfile();
        setupNavigation();
    }

    private void setupProfile() {
        TextView tvInitials = findViewById(R.id.tv_avatar);
        TextView tvFullName = findViewById(R.id.tv_profile_full_name);
        TextView tvUserName = findViewById(R.id.tv_profile_username);

        String fullName = sessionManager.getFullName();
        String userName = sessionManager.getUsername();

        if (tvFullName != null) tvFullName.setText(fullName);
        if (tvUserName != null) tvUserName.setText(getString(R.string.username_at_placeholder, userName));
        if (tvInitials != null) tvInitials.setText(getInitials(fullName));
    }

    private String getInitials(String fullName) {
        if (fullName == null || fullName.isEmpty()) return "??";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) {
            String name = parts[0];
            return name.length() >= 2 ? (name.charAt(0) + "" + name.charAt(name.length() - 1)).toUpperCase() : name.toUpperCase();
        } else {
            return (parts[0].charAt(0) + "" + parts[parts.length - 1].charAt(0)).toUpperCase();
        }
    }

    private void setupNavigation() {
        findViewById(R.id.btn_dashboard).setOnClickListener(v -> {
            loadFragment(new DashboardFragment(), true);
            toggleSidebar(false);
        });
        findViewById(R.id.btn_products).setOnClickListener(v -> {
            loadFragment(new ProductsFragment(), true);
            toggleSidebar(false);
        });
        findViewById(R.id.btn_history).setOnClickListener(v -> {
            loadFragment(new HistoryFragment(), true);
            toggleSidebar(false);
        });
        findViewById(R.id.btn_log_out).setOnClickListener(v -> {
            showLogoutDialog();
            toggleSidebar(false);
        });
    }

    private void loadFragment(Fragment fragment, boolean animate) {
        Integer targetLevel = fragmentLevels.get(fragment.getClass());
        if (targetLevel == null) targetLevel = 0;

        FragmentTransaction ft = getSupportFragmentManager().beginTransaction();
        if (animate) {
            if (targetLevel > currentLevel) {
                ft.setCustomAnimations(R.anim.slide_in_up, R.anim.fade_out, R.anim.fade_in, R.anim.slide_out_down);
            } else if (targetLevel < currentLevel) {
                ft.setCustomAnimations(R.anim.slide_in_down, R.anim.fade_out, R.anim.fade_in, R.anim.slide_out_up);
            } else {
                ft.setCustomAnimations(R.anim.fade_in, R.anim.fade_out);
            }
        }
        currentLevel = targetLevel;
        ft.replace(R.id.fragment_container, fragment);
        ft.commit();
    }

    private void toggleSidebar(boolean show) {
        TransitionSet set = new TransitionSet()
                .addTransition(new Slide(Gravity.START).addTarget(R.id.dash_menu).addTarget(R.id.dash_menu_contents))
                .addTransition(new Fade().addTarget(R.id.scrim))
                .setDuration(300);

        TransitionManager.beginDelayedTransition((ViewGroup) findViewById(R.id.main), set);
        
        scrim.setVisibility(show ? View.VISIBLE : View.GONE);
        sidebar.setVisibility(show ? View.VISIBLE : View.GONE);
        sidebarContents.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private void showLogoutDialog() {
        LogoutDialogFragment dialog = new LogoutDialogFragment();
        dialog.setLogoutListener(this::performLogout);
        dialog.show(getSupportFragmentManager(), "LogoutDialog");
    }

    private void performLogout() {
        String userName = sessionManager.getFullName();
        sessionManager.clear();
        Intent intent = new Intent(this, LoginActivity.class);
        intent.putExtra("show_logout_success", true);
        intent.putExtra("logged_out_username", userName);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private void setupWorker() {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        OneTimeWorkRequest syncRequest = new OneTimeWorkRequest.Builder(com.sentry.app.worker.SyncWorker.class)
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(this).enqueue(syncRequest);
    }
}
