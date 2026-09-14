package com.sentry.app.ui;

import com.sentry.app.R;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.sentry.app.data.History;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * History Fragment - Displays order history.
 */
public class HistoryFragment extends BaseFragment {

    private List<History> historyList = new ArrayList<>();
    private List<History> filteredList = new ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "All Data";
    private com.sentry.app.data.repo.DataRepository repository;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new com.sentry.app.data.repo.DataRepository(requireContext());
        hideAllRows(view);
        setupUI(view);
        setupSearchAndSort(view);
        fetchHistory();
        setupSwipeRefresh(view);
    }

    private void setupSwipeRefresh(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.sidebar_bg, R.color.sidebar_btn_primary);
        swipeRefresh.setOnRefreshListener(() -> fetchHistory());
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
        long now = System.currentTimeMillis();
        long oneDay = 24 * 60 * 60 * 1000L;
        long oneWeek = 7 * oneDay;

        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);

        for (History h : historyList) {
            String orderNum = h.getOrderNumber() != null ? h.getOrderNumber().toLowerCase() : "";
            boolean matchesSearch = orderNum.contains(currentSearch);
            boolean matchesDate = true;

            if (h.getTimestamp() != null && !currentSort.equals("All Data")) {
                try {
                    // PostgreSQL format can have milliseconds, which SimpleDateFormat doesn't handle easily
                    String raw = h.getTimestamp().split("\\.")[0];
                    java.util.Date date = sdf.parse(raw);
                    if (date != null) {
                        long time = date.getTime();
                        if (currentSort.equals("Today")) {
                            matchesDate = (now - time) < oneDay;
                        } else if (currentSort.equals("This Week")) {
                            matchesDate = (now - time) < oneWeek;
                        } else if (currentSort.equals("Last Week")) {
                            matchesDate = (now - time) >= oneWeek && (now - time) < (2 * oneWeek);
                        }
                    }
                } catch (Exception e) {
                    // Ignore parsing errors
                }
            }

            if (matchesSearch && matchesDate) {
                filteredList.add(h);
            }
        }
        updateHistoryTable();
    }

    private void fetchHistory() {
        ViewGroup container = getView().findViewById(R.id.history_content);
        View view = getView();
        SwipeRefreshLayout swipeRefresh = view != null ? view.findViewById(R.id.swipe_refresh) : null;
        if (swipeRefresh == null || !swipeRefresh.isRefreshing()) showSkeleton(container, 6);

        repository.getHistory(true, new com.sentry.app.data.repo.DataRepository.DataCallback<List<History>>() {
            @Override
            public void onSuccess(List<History> data) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    historyList = data;
                    applyFilters();
                });
            }

            @Override
            public void onError(String error) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    historyList.clear();
                    applyFilters();
                });
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        setupDropdown(getView(), R.id.sort_dropdown, R.array.history_sort_options);
    }

    private void setupUI(View view) {
        setupHeader(view.findViewById(R.id.header_row));
    }

    private void setupHeader(View header) {
        if (header == null) return;
        // History Table: Time, Order, Qty, Sales, Status
        hideViews(header, R.id.header_name, R.id.header_category, R.id.header_srp, R.id.header_subtotal, R.id.header_checkout);
        showViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_quantity, R.id.header_sales, R.id.header_status);
        setText(header, R.id.header_status, "Status");
    }

    private void updateHistoryTable() {
        View view = getView();
        if (view == null) return;

        View emptyView = view.findViewById(R.id.tv_empty_history);
        View scrollView = view.findViewById(R.id.history_scrollview);

        if (filteredList.isEmpty()) {
            if (emptyView != null) emptyView.setVisibility(View.VISIBLE);
            if (scrollView != null) scrollView.setVisibility(View.GONE);
            return;
        }

        if (emptyView != null) emptyView.setVisibility(View.GONE);
        if (scrollView != null) scrollView.setVisibility(View.VISIBLE);

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null) {
                if (i < filteredList.size()) {
                    History h = filteredList.get(i);
                    hideViews(row, R.id.row_name, R.id.row_category, R.id.row_srp, R.id.row_subtotal, R.id.row_checkout, R.id.row_action_container, R.id.row_cart_actions);
                    showViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_quantity, R.id.row_sales, R.id.row_status);
                    
                    setText(row, R.id.row_timestamp, h.getDisplayTimestamp());
                    setText(row, R.id.row_order, h.getOrderNumber());
                    setText(row, R.id.row_quantity, String.valueOf(h.getTotalQuantity()));
                    setText(row, R.id.row_sales, String.format(Locale.US, "₱ %.2f", h.getTotalAmount()));
                    setText(row, R.id.row_status, h.getStatus());
                    row.setVisibility(View.VISIBLE);
                } else {
                    row.setVisibility(View.GONE);
                }
            }
        }
    }
}
