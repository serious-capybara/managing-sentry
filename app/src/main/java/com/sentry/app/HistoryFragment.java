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

public class HistoryFragment extends Fragment {
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_history, container, false);
        setupDropdown(view);
        setupColumns(view);
        return view;
    }

    private void setupColumns(View view) {
        // Setup Header (Keep: TimeStamp, Order, Quantity, Sales, Status)
        View header = view.findViewById(R.id.header_row);
        if (header != null) {
            header.findViewById(R.id.header_name).setVisibility(View.GONE);
            header.findViewById(R.id.header_category).setVisibility(View.GONE);
            header.findViewById(R.id.header_srp).setVisibility(View.GONE);
            header.findViewById(R.id.header_subtotal).setVisibility(View.GONE);
            header.findViewById(R.id.header_checkout).setVisibility(View.GONE);
        }

        // Sample Data for History (TimeStamp, Order, Quantity, Sales, Status)
        String[][] historyData = {
                {"2026-08-19 10:00 AM", "ORD-001", "10", "₱ 1,500.00", "Completed"},
                {"2026-08-19 11:30 AM", "ORD-002", "2", "₱ 10.00", "Cancelled"},
                {"2026-08-19 01:15 PM", "ORD-003", "5", "₱ 225.00", "Completed"},
                {"2026-08-19 02:45 PM", "ORD-004", "1", "₱ 50.00", "Pending"},
                {"2026-08-19 04:00 PM", "ORD-005", "2", "₱ 600.00", "Completed"},
                {"2026-08-20 09:00 AM", "ORD-006", "3", "₱ 255.00", "Completed"},
                {"2026-08-20 10:30 AM", "ORD-007", "1", "₱ 120.00", "Completed"},
                {"2026-08-20 12:00 PM", "ORD-008", "4", "₱ 100.00", "Completed"},
                {"2026-08-20 02:15 PM", "ORD-009", "10", "₱ 20.00", "Completed"},
                {"2026-08-20 03:45 PM", "ORD-010", "3", "₱ 45.00", "Completed"}
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
                row.findViewById(R.id.row_name).setVisibility(View.GONE);
                row.findViewById(R.id.row_category).setVisibility(View.GONE);
                row.findViewById(R.id.row_srp).setVisibility(View.GONE);
                row.findViewById(R.id.row_subtotal).setVisibility(View.GONE);
                row.findViewById(R.id.row_checkout).setVisibility(View.GONE);
                row.findViewById(R.id.row_cart_actions).setVisibility(View.GONE);

                // Set Sample Data
                ((android.widget.TextView) row.findViewById(R.id.row_timestamp)).setText(historyData[i][0]);
                ((android.widget.TextView) row.findViewById(R.id.row_order)).setText(historyData[i][1]);
                ((android.widget.TextView) row.findViewById(R.id.row_quantity)).setText(historyData[i][2]);
                ((android.widget.TextView) row.findViewById(R.id.row_sales)).setText(historyData[i][3]);
                ((android.widget.TextView) row.findViewById(R.id.row_status)).setText(historyData[i][4]);
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