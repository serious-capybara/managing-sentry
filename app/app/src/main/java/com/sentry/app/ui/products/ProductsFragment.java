package com.sentry.app.ui.products;

import com.sentry.app.R;
import com.sentry.app.ui.base.BaseFragment;
import com.sentry.app.data.local.entity.Product;
import com.sentry.app.data.repository.DataRepository;
import com.sentry.app.ui.common.NotificationHelper;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import android.widget.TextView;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class ProductsFragment extends BaseFragment {

    private List<Product> productList = new ArrayList<>();
    private final List<Product> filteredList = new ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "Sort By";
    private DataRepository repository;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isNetworkSyncDone = false;
    private boolean isSlowPillShown = false;
    private boolean isAlreadyAnimated = false;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_products, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new DataRepository(requireContext());
        hideAllRows(view);
        setupUI(view);
        setupSearchAndSort(view);
        fetchProducts(false, true);
        setupSwipeRefresh(view);
    }

    private void setupSwipeRefresh(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.sidebar_bg, R.color.sidebar_btn_primary);
        swipeRefresh.setOnRefreshListener(() -> fetchProducts(true, true));
    }

    private void hideAllRows(View view) {
        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};
        for (int id : rowIds) {
            View row = view.findViewById(id);
            if (row != null) {
                row.animate().cancel();
                row.setScaleX(1f);
                row.setScaleY(1f);
                row.setAlpha(1f);
                row.setVisibility(View.GONE);
            }
        }
    }

    private void setupSearchAndSort(View view) {
        setupSearchBar(view, new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                currentSearch = s.toString().toLowerCase().trim();
                applyFilters(false);
            }
            @Override
            public void afterTextChanged(android.text.Editable s) {}
        });

        setupSortListener(view, (parent, v, position, id) -> {
            currentSort = (String) parent.getItemAtPosition(position);
            applyFilters(true);
        });
    }

    private void applyFilters(boolean shouldAnimate) {
        filteredList.clear();
        for (Product p : productList) {
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            if (name.contains(currentSearch)) {
                filteredList.add(p);
            }
        }
        
        if (currentSort.equals("Sort By") || currentSort.equals("A-Z")) {
            filteredList.sort((p1, p2) -> {
                String n1 = p1.getName() != null ? p1.getName() : "";
                String n2 = p2.getName() != null ? p2.getName() : "";
                return n1.compareToIgnoreCase(n2);
            });
        } else if (currentSort.contains("Low on Stock")) {
            filteredList.sort(Comparator.comparingInt(Product::getStockQuantity));
        } else if (currentSort.contains("High on Stock")) {
            filteredList.sort((p1, p2) -> Integer.compare(p2.getStockQuantity(), p1.getStockQuantity()));
        }
        
        updateTableRows(filteredList, shouldAnimate);
    }

    private void fetchProducts(boolean isManualRefresh, boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;

        ViewGroup container = view.findViewById(R.id.products_content);
        if (container == null) return;

        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        
        if (isManualRefresh) {
            int cooldown = DataRepository.getProductsCooldownSeconds();
            if (cooldown > 0) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                return;
            }
            DataRepository.markProductsRefreshStarted();
        }

        if (productList.isEmpty()) showSkeleton(container, 8);

        isNetworkSyncDone = false;
        isSlowPillShown = false;
        isAlreadyAnimated = false;
        boolean firstSessionSync = !DataRepository.hasSyncedProducts();
        boolean canShowPills = isManualRefresh || firstSessionSync;

        mainHandler.postDelayed(() -> {
            if (!isNetworkSyncDone && getActivity() != null) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (canShowPills && !isSlowPillShown) {
                    isSlowPillShown = true;
                    NotificationHelper.showNotification(getActivity(), 
                        "Slow connection.", 
                        "Working with saved data...", 
                        getResources().getColor(R.color.pill_bg_logout, getActivity().getTheme()));
                }
            }
        }, 5000);

        repository.getProductsWithSafetyNet(
            data -> {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    if (!isNetworkSyncDone) {
                        hideSkeleton(container);
                        productList = data;
                        applyFilters(false);
                        if (shouldAnimate && !isManualRefresh && !isAlreadyAnimated) {
                            animateTableRows(container);
                            isAlreadyAnimated = true;
                        }
                    }
                });
            },
            new DataRepository.DataCallback<>() {
                @Override
                public void onSuccess(List<Product> data) {
                    if (getActivity() == null) return;
                    getActivity().runOnUiThread(() -> {
                        isNetworkSyncDone = true;
                        hideSkeleton(container);
                        if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                        productList = data;
                        applyFilters(false);
                        
                        if (shouldAnimate && (!isAlreadyAnimated || isManualRefresh)) {
                            animateTableRows(container);
                            isAlreadyAnimated = true;
                        }
                        
                        if (canShowPills) {
                            NotificationHelper.showNotification(getActivity(), 
                                "Products are up to date!", 
                                null, 
                                getResources().getColor(R.color.sidebar_btn_primary, getActivity().getTheme()));
                        }
                        DataRepository.markProductsSynced();
                    });
                }

                @Override
                public void onError(String error) {
                    if (getActivity() == null) return;
                    getActivity().runOnUiThread(() -> {
                        isNetworkSyncDone = true;
                        hideSkeleton(container);
                        if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    });
                }
            }
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        setupDropdown(getView(), R.id.sort_dropdown, R.array.default_options);
    }

    private void setupUI(View view) {
        setupHeader(view.findViewById(R.id.header_row));
    }

    private void setupHeader(View header) {
        if (header == null) return;
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_category, R.id.header_sales, R.id.header_subtotal, R.id.header_checkout);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_srp, R.id.header_status);
        setText(header, R.id.header_quantity, "Stock");
        setText(header, R.id.header_status, "Status");
    }

    @SuppressWarnings("all")
    private void updateTableRows(List<Product> products, boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;

        ViewGroup container = view.findViewById(R.id.products_content);
        if (container == null) return;
        hideSkeleton(container);

        View emptyStateContainer = view.findViewById(R.id.empty_state_products);
        TextView emptyView = view.findViewById(R.id.tv_empty_products);
        View scrollView = view.findViewById(R.id.products_scrollview);

        if (products.isEmpty()) {
            if (emptyStateContainer != null) {
                emptyStateContainer.setVisibility(View.VISIBLE);
                if (productList.isEmpty()) {
                    if (emptyView != null) emptyView.setText(R.string.empty_products);
                } else {
                    if (emptyView != null) emptyView.setText(R.string.products_not_found);
                }
            }
            if (scrollView != null) scrollView.setVisibility(View.GONE);
            return;
        }

        if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.GONE);
        if (scrollView != null) scrollView.setVisibility(View.VISIBLE);

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};
        int index = 0;
        for (int id : rowIds) {
            View row = view.findViewById(id);
            if (row != null) {
                if (index < products.size()) {
                    Product p = products.get(index);
                    showViews(row, R.id.row_name, R.id.row_quantity, R.id.row_srp, R.id.row_status_container);
                    hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_category, R.id.row_sales, R.id.row_subtotal, R.id.row_checkout, R.id.row_action_container, R.id.row_cart_actions);
                    
                    setText(row, R.id.row_name, p.getName());
                    setText(row, R.id.row_quantity, String.valueOf(p.getStockQuantity()));
                    setText(row, R.id.row_srp, String.format(Locale.US, "₱ %.2f", p.getRetailPrice()));
                    setText(row, R.id.row_status, p.getStatus());
                    row.setVisibility(View.VISIBLE);
                } else {
                    row.animate().cancel();
                    row.setScaleX(1f);
                    row.setScaleY(1f);
                    row.setAlpha(1f);
                    row.setVisibility(View.GONE);
                }
            }
            index++;
        }
    }
}
