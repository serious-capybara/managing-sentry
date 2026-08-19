package com.sentry.app;

import android.os.Bundle;
import android.view.View;
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
import android.view.Gravity;
import android.view.ViewGroup;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);

        View mainView = findViewById(R.id.main);
        if (mainView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(mainView, (v, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
                return insets;
            });
        }

        // Set default fragment
        if (savedInstanceState == null) {
            loadFragment(new DashboardFragment());
        }

        // Setup Sidebar Buttons with null checks
        setupSidebarButtons();

        // Setup Toggle Menu Button
        ImageButton btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        View sidebar = findViewById(R.id.dash_menu);
        View title = findViewById(R.id.title_sentry);
        View divider = findViewById(R.id.divider);
        Button dashboard = findViewById(R.id.btn_dashboard);
        Button products = findViewById(R.id.btn_products);
        Button history = findViewById(R.id.btn_history);
        Button logout = findViewById(R.id.btn_log_out);

        if (btnToggleMenu != null && sidebar != null) {
            btnToggleMenu.setOnClickListener(v -> {
                // Sidebar toggle sliding animation (400ms)
                TransitionSet set = new TransitionSet()
                    .addTransition(new Slide(Gravity.START))
                    .addTransition(new ChangeBounds())
                    .setDuration(400);
                
                TransitionManager.beginDelayedTransition((ViewGroup) findViewById(R.id.main), set);

                if (sidebar.getVisibility() == View.VISIBLE) {
                    sidebar.setVisibility(View.GONE);
                    title.setVisibility(View.GONE);
                    divider.setVisibility(View.GONE);
                    dashboard.setVisibility(View.GONE);
                    products.setVisibility(View.GONE);
                    history.setVisibility(View.GONE);
                    logout.setVisibility(View.GONE);
                    btnToggleMenu.setImageResource(R.drawable.ic_arrow_right);
                } else {
                    sidebar.setVisibility(View.VISIBLE);
                    title.setVisibility(View.VISIBLE);
                    divider.setVisibility(View.VISIBLE);
                    dashboard.setVisibility(View.VISIBLE);
                    products.setVisibility(View.VISIBLE);
                    history.setVisibility(View.VISIBLE);
                    logout.setVisibility(View.VISIBLE);
                    btnToggleMenu.setImageResource(R.drawable.ic_arrow_left);
                }
            });
        }
    }

    private void setupSidebarButtons() {
        Button btnDashboard = findViewById(R.id.btn_dashboard);
        Button btnProducts = findViewById(R.id.btn_products);
        Button btnHistory = findViewById(R.id.btn_history);

        if (btnDashboard != null) {
            btnDashboard.setOnClickListener(v -> loadFragment(new DashboardFragment()));
        }
        if (btnProducts != null) {
            btnProducts.setOnClickListener(v -> loadFragment(new ProductsFragment()));
        }
        if (btnHistory != null) {
            btnHistory.setOnClickListener(v -> loadFragment(new HistoryFragment()));
        }
    }

    private void loadFragment(Fragment fragment) {
        if (findViewById(R.id.fragment_container) != null) {
            FragmentTransaction transaction = getSupportFragmentManager().beginTransaction();
            // Simple fade transition for fragments
            transaction.setCustomAnimations(R.anim.fade_in, R.anim.fade_out);
            transaction.replace(R.id.fragment_container, fragment);
            transaction.commit();
        }
    }
}