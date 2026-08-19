package com.sentry.app;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;

public class HistoryFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_history, container, false);
        setupDropdown(view);
        setupUI(view);
        return view;
    }

    private void setupDropdown(View view) {
        String[] options = getResources().getStringArray(R.array.history_sort_options);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_list_item_1, options);
        MaterialAutoCompleteTextView dropdown = view.findViewById(R.id.sort_dropdown);
        if (dropdown != null) {
            dropdown.setAdapter(adapter);
            dropdown.setText(options[0], false);
            // Ensure all items show on click by disabling filtering
            dropdown.setOnClickListener(v -> dropdown.showDropDown());
        }
    }

    private void setupUI(View view) {
        setupHeader(view.findViewById(R.id.header_row));
        setupTableRows(view);
    }

    private void setupHeader(View header) {
        if (header == null) return;
        hideViews(header, R.id.header_name, R.id.header_category, R.id.header_srp, R.id.header_subtotal, R.id.header_checkout);
    }

    private void setupTableRows(View view) {
        String[][] data = {
                {"2026-08-19 10:00 AM", "ORD-101", "12", "₱ 1,140.00", "Completed"},
                {"2026-08-19 11:30 AM", "ORD-102", "2", "₱ 12.00", "Cancelled"},
                {"2026-08-19 01:15 PM", "ORD-103", "5", "₱ 240.00", "Completed"},
                {"2026-08-19 02:45 PM", "ORD-104", "1", "₱ 95.00", "Pending"},
                {"2026-08-19 04:00 PM", "ORD-105", "2", "₱ 16.00", "Completed"},
                {"2026-08-20 09:00 AM", "ORD-106", "8", "₱ 600.00", "Completed"},
                {"2026-08-20 10:30 AM", "ORD-107", "1", "₱ 115.00", "Completed"},
                {"2026-08-20 12:00 PM", "ORD-108", "4", "₱ 152.00", "Completed"},
                {"2026-08-20 02:15 PM", "ORD-109", "10", "₱ 55.00", "Completed"},
                {"2026-08-20 03:45 PM", "ORD-110", "3", "₱ 195.00", "Completed"}
        };

        int[] ids = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < ids.length; i++) {
            View row = view.findViewById(ids[i]);
            if (row != null) {
                hideViews(row, R.id.row_name, R.id.row_category, R.id.row_srp, R.id.row_subtotal, R.id.row_checkout, R.id.row_cart_actions);
                setText(row, R.id.row_timestamp, data[i][0]);
                setText(row, R.id.row_order, data[i][1]);
                setText(row, R.id.row_quantity, data[i][2]);
                setText(row, R.id.row_sales, data[i][3]);
                setText(row, R.id.row_status, data[i][4]);
            }
        }
    }

    private void hideViews(View root, int... ids) {
        for (int id : ids) {
            View view = root.findViewById(id);
            if (view != null) {
                view.setVisibility(View.GONE);
            }
        }
    }

    private void setText(View root, int id, String text) {
        TextView textView = root.findViewById(id);
        if (textView != null) {
            textView.setText(text);
        }
    }
}