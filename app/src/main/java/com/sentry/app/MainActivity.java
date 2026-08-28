package com.sentry.app;

import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageButton;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import androidx.transition.ChangeBounds;
import androidx.transition.Fade;
import androidx.transition.Slide;
import androidx.transition.TransitionManager;
import androidx.transition.TransitionSet;

public class MainActivity extends AppCompatActivity {

    private int currentFragmentIndex = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);

        if (savedInstanceState != null) {
            currentFragmentIndex = savedInstanceState.getInt("current_fragment_index", 0);
        }

        setupEdgeToEdge();
        setupNavigation(savedInstanceState);
        setupSidebarButtons();
        setupToggleMenu();
        setupScrim();
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
        View sidebar = findViewById(R.id.dash_menu);
        View contents = findViewById(R.id.dash_menu_contents);
        if (sidebar == null || contents == null) return;

        boolean isVisible = sidebar.getVisibility() == View.VISIBLE;
        
        applySidebarTransition(isVisible);

        int targetVisibility = isVisible ? View.GONE : View.VISIBLE;
        int btnVisibility = isVisible ? View.VISIBLE : View.GONE;

        sidebar.setVisibility(targetVisibility);
        contents.setVisibility(targetVisibility);
        
        View scrim = findViewById(R.id.scrim);
        if (scrim != null) scrim.setVisibility(targetVisibility);
        
        View btnToggleMenu = findViewById(R.id.btn_toggle_menu);
        if (btnToggleMenu != null) {
            btnToggleMenu.setVisibility(btnVisibility);
        }
    }

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