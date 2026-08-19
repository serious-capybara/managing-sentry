package com.sentry.app;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;

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
            transaction.replace(R.id.fragment_container, fragment);
            transaction.commit();
        }
    }
}