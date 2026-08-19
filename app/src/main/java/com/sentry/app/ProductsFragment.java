package com.sentry.app;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.widget.ArrayAdapter;
import com.google.android.material.textfield.MaterialAutoCompleteTextView;

public class ProductsFragment extends Fragment {
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_products, container, false);
        setupDropdown(view);
        setupColumns(view);
        return view;
    }

    private void setupColumns(View view) {
        // Setup Header (Keep: Name, Category, SRP, Status)
        View header = view.findViewById(R.id.header_row);
        if (header != null) {
            header.findViewById(R.id.header_timestamp).setVisibility(View.GONE);
            header.findViewById(R.id.header_order).setVisibility(View.GONE);
            header.findViewById(R.id.header_quantity).setVisibility(View.GONE);
            header.findViewById(R.id.header_sales).setVisibility(View.GONE);
            header.findViewById(R.id.header_subtotal).setVisibility(View.GONE);
            header.findViewById(R.id.header_checkout).setVisibility(View.GONE);
        }

        // Sample Data for Products (Name, Category, SRP, Status)
        String[][] productData = {
                {"Sentry Vitamin C", "Vitamins", "₱ 150.00", "In Stock"},
                {"Paracetamol 500mg", "Medicine", "₱ 5.00", "Low Stock"},
                {"Alcohol 70%", "Sanitation", "₱ 45.00", "In Stock"},
                {"Face Mask Box", "Protection", "₱ 50.00", "Out of Stock"},
                {"Sentry Multivitamins", "Vitamins", "₱ 300.00", "In Stock"},
                {"Hand Sanitizer", "Sanitation", "₱ 85.00", "In Stock"},
                {"Thermometer Digital", "Equipment", "₱ 120.00", "Low Stock"},
                {"Cotton Balls", "First Aid", "₱ 25.00", "In Stock"},
                {"Adhesive Bandage", "First Aid", "₱ 2.00", "In Stock"},
                {"Gauze Pad", "First Aid", "₱ 15.00", "In Stock"}
        };

        // Setup Data Rows (Row 1 to 10)
        int[] rowIds = {
                R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5,
                R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10
        };

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null) {
                // Set Column Visibility
                row.findViewById(R.id.row_timestamp).setVisibility(View.GONE);
                row.findViewById(R.id.row_order).setVisibility(View.GONE);
                row.findViewById(R.id.row_quantity).setVisibility(View.GONE);
                row.findViewById(R.id.row_sales).setVisibility(View.GONE);
                row.findViewById(R.id.row_subtotal).setVisibility(View.GONE);
                row.findViewById(R.id.row_checkout).setVisibility(View.GONE);
                row.findViewById(R.id.row_cart_actions).setVisibility(View.GONE);

                // Set Sample Data
                ((android.widget.TextView) row.findViewById(R.id.row_name)).setText(productData[i][0]);
                ((android.widget.TextView) row.findViewById(R.id.row_category)).setText(productData[i][1]);
                ((android.widget.TextView) row.findViewById(R.id.row_srp)).setText(productData[i][2]);
                ((android.widget.TextView) row.findViewById(R.id.row_status)).setText(productData[i][3]);
            }
        }
    }

    private void setupDropdown(View view) {
        String[] options = getResources().getStringArray(R.array.sort_options);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_list_item_1, options);
        MaterialAutoCompleteTextView dropdown = view.findViewById(R.id.sort_dropdown);
        if (dropdown != null) {
            dropdown.setAdapter(adapter);
        }
    }
}