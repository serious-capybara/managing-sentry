package com.sentry.app.ui;

import com.sentry.app.R;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.sentry.app.data.Product;

import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Products Fragment - Displays a detailed list of products and stock status.
 */
public class ProductsFragment extends BaseFragment {

    private java.util.List<Product> productList = new java.util.ArrayList<>();
    private java.util.List<Product> filteredList = new java.util.ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "A-Z";
    private com.sentry.app.data.repo.DataRepository repository;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_products, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new com.sentry.app.data.repo.DataRepository(requireContext());
        hideAllRows(view);
        setupUI(view);
        setupSearchAndSort(view);
        fetchProducts();
        setupSwipeRefresh(view);
    }

    private void setupSwipeRefresh(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.sidebar_bg, R.color.sidebar_btn_primary);
        swipeRefresh.setOnRefreshListener(() -> fetchProducts());
    }

    private void hideAllRows(View view) {
        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};
        for (int id : rowIds) {
            View row = view.findViewById(id);
            if (row != null) row.setVisibility(View.GONE);
        }
    }

    private void setupSearchAndSort(View view) {
        setupSearchBar(view, new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                currentSearch = s.toString().toLowerCase().trim();
                applyFilters();
            }
            @Override
            public void afterTextChanged(android.text.Editable s) {}
        });

        setupSortListener(view, (parent, v, position, id) -> {
            currentSort = (String) parent.getItemAtPosition(position);
            applyFilters();
        });
    }

    private void applyFilters() {
        filteredList.clear();
        for (Product p : productList) {
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            boolean matchesSearch = name.contains(currentSearch);
            
            if (matchesSearch) {
                filteredList.add(p);
            }
        }
        
        if (currentSort.equals("A-Z")) {
            filteredList.sort((p1, p2) -> {
                String n1 = p1.getName() != null ? p1.getName() : "";
                String n2 = p2.getName() != null ? p2.getName() : "";
                return n1.compareToIgnoreCase(n2);
            });
        } else if (currentSort.contains("Low on Stock")) {
            filteredList.sort((p1, p2) -> Integer.compare(p1.getStockQuantity(), p2.getStockQuantity()));
        } else if (currentSort.contains("High on Stock")) {
            filteredList.sort((p1, p2) -> Integer.compare(p2.getStockQuantity(), p1.getStockQuantity()));
        }
        
        updateTableRows(filteredList);
    }

    private void fetchProducts() {
        ViewGroup container = getView().findViewById(R.id.products_content);
        View view = getView();
        SwipeRefreshLayout swipeRefresh = view != null ? view.findViewById(R.id.swipe_refresh) : null;
        if (swipeRefresh == null || !swipeRefresh.isRefreshing()) showSkeleton(container, 8);

        repository.getProducts(true, new com.sentry.app.data.repo.DataRepository.DataCallback<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    productList = data;
                    applyFilters();
                });
            }

            @Override
            public void onError(String error) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    productList.clear();
                    applyFilters();
                });
            }
        });
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
        // Products Table: Name, Stock, SRP, Status
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_category, R.id.header_sales, R.id.header_subtotal, R.id.header_checkout);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_srp, R.id.header_status);
        setText(header, R.id.header_quantity, "Stock");
        setText(header, R.id.header_status, "Status");
    }

    private void updateTableRows(List<Product> products) {
        View view = getView();
        if (view == null) return;

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null) {
                if (i < products.size()) {
                    Product p = products.get(i);
                    showViews(row, R.id.row_name, R.id.row_quantity, R.id.row_srp, R.id.row_status);
                    hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_category, R.id.row_sales, R.id.row_subtotal, R.id.row_checkout, R.id.row_action_container, R.id.row_cart_actions);
                    
                    setText(row, R.id.row_name, p.getName());
                    setText(row, R.id.row_quantity, String.valueOf(p.getStockQuantity()));
                    setText(row, R.id.row_srp, String.format(Locale.US, "₱ %.2f", p.getRetailPrice()));
                    setText(row, R.id.row_status, p.getStatus());
                    row.setVisibility(View.VISIBLE);
                } else {
                    row.setVisibility(View.GONE);
                }
            }
        }
    }
}
