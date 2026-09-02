package com.sentry.app;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * Products Fragment - Displays a detailed list of products and stock status.
 */
public class ProductsFragment extends BaseFragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_products, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        setupUI(view);
    }

    @Override
    public void onResume() {
        super.onResume();
        setupDropdown(getView(), R.id.sort_dropdown, R.array.default_options);
    }

    private void setupUI(View view) {
        setupHeader(view.findViewById(R.id.header_row));
        setupTableRows(view);
    }

    private void setupHeader(View header) {
        if (header == null) return;
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_quantity, R.id.header_sales, R.id.header_subtotal, R.id.header_checkout);
    }

    private void setupTableRows(View view) {
        String[][] products = {
                {"Biogesic 500mg", "Medicine", "₱ 5.50", "In Stock"},
                {"Neozep Forte", "Medicine", "₱ 6.00", "Low Stock"},
                {"Safeguard White 130g", "Personal Care", "₱ 48.00", "In Stock"},
                {"Colgate Regular 150g", "Personal Care", "₱ 95.00", "Out of Stock"},
                {"Kopiko Black 3-in-1", "Grocery", "₱ 8.00", "In Stock"},
                {"Gardenia White Bread", "Grocery", "₱ 75.00", "In Stock"},
                {"Bear Brand Milk 320g", "Grocery", "₱ 115.00", "Low Stock"},
                {"Century Tuna Oil 155g", "Grocery", "₱ 38.00", "In Stock"},
                {"Pale Pilsen 330ml Can", "Beverage", "₱ 65.00", "In Stock"},
                {"Poten-Cee Vitamin C", "Vitamins", "₱ 7.50", "In Stock"}
        };

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null && i < products.length) {
                hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_quantity, R.id.row_sales, R.id.row_subtotal, R.id.row_checkout, R.id.row_cart_actions);
                setText(row, R.id.row_name, products[i][0]);
                setText(row, R.id.row_category, products[i][1]);
                setText(row, R.id.row_srp, products[i][2]);
                setText(row, R.id.row_status, products[i][3]);
            }
        }
    }
}
