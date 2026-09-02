package com.sentry.app;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * History Fragment - Displays order history.
 */
public class HistoryFragment extends BaseFragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        setupUI(view);
    }

    @Override
    public void onResume() {
        super.onResume();
        setupDropdown(getView(), R.id.sort_dropdown, R.array.history_sort_options);
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
        String[][] historyData = {
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

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null && i < historyData.length) {
                hideViews(row, R.id.row_name, R.id.row_category, R.id.row_srp, R.id.row_subtotal, R.id.row_checkout, R.id.row_cart_actions);
                setText(row, R.id.row_timestamp, historyData[i][0]);
                setText(row, R.id.row_order, historyData[i][1]);
                setText(row, R.id.row_quantity, historyData[i][2]);
                setText(row, R.id.row_sales, historyData[i][3]);
                setText(row, R.id.row_status, historyData[i][4]);
            }
        }
    }
}
