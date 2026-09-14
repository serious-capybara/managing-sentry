package com.sentry.app.ui;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.ArrayRes;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.sentry.app.R;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;

/**
 * Base class for fragments in the Sentry app.
 * Centrally manages common UI operations and utilities.
 */
public abstract class BaseFragment extends Fragment {

    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        setupConnectionStatusMonitoring(view);
    }

    protected void setupConnectionStatusMonitoring(View root) {
        if (root == null || getContext() == null) return;
        View dot = root.findViewById(R.id.connection_status_dot);
        if (dot == null) return;

        boolean isConnected = isNetworkConnected(getContext());
        dot.setBackgroundResource(isConnected ? R.drawable.dot_green : R.drawable.dot_red);
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

    public static boolean isNetworkConnected(Context context) {
        if (context == null) return false;
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                Network activeNet = cm.getActiveNetwork();
                if (activeNet == null) return false;
                android.net.NetworkCapabilities cap = cm.getNetworkCapabilities(activeNet);
                return cap != null && (
                        cap.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                        (cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ||
                         cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) ||
                         cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET))
                );
            } else {
                NetworkInfo netInfo = cm.getActiveNetworkInfo();
                return netInfo != null && netInfo.isConnected();
            }
        } catch (Exception e) {
            return false;
        }
    }

    public void updateConnectionStatus(boolean isConnected) {
        View view = getView();
        if (view == null || getContext() == null) return;
        View dot = view.findViewById(R.id.connection_status_dot);
        if (dot != null) {
            dot.setBackgroundResource(isConnected ? R.drawable.dot_green : R.drawable.dot_red);
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
            updateConnectionStatus(isNetworkConnected(getContext()));
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        View view = getView();
        if (view != null) {
            View dot = view.findViewById(R.id.connection_status_dot);
            if (dot != null) {
                dot.clearAnimation();
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

    /**
     * Initializes a MaterialAutoCompleteTextView with items from a string array resource.
     *
     * @param view              The parent view containing the dropdown.
     * @param dropdownId        The resource ID of the dropdown view.
     * @param optionsArrayResId The resource ID of the string array containing options.
     */
    protected void setupDropdown(View view, int dropdownId, @ArrayRes int optionsArrayResId) {
        if (view == null) return;
        
        String[] options = getResources().getStringArray(optionsArrayResId);
        MaterialAutoCompleteTextView dropdown = view.findViewById(dropdownId);
        
        if (dropdown != null && options.length > 0) {
            dropdown.setSimpleItems(options);
            dropdown.setText(options[0], false);
        }
    }

    /**
     * Hides a set of views by setting their visibility to GONE.
     *
     * @param root The parent view containing the views to hide.
     * @param ids  The resource IDs of the views to hide.
     */
    protected void hideViews(View root, int... ids) {
        if (root == null) return;
        for (int id : ids) {
            View view = root.findViewById(id);
            if (view != null) {
                view.setVisibility(View.GONE);
            }
        }
    }

    /**
     * Shows a set of views by setting their visibility to VISIBLE.
     *
     * @param root The parent view containing the views to show.
     * @param ids  The resource IDs of the views to show.
     */
    protected void showViews(View root, int... ids) {
        if (root == null) return;
        for (int id : ids) {
            View view = root.findViewById(id);
            if (view != null) {
                view.setVisibility(View.VISIBLE);
            }
        }
    }

    /**
     * Sets the text of a TextView.
     *
     * @param root The parent view containing the TextView.
     * @param id   The resource ID of the TextView.
     * @param text The text to set.
     */
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
        for (int i = 0; i < count; i++) {
            View skeleton = inflater.inflate(R.layout.skeleton_row, container, false);
            skeleton.setTag("skeleton");
            skeleton.startAnimation(android.view.animation.AnimationUtils.loadAnimation(getContext(), R.anim.pulse));
            container.addView(skeleton);
        }
    }

    protected void hideSkeleton(ViewGroup container) {
        if (container == null) return;
        removeSkeletonViews(container);
    }

    private void removeSkeletonViews(ViewGroup container) {
        for (int i = container.getChildCount() - 1; i >= 0; i--) {
            View child = container.getChildAt(i);
            if ("skeleton".equals(child.getTag())) {
                child.clearAnimation();
                container.removeViewAt(i);
            }
        }
    }
}
