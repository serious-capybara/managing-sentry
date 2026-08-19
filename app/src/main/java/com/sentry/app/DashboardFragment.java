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

public class DashboardFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_dashboard, container, false);
        setupDropdown(view);
        setupColumns(view);
        return view;
    }

    private void setupDropdown(View view) {
        String[] options = getResources().getStringArray(R.array.sort_options);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_list_item_1, options);
        MaterialAutoCompleteTextView dropdown = view.findViewById(R.id.sort_dropdown);
        if (dropdown != null) {
            dropdown.setAdapter(adapter);
        }
    }

    private void setupColumns(View view) {
        // Setup Header
        View header = view.findViewById(R.id.header_row);
        if (header != null) {
            header.findViewById(R.id.header_timestamp).setVisibility(View.GONE);
            header.findViewById(R.id.header_order).setVisibility(View.GONE);
            header.findViewById(R.id.header_quantity).setVisibility(View.GONE);
            header.findViewById(R.id.header_sales).setVisibility(View.GONE);
            header.findViewById(R.id.header_status).setVisibility(View.GONE);
        }

        // Sample Data for Dashboard (Name, Category, SRP, Checkout)
        String[][] dashboardData = {
                {"Sentry Vitamin C", "Vitamins", "₱ 150.00", "₱ 1,500.00"},
                {"Paracetamol 500mg", "Medicine", "₱ 5.00", "₱ 100.00"},
                {"Alcohol 70%", "Sanitation", "₱ 45.00", "₱ 225.00"},
                {"Face Mask Box", "Protection", "₱ 50.00", "₱ 500.00"},
                {"Sentry Multivitamins", "Vitamins", "₱ 300.00", "₱ 600.00"},
                {"Hand Sanitizer", "Sanitation", "₱ 85.00", "₱ 170.00"},
                {"Thermometer Digital", "Equipment", "₱ 120.00", "₱ 120.00"},
                {"Cotton Balls", "First Aid", "₱ 25.00", "₱ 50.00"},
                {"Adhesive Bandage", "First Aid", "₱ 2.00", "₱ 20.00"},
                {"Gauze Pad", "First Aid", "₱ 15.00", "₱ 45.00"}
        };

        // Setup Data Rows
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
                row.findViewById(R.id.row_status).setVisibility(View.GONE);

                // Set Sample Data
                ((android.widget.TextView) row.findViewById(R.id.row_name)).setText(dashboardData[i][0]);
                ((android.widget.TextView) row.findViewById(R.id.row_category)).setText(dashboardData[i][1]);
                ((android.widget.TextView) row.findViewById(R.id.row_srp)).setText(dashboardData[i][2]);
                // row_checkout is now a Button with static text "Add to Cart"
            }
        }
    }
}