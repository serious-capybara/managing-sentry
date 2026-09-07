package com.sentry.app.ui;

import com.sentry.app.data.SessionManager;
import com.sentry.app.R;
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
    }

    private void updateProfileUI() {
        String fullName = sessionManager.getFullName();
        String userName = sessionManager.getUserName();

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
            btnLogout.setOnClickListener(v -> {
                sessionManager.clear();
                Intent intent = new Intent(this, LoginActivity.class);
                startActivity(intent);
                finish();
            });
        }
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

    /**
     * Toggles the visibility of the sidebar menu with a staggered animation.
     */
    private void toggleSidebar() {
        ViewGroup root = findViewById(R.id.main);
        View sidebar = findViewById(R.id.dash_menu);
        View contents = findViewById(R.id.dash_menu_contents);
        
        if (sidebar == null || contents == null || root == null) return;

        // Force finish any running transitions to prevent UI state corruption
        TransitionManager.endTransitions(root);

        boolean isVisible = sidebar.getVisibility() == View.VISIBLE;
        int nextVisibility = isVisible ? View.GONE : View.VISIBLE;
        int btnVisibility = isVisible ? View.VISIBLE : View.GONE;

        applySidebarTransition(isVisible);

        sidebar.setVisibility(nextVisibility);
        contents.setVisibility(nextVisibility);
        
        View scrim = findViewById(R.id.scrim);
        if (scrim != null) {
            scrim.setVisibility(nextVisibility);
        }
        
        View btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        if (btnToggleMenu != null) {
            btnToggleMenu.setVisibility(btnVisibility);
        }
    }

    /**
     * Applies a coordinated transition for the sidebar and scrim.
     * @param isHiding True if the menu is currently visible and being hidden.
     */
    private void applySidebarTransition(boolean isHiding) {
        TransitionSet set = new TransitionSet();
        
        // Background slides in quickly
        set.addTransition(new Slide(Gravity.START)
                .addTarget(R.id.dash_menu)
                .setDuration(300));
        
        // Scrim fades
        set.addTransition(new Fade()
                .addTarget(R.id.scrim)
                .setDuration(300));
        
        // Contents slide in with a delay when showing
        Slide contentSlide = new Slide(Gravity.START);
        contentSlide.addTarget(R.id.dash_menu_contents);
        contentSlide.setDuration(400);
        if (!isHiding) {
            contentSlide.setStartDelay(150); // Background moves first
        }
        set.addTransition(contentSlide);
        
        set.addTransition(new ChangeBounds());
        
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