package com.sentry.app;

import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageButton;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import androidx.transition.ChangeBounds;
import androidx.transition.Slide;
import androidx.transition.TransitionManager;
import androidx.transition.TransitionSet;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);

        setupEdgeToEdge();
        setupNavigation(savedInstanceState);
        setupSidebarButtons();
        setupToggleMenu();
    }

    private void setupEdgeToEdge() {
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
            loadFragment(new DashboardFragment());
        }
    }

    private void setupSidebarButtons() {
        setSidebarClickListener(R.id.btn_dashboard, new DashboardFragment());
        setSidebarClickListener(R.id.btn_products, new ProductsFragment());
        setSidebarClickListener(R.id.btn_history, new HistoryFragment());
    }

    private void setSidebarClickListener(int buttonId, Fragment fragment) {
        Button button = findViewById(buttonId);
        if (button != null) {
            button.setOnClickListener(v -> loadFragment(fragment));
        }
    }

    private void setupToggleMenu() {
        ImageButton btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        if (btnToggleMenu != null) {
            btnToggleMenu.setOnClickListener(v -> toggleSidebar());
        }
    }

    private void toggleSidebar() {
        View sidebar = findViewById(R.id.dash_menu);
        if (sidebar == null) return;

        applySidebarTransition();

        boolean isVisible = sidebar.getVisibility() == View.VISIBLE;
        int targetVisibility = isVisible ? View.GONE : View.VISIBLE;
        int arrowIcon = isVisible ? R.drawable.ic_arrow_right : R.drawable.ic_arrow_left;

        sidebar.setVisibility(targetVisibility);
        setViewsVisibility(targetVisibility, R.id.title_sentry, R.id.divider, R.id.btn_dashboard, R.id.btn_products, R.id.btn_history, R.id.btn_log_out);
        
        ImageButton btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        if (btnToggleMenu != null) {
            btnToggleMenu.setImageResource(arrowIcon);
        }
    }

    private void applySidebarTransition() {
        TransitionSet set = new TransitionSet()
                .addTransition(new Slide(Gravity.START))
                .addTransition(new ChangeBounds())
                .setDuration(400);
        TransitionManager.beginDelayedTransition((ViewGroup) findViewById(R.id.main), set);
    }

    private void setViewsVisibility(int visibility, int... ids) {
        for (int id : ids) {
            View view = findViewById(id);
            if (view != null) {
                view.setVisibility(visibility);
            }
        }
    }

    private void loadFragment(Fragment fragment) {
        if (findViewById(R.id.fragment_container) != null) {
            FragmentTransaction transaction = getSupportFragmentManager().beginTransaction();
            transaction.setCustomAnimations(R.anim.fade_in, R.anim.fade_out);
            transaction.replace(R.id.fragment_container, fragment);
            transaction.commit();
        }
    }
}