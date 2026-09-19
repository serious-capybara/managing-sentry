package com.sentry.app.ui.history;

import com.sentry.app.R;
import com.sentry.app.ui.base.BaseFragment;
import com.sentry.app.data.local.entity.History;
import com.sentry.app.data.repository.DataRepository;
import com.sentry.app.ui.products.NotesModal;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import android.widget.TextView;
import android.widget.Toast;

import java.util.Calendar;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class HistoryFragment extends BaseFragment {

    private List<History> historyList = new ArrayList<>();
    private List<History> filteredList = new ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "Sort By";
    private DataRepository repository;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new DataRepository(requireContext());
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
            if (row != null) {
                row.animate().cancel();
                row.setScaleX(1f);
                row.setScaleY(1f);
                row.setAlpha(1f);
                row.setVisibility(View.GONE);
            }
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
        
        Calendar cal = Calendar.getInstance();
        
        // Reset to midnight today
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long todayStart = cal.getTimeInMillis();
        
        // This Week (Start of current week)
        Calendar weekCal = (Calendar) cal.clone();
        weekCal.set(Calendar.DAY_OF_WEEK, weekCal.getFirstDayOfWeek());
        long weekStart = weekCal.getTimeInMillis();
        
        // Last Week (Start of last week to start of this week)
        Calendar lastWeekCal = (Calendar) weekCal.clone();
        lastWeekCal.add(Calendar.WEEK_OF_YEAR, -1);
        long lastWeekStart = lastWeekCal.getTimeInMillis();
        long lastWeekEnd = weekStart;

        for (History h : historyList) {
            String orderNum = h.getOrderNumber() != null ? h.getOrderNumber().toLowerCase() : "";
            boolean matchesSearch = orderNum.contains(currentSearch);
            boolean matchesDate = true;

            if (h.getTimestamp() != null && !currentSort.equals("Sort By") && !currentSort.equals("All Data")) {
                long time = h.getParsedTimestampMillis();
                if (time > 0) {
                    if (currentSort.equalsIgnoreCase("Today")) {
                        matchesDate = time >= todayStart;
                    } else if (currentSort.equalsIgnoreCase("This Week")) {
                        matchesDate = time >= weekStart;
                    } else if (currentSort.equalsIgnoreCase("Last Week")) {
                        matchesDate = time >= lastWeekStart && time < lastWeekEnd;
                    }
                } else {
                    matchesDate = false; // Invalid timestamp
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

        repository.getHistory(true, new DataRepository.DataCallback<List<History>>() {
            @Override
            public void onSuccess(List<History> data) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    historyList = data != null ? data : new ArrayList<>();
                    java.util.Collections.sort(historyList, (h1, h2) -> {
                        long t1 = h1.getParsedTimestampMillis();
                        long t2 = h2.getParsedTimestampMillis();
                        if (t1 != t2) return Long.compare(t2, t1);
                        return Integer.compare(h2.getOrderId(), h1.getOrderId());
                    });
                    applyFilters();
                    animateTableRows(container);
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

        ViewGroup container = view.findViewById(R.id.history_content);
        hideSkeleton(container);

        View emptyStateContainer = view.findViewById(R.id.empty_state_history);
        TextView emptyView = view.findViewById(R.id.tv_empty_history);
        View scrollView = view.findViewById(R.id.history_scrollview);

        if (filteredList.isEmpty()) {
            if (emptyStateContainer != null) {
                emptyStateContainer.setVisibility(View.VISIBLE);
                if (historyList.isEmpty()) {
                    if (emptyView != null) emptyView.setText(R.string.empty_history);
                } else {
                    if (emptyView != null) emptyView.setText(R.string.history_not_found);
                }
            }
            if (scrollView != null) scrollView.setVisibility(View.GONE);
            return;
        }

        if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.GONE);
        if (scrollView != null) scrollView.setVisibility(View.VISIBLE);

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null) {
                if (i < filteredList.size()) {
                    History h = filteredList.get(i);
                    hideViews(row, R.id.row_name, R.id.row_category, R.id.row_srp, R.id.row_subtotal, R.id.row_checkout, R.id.row_action_container, R.id.row_cart_actions);
                    showViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_quantity, R.id.row_sales, R.id.row_status_container);
                    
                    setText(row, R.id.row_timestamp, h.getDisplayTimestamp());
                    setText(row, R.id.row_order, h.getOrderNumber());
                    setText(row, R.id.row_quantity, String.valueOf(h.getTotalQuantity()));
                    setText(row, R.id.row_sales, String.format(Locale.US, "₱ %.2f", h.getTotalAmount()));
                    setText(row, R.id.row_status, h.getStatus());

                    View dot = row.findViewById(R.id.row_notes_dot);
                    boolean hasNotes = h.getNotes() != null && !h.getNotes().trim().isEmpty();
                    if (dot != null) {
                        dot.setVisibility(hasNotes ? View.VISIBLE : View.GONE);
                    }

                    View statusView = row.findViewById(R.id.row_status_container);
                    if (statusView != null && hasNotes) {
                        statusView.setOnLongClickListener(v -> {
                            if (getParentFragmentManager() != null) {
                                NotesModal modal = NotesModal.newInstance(h.getNotes());
                                modal.show(getParentFragmentManager(), "NotesModal");
                            }
                            return true;
                        });
                    } else if (statusView != null) {
                        statusView.setOnLongClickListener(null);
                    }

                    row.setVisibility(View.VISIBLE);
                } else {
                    row.animate().cancel();
                    row.setScaleX(1f);
                    row.setScaleY(1f);
                    row.setAlpha(1f);
                    row.setVisibility(View.GONE);
                }
            }
        }
    }
}
