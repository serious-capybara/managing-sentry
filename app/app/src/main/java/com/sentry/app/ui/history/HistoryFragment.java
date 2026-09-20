package com.sentry.app.ui.history;

import com.sentry.app.R;
import com.sentry.app.ui.base.BaseFragment;
import com.sentry.app.data.local.entity.History;
import com.sentry.app.data.repository.DataRepository;
import com.sentry.app.ui.products.NotesModal;
import com.sentry.app.ui.common.NotificationHelper;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.Calendar;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

public class HistoryFragment extends BaseFragment {

    private List<History> historyList = new ArrayList<>();
    private final List<History> filteredList = new ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "All Data";
    private DataRepository repository;
    private boolean isNetworkSyncDone = false;
    private boolean isSlowPillShown = false;
    private boolean isAlreadyAnimated = false;
    private boolean isBatchLoadingPending = false;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new DataRepository(requireContext());
        setupUI(view);
        setupSearchAndSort(view);
        
        mainHandler.postDelayed(() -> {
            if (isAdded()) fetchHistory(false, true);
        }, 500);
        
        setupSwipeRefresh(view);
    }

    private void setupSwipeRefresh(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.sidebar_bg, R.color.sidebar_btn_primary);
        swipeRefresh.setOnRefreshListener(() -> fetchHistory(true, true));
    }

    private void setupSearchAndSort(View view) {
        setupSearchBar(view, new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                currentSearch = s.toString().toLowerCase().trim();
                applyFilters(false);
            }
            @Override
            public void afterTextChanged(android.text.Editable s) {}
        });

        setupSortListener(view, (parent, v, position, id) -> {
            currentSort = (String) parent.getItemAtPosition(position);
            applyFilters(true);
        });
    }

    private void applyFilters(boolean shouldAnimate) {
        filteredList.clear();
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long todayStart = cal.getTimeInMillis();
        
        Calendar weekCal = (Calendar) cal.clone();
        weekCal.set(Calendar.DAY_OF_WEEK, weekCal.getFirstDayOfWeek());
        long weekStart = weekCal.getTimeInMillis();
        
        Calendar lastWeekCal = (Calendar) weekCal.clone();
        lastWeekCal.add(Calendar.WEEK_OF_YEAR, -1);
        long lastWeekStart = lastWeekCal.getTimeInMillis();

        for (History h : historyList) {
            String orderNum = h.getOrderNumber() != null ? h.getOrderNumber().toLowerCase() : "";
            boolean matchesSearch = orderNum.contains(currentSearch);
            boolean isDateMatch;
            
            if (currentSort.equalsIgnoreCase("Today")) {
                isDateMatch = h.getParsedTimestampMillis() >= todayStart;
            } else if (currentSort.equalsIgnoreCase("This Week")) {
                isDateMatch = h.getParsedTimestampMillis() >= weekStart;
            } else if (currentSort.equalsIgnoreCase("Last Week")) {
                isDateMatch = h.getParsedTimestampMillis() >= lastWeekStart && h.getParsedTimestampMillis() < weekStart;
            } else {
                isDateMatch = true;
            }
            
            if (matchesSearch && isDateMatch) filteredList.add(h);
        }
        
        filteredList.sort((h1, h2) -> {
            int timeComparison = Long.compare(h2.getParsedTimestampMillis(), h1.getParsedTimestampMillis());
            if (timeComparison != 0) return timeComparison;
            return Integer.compare(h2.getOrderId(), h1.getOrderId());
        });
        
        updateHistoryTable(shouldAnimate);
    }

    private void fetchHistory(boolean isManualRefresh, boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;
        ViewGroup container = view.findViewById(R.id.history_content);
        if (container == null) return;
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        
        if (isManualRefresh) {
            int cooldown = DataRepository.getHistoryCooldownSeconds();
            if (cooldown > 0) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                return;
            }
            DataRepository.markHistoryRefreshStarted();
        }

        if (historyList.isEmpty()) showSkeleton(container, 6);

        isNetworkSyncDone = false;
        isSlowPillShown = false;
        isAlreadyAnimated = false;
        isBatchLoadingPending = false;
        boolean canShowPills = isManualRefresh || !DataRepository.hasSyncedHistory();

        mainHandler.postDelayed(() -> {
            if (!isNetworkSyncDone && isAdded()) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (canShowPills && !isSlowPillShown && repository.isOnline()) {
                    isSlowPillShown = true;
                    NotificationHelper.showNotification(getActivity(), 
                        "Slow connection.", 
                        "Working with saved history...", 
                        getResources().getColor(R.color.pill_bg_logout, requireActivity().getTheme()));
                }
            }
        }, 5000);

        repository.loadHistoryFromDb(data -> {
            if (getActivity() == null) return;
            getActivity().runOnUiThread(() -> {
                if (!isNetworkSyncDone) {
                    hideSkeleton(container);
                    historyList = Objects.requireNonNullElseGet(data, ArrayList::new);
                    
                    boolean needsAnimation = shouldAnimate && !isManualRefresh && !isAlreadyAnimated;
                    applyFilters(needsAnimation);
                    if (needsAnimation) isAlreadyAnimated = true;
                }
            });
        });

        repository.getHistoryWithSafetyNet(
            data -> {},
            new DataRepository.DataCallback<>() {
                @Override
                public void onSuccess(List<History> data) {
                    if (getActivity() == null) return;
                    getActivity().runOnUiThread(() -> {
                        isNetworkSyncDone = true;
                        hideSkeleton(container);
                        if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                        historyList = Objects.requireNonNullElseGet(data, ArrayList::new);
                        
                        boolean needsAnimation = shouldAnimate && (!isAlreadyAnimated || isManualRefresh);
                        applyFilters(needsAnimation);
                        if (needsAnimation) isAlreadyAnimated = true;

                        if (canShowPills) {
                            NotificationHelper.showNotification(getActivity(), 
                                "History is up to date!", 
                                null, 
                                getResources().getColor(R.color.sidebar_btn_primary, getActivity().getTheme()));
                        }
                        DataRepository.markHistorySynced();
                    });
                }
                @Override
                public void onError(String error) {
                    if (getActivity() == null) return;
                    getActivity().runOnUiThread(() -> {
                        isNetworkSyncDone = true;
                        hideSkeleton(container);
                        if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                    });
                }
            }
        );
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
        hideViews(header, R.id.header_name, R.id.header_category, R.id.header_srp, R.id.header_subtotal, R.id.header_checkout);
        showViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_quantity, R.id.header_sales, R.id.header_status);
        setText(header, R.id.header_status, "Status");
    }

    @SuppressWarnings("all")
    private void updateHistoryTable(boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;
        ViewGroup container = view.findViewById(R.id.history_content);
        if (container == null) return;
        hideSkeleton(container);
        
        View emptyStateContainer = view.findViewById(R.id.empty_state_history);
        View scrollView = view.findViewById(R.id.history_scrollview);

        if (filteredList.isEmpty()) {
            if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.VISIBLE);
            if (scrollView != null) scrollView.setVisibility(View.GONE);
            container.removeAllViews();
            isBatchLoadingPending = false;
            return;
        }
        
        if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.GONE);
        if (scrollView != null) scrollView.setVisibility(View.VISIBLE);

        int currentChildCount = container.getChildCount();
        int targetCount = filteredList.size();
        int maxInitialItems = 20;

        int initialLimit;
        if (shouldAnimate) {
            initialLimit = Math.min(targetCount, maxInitialItems);
            isBatchLoadingPending = targetCount > maxInitialItems;
        } else if (isBatchLoadingPending) {
            initialLimit = Math.min(targetCount, maxInitialItems);
        } else {
            initialLimit = targetCount;
        }

        if (currentChildCount > initialLimit) {
            container.removeViews(initialLimit, currentChildCount - initialLimit);
        }

        for (int i = 0; i < initialLimit; i++) {
            History h = filteredList.get(i);
            View row;
            if (i < container.getChildCount()) {
                row = container.getChildAt(i);
            } else {
                row = LayoutInflater.from(requireContext()).inflate(R.layout.item_product, container, false);
                container.addView(row);
            }
            bindHistoryRow(row, h);
        }
        
        if (shouldAnimate) {
            animateTableRows(container);
            
            if (isBatchLoadingPending) {
                mainHandler.postDelayed(() -> {
                    if (!isAdded()) return;
                    isBatchLoadingPending = false;
                    for (int i = maxInitialItems; i < filteredList.size(); i++) {
                        View row = LayoutInflater.from(requireContext()).inflate(R.layout.item_product, container, false);
                        container.addView(row);
                        bindHistoryRow(row, filteredList.get(i));
                        row.setAlpha(0f);
                        row.animate().alpha(1f).setDuration(400).start();
                    }
                }, 900); 
            }
        }
    }

    private void bindHistoryRow(View row, History h) {
        hideViews(row, R.id.row_name, R.id.row_category, R.id.row_srp, R.id.row_subtotal, R.id.row_checkout, R.id.row_action_container, R.id.row_cart_actions);
        showViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_quantity, R.id.row_sales, R.id.row_status_container);
        
        setText(row, R.id.row_timestamp, h.getDisplayTimestamp());
        setText(row, R.id.row_order, h.getOrderNumber());
        setText(row, R.id.row_quantity, String.valueOf(h.getTotalQuantity()));
        setText(row, R.id.row_sales, String.format(Locale.US, "₱ %.2f", h.getTotalAmount()));
        setText(row, R.id.row_status, h.getStatus());
        
        View dot = row.findViewById(R.id.row_notes_dot);
        boolean hasNotes = h.getNotes() != null && !h.getNotes().trim().isEmpty();
        if (dot != null) dot.setVisibility(hasNotes ? View.VISIBLE : View.GONE);
        
        View statusView = row.findViewById(R.id.row_status_container);
        if (statusView != null && hasNotes) {
            statusView.setOnLongClickListener(v -> {
                NotesModal modal = NotesModal.newInstance(h.getNotes());
                modal.show(getParentFragmentManager(), "NotesModal");
                return true;
            });
        }
        row.setVisibility(View.VISIBLE);
    }
}
