package com.sentry.app.ui.base;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.TextView;

import androidx.annotation.ArrayRes;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.sentry.app.R;
import com.sentry.app.utils.NetworkUtils;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;

public abstract class BaseFragment extends Fragment {

    private ConnectivityManager.NetworkCallback networkCallback;
    protected final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        setupConnectionStatusMonitoring(view);
        setupSwipeRefreshLogic(view);
    }

    private void setupSwipeRefreshLogic(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;

        View scrollable = findScrollableChild(view);
        if (scrollable != null) {
            swipeRefresh.setOnChildScrollUpCallback((parent, child) -> scrollable.canScrollVertically(-1));
        }
    }

    private View findScrollableChild(View root) {
        View v = root.findViewById(R.id.dashboard_scrollview);
        if (v == null) v = root.findViewById(R.id.products_scrollview);
        if (v == null) v = root.findViewById(R.id.history_scrollview);
        return v;
    }

    protected void setupConnectionStatusMonitoring(View root) {
        if (root == null || getContext() == null) return;
        View dot = root.findViewById(R.id.connection_status_dot);
        if (dot == null) return;

        boolean isConnected = NetworkUtils.isNetworkConnected(getContext());
        dot.setBackgroundResource(isConnected ? R.drawable.shape_status_dot_green : R.drawable.shape_status_dot_red);
        startDotPulseAnimation(dot);

        ConnectivityManager cm = (ConnectivityManager) requireContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                if (getActivity() != null) {
                    getActivity().runOnUiThread(() -> updateConnectionStatus(true));
                }
            }

            @Override
            public void onLost(@NonNull Network network) {
                if (getActivity() != null) {
                    getActivity().runOnUiThread(() -> updateConnectionStatus(false));
                }
            }
        };

        try {
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {}
    }

    public void updateConnectionStatus(boolean isConnected) {
        View view = getView();
        if (view == null || getContext() == null) return;
        View dot = view.findViewById(R.id.connection_status_dot);
        if (dot != null) {
            dot.setBackgroundResource(isConnected ? R.drawable.shape_status_dot_green : R.drawable.shape_status_dot_red);
            startDotPulseAnimation(dot);
        }
    }

    private void startDotPulseAnimation(View dot) {
        if (dot == null || getContext() == null) return;
        dot.clearAnimation();
        android.view.animation.Animation pulse = android.view.animation.AnimationUtils.loadAnimation(getContext(), R.anim.dot_pulse);
        dot.startAnimation(pulse);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getView() != null && getContext() != null) {
            updateConnectionStatus(NetworkUtils.isNetworkConnected(getContext()));
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        mainHandler.removeCallbacksAndMessages(null); 
        
        View view = getView();
        if (view != null) {
            View dot = view.findViewById(R.id.connection_status_dot);
            if (dot != null) {
                dot.clearAnimation();
            }
            if (view instanceof ViewGroup) {
                stopAllShimmers((ViewGroup) view);
                cancelRowAnimations((ViewGroup) view);
            }
        }
        if (networkCallback != null && getContext() != null) {
            try {
                ConnectivityManager cm = (ConnectivityManager) requireContext().getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    cm.unregisterNetworkCallback(networkCallback);
                }
            } catch (Exception ignored) {}
            networkCallback = null;
        }
    }

    @SuppressWarnings("all")
    private void cancelRowAnimations(ViewGroup parent) {
        if (parent == null) return;
        for (int i = 0; i < parent.getChildCount(); i++) {
            View child = parent.getChildAt(i);
            if (child != null) {
                child.animate().cancel();
                if (child instanceof ViewGroup) {
                    cancelRowAnimations((ViewGroup) child);
                }
            }
        }
    }

    @SuppressWarnings("all")
    private void stopAllShimmers(ViewGroup parent) {
        if (parent == null) return;
        for (int i = 0; i < parent.getChildCount(); i++) {
            View child = parent.getChildAt(i);
            if (child instanceof com.facebook.shimmer.ShimmerFrameLayout) {
                ((com.facebook.shimmer.ShimmerFrameLayout) child).stopShimmer();
            } else if (child instanceof ViewGroup) {
                stopAllShimmers((ViewGroup) child);
            }
        }
    }

    protected void setupDropdown(View view, int dropdownId, @ArrayRes int optionsArrayResId) {
        if (view == null) return;
        
        String[] options = getResources().getStringArray(optionsArrayResId);
        MaterialAutoCompleteTextView dropdown = view.findViewById(dropdownId);
        
        if (dropdown != null && options.length > 0) {
            dropdown.setSimpleItems(options);
            dropdown.setText(options[0], false);
        }
    }

    protected void hideViews(View root, int... ids) {
        if (root == null) return;
        for (int id : ids) {
            View view = root.findViewById(id);
            if (view != null) {
                view.setVisibility(View.GONE);
            }
        }
    }

    protected void showViews(View root, int... ids) {
        if (root == null) return;
        for (int id : ids) {
            View view = root.findViewById(id);
            if (view != null) {
                view.setVisibility(View.VISIBLE);
            }
        }
    }

    protected void setText(View root, int id, String text) {
        if (root == null) return;
        TextView textView = root.findViewById(id);
        if (textView != null) {
            textView.setText(text);
        }
    }

    protected void setupSearchBar(View view, android.text.TextWatcher watcher) {
        if (view == null) return;
        com.google.android.material.textfield.TextInputEditText searchBar = view.findViewById(R.id.search_bar);
        if (searchBar != null) {
            searchBar.addTextChangedListener(watcher);
        }
    }

    protected void setupSortListener(View view, android.widget.AdapterView.OnItemClickListener listener) {
        if (view == null) return;
        MaterialAutoCompleteTextView dropdown = view.findViewById(R.id.sort_dropdown);
        if (dropdown != null) {
            dropdown.setOnItemClickListener(listener);
        }
    }

    @SuppressWarnings("all")
    protected void showSkeleton(ViewGroup container, int count) {
        if (container == null || getContext() == null) return;
        for (int i = 0; i < container.getChildCount(); i++) {
            View child = container.getChildAt(i);
            if (!"skeleton".equals(child.getTag())) {
                child.setVisibility(View.GONE);
            }
        }
        removeSkeletonViews(container);

        LayoutInflater inflater = LayoutInflater.from(getContext());
        View skeletonContainer = inflater.inflate(R.layout.layout_skeleton_container, container, false);
        skeletonContainer.setTag("skeleton");

        ViewGroup rowsLayout = skeletonContainer.findViewById(R.id.skeleton_rows_layout);
        if (rowsLayout != null) {
            for (int i = 0; i < count; i++) {
                View skeletonRow = inflater.inflate(R.layout.item_skeleton, rowsLayout, false);
                rowsLayout.addView(skeletonRow);
            }
        }

        container.addView(skeletonContainer);
        if (skeletonContainer instanceof com.facebook.shimmer.ShimmerFrameLayout) {
            com.facebook.shimmer.ShimmerFrameLayout shimmer = (com.facebook.shimmer.ShimmerFrameLayout) skeletonContainer;
            com.facebook.shimmer.Shimmer config = new com.facebook.shimmer.Shimmer.AlphaHighlightBuilder()
                    .setDuration(1200L)
                    .setBaseAlpha(0.45f)
                    .setHighlightAlpha(0.95f)
                    .setDirection(com.facebook.shimmer.Shimmer.Direction.LEFT_TO_RIGHT)
                    .setTilt(20f)
                    .setAutoStart(true)
                    .build();
            shimmer.setShimmer(config);
            shimmer.startShimmer();
        }
    }

    protected void hideSkeleton(ViewGroup container) {
        if (container == null) return;
        removeSkeletonViews(container);
    }

    @SuppressWarnings("all")
    private void removeSkeletonViews(ViewGroup container) {
        if (container == null) return;
        boolean found;
        do {
            found = false;
            for (int i = 0; i < container.getChildCount(); i++) {
                View child = container.getChildAt(i);
                if (child != null && "skeleton".equals(child.getTag())) {
                    if (child instanceof com.facebook.shimmer.ShimmerFrameLayout) {
                        ((com.facebook.shimmer.ShimmerFrameLayout) child).stopShimmer();
                    }
                    child.clearAnimation();
                    container.removeViewAt(i);
                    found = true;
                    break; 
                }
            }
        } while (found);
    }

    @SuppressWarnings("all")
    protected void animateTableRows(ViewGroup container) {
        if (container == null) return;
        int animatedIndex = 0;
        int maxAnimatedItems = 20; 
        
        for (int i = 0; i < container.getChildCount(); i++) {
            View child = container.getChildAt(i);
            if (child != null && child.getVisibility() == View.VISIBLE && !"skeleton".equals(child.getTag())) {
                if (animatedIndex < maxAnimatedItems) {
                    animateSingleRow(child, animatedIndex);
                } else {
                    child.setAlpha(0f);
                    child.animate().alpha(1f).setDuration(250).setStartDelay(0).start();
                }
                animatedIndex++;
            }
        }
    }

    protected void animateSingleRow(View row, int animatedIndex) {
        if (row == null) return;
        row.animate().cancel();
        row.setAlpha(0f);
        row.setTranslationY(30f);
        
        row.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(350)
                .setStartDelay(animatedIndex * 40L)
                .setInterpolator(new DecelerateInterpolator(1.2f))
                .start();
    }
}
