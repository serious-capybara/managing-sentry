package com.sentry.app;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

public class DashboardFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_dashboard, container, false);
        setupColumns(view);
        return view;
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

        // Setup Data Rows
        int[] rowIds = {
                R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5,
                R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10
        };
        for (int id : rowIds) {
            View row = view.findViewById(id);
            if (row != null) {
                row.findViewById(R.id.row_timestamp).setVisibility(View.GONE);
                row.findViewById(R.id.row_order).setVisibility(View.GONE);
                row.findViewById(R.id.row_quantity).setVisibility(View.GONE);
                row.findViewById(R.id.row_sales).setVisibility(View.GONE);
                row.findViewById(R.id.row_status).setVisibility(View.GONE);
            }
        }
    }
}