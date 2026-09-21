package com.sentry.app.ui.products;

import com.sentry.app.R;
import com.sentry.app.ui.base.BaseFragment;
import com.sentry.app.data.local.entity.Product;
import com.sentry.app.data.repository.DataRepository;
import com.sentry.app.ui.common.NotificationHelper;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

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
    private boolean isNetworkSyncDone = false;
    private boolean isSlowPillShown = false;
    private boolean isAlreadyAnimated = false;
    private boolean isBatchLoadingPending = false;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_products, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new DataRepository(requireContext());
        setupUI(view);
        setupSearchAndSort(view);
        
        mainHandler.postDelayed(() -> {
            if (isAdded()) fetchProducts(false, true);
        }, 500);
        
        setupSwipeRefresh(view);
    }

    private void setupSwipeRefresh(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.sidebar_bg, R.color.sidebar_btn_primary);
        swipeRefresh.setOnRefreshListener(() -> fetchProducts(true, true));
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
        
        updateTableRows(shouldAnimate);
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
        isBatchLoadingPending = false;
        boolean firstSessionSync = !DataRepository.hasSyncedProducts();
        boolean canShowPills = isManualRefresh || firstSessionSync;

        mainHandler.postDelayed(() -> {
            if (!isNetworkSyncDone && isAdded()) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (canShowPills && !isSlowPillShown && repository.isOnline()) {
                    isSlowPillShown = true;
                    NotificationHelper.showNotification(getActivity(), 
                        "Slow connection.", 
                        "Working with saved data...", 
                        getResources().getColor(R.color.pill_bg_logout, requireActivity().getTheme()));
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
                        
                        boolean needsAnimation = shouldAnimate && !isManualRefresh && !isAlreadyAnimated;
                        applyFilters(needsAnimation);
                        if (needsAnimation) isAlreadyAnimated = true;
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
                        
                        boolean needsAnimation = shouldAnimate && (!isAlreadyAnimated || isManualRefresh);
                        applyFilters(needsAnimation);
                        if (needsAnimation) isAlreadyAnimated = true;
                        
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
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_category, R.id.header_sales, R.id.header_subtotal, R.id.header_status);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_srp, R.id.header_status);
        setText(header, R.id.header_quantity, "Stock");
        setText(header, R.id.header_status, "Status");
    }

    @SuppressWarnings("all")
    private void updateTableRows(boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;

        ViewGroup container = view.findViewById(R.id.products_content);
        if (container == null) return;
        hideSkeleton(container);

        View emptyStateContainer = view.findViewById(R.id.empty_state_products);
        View scrollView = view.findViewById(R.id.products_scrollview);

        if (filteredList.isEmpty()) {
            if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.VISIBLE);
            if (scrollView != null) scrollView.setVisibility(View.GONE);
            container.removeAllViews();
            isBatchLoadingPending = false;
            return;
        }

        if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.GONE);
        if (scrollView != null) scrollView.setVisibility(View.VISIBLE);

        int currentChildCount = container.getChildCount();
        int targetCount = filteredList.size();
        int maxInitialItems = 20;

        int initialLimit;
        if (shouldAnimate) {
            initialLimit = Math.min(targetCount, maxInitialItems);
            isBatchLoadingPending = targetCount > maxInitialItems;
        } else if (isBatchLoadingPending) {
            initialLimit = Math.min(targetCount, maxInitialItems);
        } else {
            initialLimit = targetCount;
        }

        if (currentChildCount > initialLimit) {
            container.removeViews(initialLimit, currentChildCount - initialLimit);
        }

        for (int i = 0; i < initialLimit; i++) {
            Product p = filteredList.get(i);
            View row;
            if (i < container.getChildCount()) {
                row = container.getChildAt(i);
            } else {
                row = LayoutInflater.from(requireContext()).inflate(R.layout.item_product, container, false);
                container.addView(row);
            }
            bindProductRow(row, p);
        }

        if (shouldAnimate) {
            animateTableRows(container);
            
            if (isBatchLoadingPending) {
                mainHandler.postDelayed(() -> {
                    if (!isAdded()) return;
                    isBatchLoadingPending = false;
                    for (int i = maxInitialItems; i < filteredList.size(); i++) {
                        View row = LayoutInflater.from(requireContext()).inflate(R.layout.item_product, container, false);
                        container.addView(row);
                        bindProductRow(row, filteredList.get(i));
                        row.setAlpha(0f);
                        row.animate().alpha(1f).setDuration(400).start();
                    }
                }, 900);
            }
        }
    }

    private void bindProductRow(View row, Product p) {
        showViews(row, R.id.row_name, R.id.row_quantity, R.id.row_srp, R.id.row_status_container);
        hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_category, R.id.row_sales, R.id.row_subtotal, R.id.row_checkout, R.id.row_action_container, R.id.row_cart_actions);
        
        setText(row, R.id.row_name, p.getName());
        setText(row, R.id.row_quantity, String.valueOf(p.getStockQuantity()));
        setText(row, R.id.row_srp, String.format(Locale.US, "₱ %.2f", p.getRetailPrice()));
        setText(row, R.id.row_status, p.getStatus());
        row.setVisibility(View.VISIBLE);
    }
}
