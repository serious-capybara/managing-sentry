package com.sentry.app.ui.dashboard;

import com.sentry.app.R;
import com.sentry.app.ui.base.BaseFragment;
import com.sentry.app.data.local.entity.Product;
import com.sentry.app.data.remote.dto.SaleItem;
import com.sentry.app.data.repository.DataRepository;
import com.sentry.app.ui.products.CheckoutDialogFragment;
import com.sentry.app.ui.common.NotificationHelper;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.constraintlayout.widget.Guideline;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

public class DashboardFragment extends BaseFragment {

    private List<Product> productList = new ArrayList<>();
    private final List<Product> filteredList = new ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "Sort By";
    private final Map<Integer, Integer> cart = new LinkedHashMap<>();
    private DataRepository repository;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isNetworkSyncDone = false;
    private boolean isSlowPillShown = false;
    private boolean isAlreadyAnimated = false;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_dashboard, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new DataRepository(requireContext());
        hideAllRows(view);
        setupUI(view);
        setupResizableDividers(view);
        setupSearchAndSort(view);
        setupSwipeRefresh(view);
        fetchProducts(false, true);
    }

    private void setupSwipeRefresh(View view) {
        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.sidebar_bg, R.color.sidebar_btn_primary);
        swipeRefresh.setOnRefreshListener(() -> fetchProducts(true, true));
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
        int[] cartRowIds = {
                R.id.cart_row_1, R.id.cart_row_2, R.id.cart_row_3, R.id.cart_row_4, R.id.cart_row_5,
                R.id.cart_row_6, R.id.cart_row_7, R.id.cart_row_8, R.id.cart_row_9, R.id.cart_row_10,
                R.id.cart_row_11, R.id.cart_row_12, R.id.cart_row_13, R.id.cart_row_14, R.id.cart_row_15,
                R.id.cart_row_16, R.id.cart_row_17, R.id.cart_row_18, R.id.cart_row_19, R.id.cart_row_20
        };
        for (int id : cartRowIds) {
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
        for (Product p : productList) {
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            if (name.contains(currentSearch)) {
                filteredList.add(p);
            }
        }
        
        if (currentSort.equals("Sort By") || currentSort.equals("A-Z")) {
            filteredList.sort((p1, p2) -> {
                String n1 = p1.getName() != null ? p1.getName() : "";
                String n2 = p2.getName() != null ? p2.getName() : "";
                return n1.compareToIgnoreCase(n2);
            });
        } else if (currentSort.contains("Low on Stock")) {
            filteredList.sort(Comparator.comparingInt(Product::getStockQuantity));
        } else if (currentSort.contains("High on Stock")) {
            filteredList.sort((p1, p2) -> Integer.compare(p2.getStockQuantity(), p1.getStockQuantity()));
        }
        
        updateProductTable(shouldAnimate);
    }

    private void fetchProducts(boolean isManualRefresh, boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;

        ViewGroup container = view.findViewById(R.id.dashboard_content);
        if (container == null) return;

        SwipeRefreshLayout swipeRefresh = view.findViewById(R.id.swipe_refresh);
        
        if (isManualRefresh) {
            int cooldown = DataRepository.getProductsCooldownSeconds();
            if (cooldown > 0) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                return;
            }
            DataRepository.markProductsRefreshStarted();
        }

        if (productList.isEmpty()) showSkeleton(container, 5);

        isNetworkSyncDone = false;
        isSlowPillShown = false;
        isAlreadyAnimated = false;
        boolean firstSessionSync = !DataRepository.hasSyncedProducts();
        boolean canShowPills = isManualRefresh || firstSessionSync;

        mainHandler.postDelayed(() -> {
            if (!isNetworkSyncDone && getActivity() != null) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (canShowPills && !isSlowPillShown) {
                    isSlowPillShown = true;
                    NotificationHelper.showNotification(getActivity(), 
                        "Slow connection.", 
                        "Working with saved data...", 
                        getResources().getColor(R.color.pill_bg_logout, getActivity().getTheme()));
                }
            }
        }, 5000);
        
        repository.getProductsWithSafetyNet(
            data -> {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    if (!isNetworkSyncDone) {
                        hideSkeleton(container);
                        productList = data;
                        applyFilters(false);
                        if (shouldAnimate && !isManualRefresh && !isAlreadyAnimated) {
                            animateTableRows(container);
                            isAlreadyAnimated = true;
                        }
                    }
                });
            },
            new DataRepository.DataCallback<>() {
                @Override
                public void onSuccess(List<Product> data) {
                    if (getActivity() == null) return;
                    getActivity().runOnUiThread(() -> {
                        isNetworkSyncDone = true;
                        hideSkeleton(container);
                        if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                        productList = data;
                        applyFilters(false);
                        
                        if (shouldAnimate && (!isAlreadyAnimated || isManualRefresh)) {
                            animateTableRows(container);
                            isAlreadyAnimated = true;
                        }
                        
                        if (canShowPills) {
                            NotificationHelper.showNotification(getActivity(), 
                                "Products are up to date!", 
                                null, 
                                getResources().getColor(R.color.sidebar_btn_primary, getActivity().getTheme()));
                        }
                        DataRepository.markProductsSynced();
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
        setupDropdown(getView(), R.id.sort_dropdown, R.array.default_options);
    }

    private void setupResizableDividers(View view) {
        View root = view.findViewById(R.id.dashboard_root);
        if (root == null) return;
        setupVerticalResize(view, root);
    }

    @SuppressLint("ClickableViewAccessibility")
    private void setupVerticalResize(View view, View root) {
        View divider = view.findViewById(R.id.resize_divider_vertical);
        Guideline guideline = view.findViewById(R.id.horizontal_guideline);
        
        if (divider != null && guideline != null) {
            boolean isPhone = getResources().getConfiguration().smallestScreenWidthDp < 600;
            float minBottomHeightDp = isPhone ? 250 : 200;
            float minTopHeightDp = isPhone ? 350 : 400;

            float minBottomHeightPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, minBottomHeightDp, getResources().getDisplayMetrics());
            float minTopHeightPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, minTopHeightDp, getResources().getDisplayMetrics());

            divider.setOnTouchListener((v, event) -> {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_MOVE:
                        float y = event.getRawY();
                        int[] location = new int[2];
                        root.getLocationOnScreen(location);
                        float relativeY = y - location[1];
                        float totalHeight = (float) root.getHeight();
                        float bottomLimit = totalHeight - minBottomHeightPx;
                        float safeY = Math.max(minTopHeightPx, Math.min(relativeY, bottomLimit));
                        
                        ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) guideline.getLayoutParams();
                        params.guidePercent = safeY / totalHeight;
                        guideline.setLayoutParams(params);
                        break;
                    case MotionEvent.ACTION_DOWN:
                    case MotionEvent.ACTION_UP:
                    default:
                        v.performClick();
                        break;
                }
                return true;
            });
        }
    }

    private void setupUI(View view) {
        setupHeaders(view);
        setupCheckout(view);
        setupCartActions(view);
        updateCartUI();
    }

    private void setupCartActions(View view) {
        View cleanCartBtn = view.findViewById(R.id.btn_clean_cart);
        if (cleanCartBtn != null) {
            cleanCartBtn.setOnClickListener(v -> {
                if (cart.isEmpty()) return;
                cart.forEach((pid, qty) -> {
                    Product p = findProduct(pid);
                    if (p != null) p.setStockQuantity(p.getStockQuantity() + qty);
                });
                cart.clear();
                updateProductTable(false);
                updateCartUI();
            });
        }
    }

    private void setupCheckout(View view) {
        View checkoutBtn = view.findViewById(R.id.btn_checkout);
        TextView totalAmountTv = view.findViewById(R.id.total_amount);

        if (totalAmountTv != null) {
            totalAmountTv.setText(String.format(Locale.US, "₱ %.2f", calculateTotal()));
        }

        if (checkoutBtn != null) {
            checkoutBtn.setOnClickListener(v -> {
                if (cart.isEmpty()) return;
                double checkoutTotalAmount = calculateTotal();
                ArrayList<SaleItem> items = new ArrayList<>();
                cart.forEach((pid, qty) -> {
                    Product p = findProduct(pid);
                    if (p != null) {
                        items.add(new SaleItem(p.getProductId(), p.getName(), qty, p.getBaseCost(), p.getRetailPrice(), p.getRetailPrice() * qty));
                    }
                });
                CheckoutDialogFragment dialog = CheckoutDialogFragment.newInstance(checkoutTotalAmount, items);
                dialog.setOnSaleSuccessListener(() -> {
                    cart.clear();
                    updateCartUI();
                    fetchProducts(false, false);
                });
                dialog.show(getChildFragmentManager(), "CheckoutDialog");
            });
        }
    }

    private Product findProduct(int id) {
        for (Product p : productList) {
            if (p.getProductId() == id) return p;
        }
        return null;
    }

    private double calculateTotal() {
        return cart.entrySet().stream()
                .mapToDouble(entry -> {
                    Product p = findProduct(entry.getKey());
                    return p != null ? p.getRetailPrice() * entry.getValue() : 0.0;
                })
                .sum();
    }

    private void setupHeaders(View view) {
        setupMainTableHeader(view.findViewById(R.id.header_row));
        setupCartHeader(view.findViewById(R.id.cart_header));
    }

    private void setupMainTableHeader(View header) {
        if (header == null) return;
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_category, R.id.header_sales, R.id.header_subtotal, R.id.header_status);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_srp, R.id.header_checkout);
    }

    private void setupCartHeader(View header) {
        if (header == null) return;
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_subtotal, R.id.header_checkout);
        hideViews(header, R.id.header_category, R.id.header_srp, R.id.header_timestamp, R.id.header_order, R.id.header_sales, R.id.header_status);
    }

    @SuppressWarnings("all")
    private void updateProductTable(boolean shouldAnimate) {
        View view = getView();
        if (view == null) return;
        ViewGroup container = view.findViewById(R.id.dashboard_content);
        if (container == null) return;
        hideSkeleton(container);
        View emptyStateContainer = view.findViewById(R.id.empty_state_products);
        TextView emptyView = view.findViewById(R.id.tv_empty_products);
        View scrollView = view.findViewById(R.id.dashboard_scrollview);
        if (filteredList.isEmpty()) {
            if (emptyStateContainer != null) {
                emptyStateContainer.setVisibility(View.VISIBLE);
                if (productList.isEmpty()) {
                    if (emptyView != null) emptyView.setText(R.string.empty_products);
                } else if (emptyView != null) emptyView.setText(R.string.products_not_found);
            }
            if (scrollView != null) scrollView.setVisibility(View.GONE);
            return;
        }
        if (emptyStateContainer != null) emptyStateContainer.setVisibility(View.GONE);
        if (scrollView != null) scrollView.setVisibility(View.VISIBLE);

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};
        int index = 0;
        for (int id : rowIds) {
            View row = view.findViewById(id);
            if (row != null) {
                if (index < filteredList.size()) {
                    Product p = filteredList.get(index);
                    hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_category, R.id.row_sales, R.id.row_subtotal, R.id.row_status_container, R.id.row_cart_actions);
                    showViews(row, R.id.row_name, R.id.row_quantity, R.id.row_srp, R.id.row_action_container, R.id.row_checkout);
                    setText(row, R.id.row_name, p.getName());
                    setText(row, R.id.row_quantity, String.valueOf(p.getStockQuantity()));
                    setText(row, R.id.row_srp, String.format(Locale.US, "₱ %.2f", p.getRetailPrice()));
                    View checkoutBtn = row.findViewById(R.id.row_checkout);
                    if (checkoutBtn != null) {
                        checkoutBtn.setEnabled(p.getStockQuantity() > 0);
                        checkoutBtn.setAlpha(p.getStockQuantity() > 0 ? 1.0f : 0.5f);
                        checkoutBtn.setOnClickListener(v -> addToCart(p));
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
            index++;
        }
    }

    private void addToCart(Product p) {
        if (p.getStockQuantity() > 0) {
            p.setStockQuantity(p.getStockQuantity() - 1);
            int qty = Objects.requireNonNullElse(cart.get(p.getProductId()), 0);
            cart.put(p.getProductId(), qty + 1);
            updateProductTable(false);
            updateCartUI();
        }
    }

    @SuppressWarnings("all")
    private void updateCartUI() {
        View view = getView();
        if (view == null) return;
        View emptyCartTv = view.findViewById(R.id.tv_empty_cart);
        View cartScrollView = view.findViewById(R.id.cart_scrollview);
        boolean isCartEmpty = cart.isEmpty();
        if (emptyCartTv != null) emptyCartTv.setVisibility(isCartEmpty ? View.VISIBLE : View.GONE);
        if (cartScrollView != null) cartScrollView.setVisibility(isCartEmpty ? View.GONE : View.VISIBLE);
        int[] cartRowIds = {
                R.id.cart_row_1, R.id.cart_row_2, R.id.cart_row_3, R.id.cart_row_4, R.id.cart_row_5,
                R.id.cart_row_6, R.id.cart_row_7, R.id.cart_row_8, R.id.cart_row_9, R.id.cart_row_10,
                R.id.cart_row_11, R.id.cart_row_12, R.id.cart_row_13, R.id.cart_row_14, R.id.cart_row_15,
                R.id.cart_row_16, R.id.cart_row_17, R.id.cart_row_18, R.id.cart_row_19, R.id.cart_row_20
        };
        List<Integer> cartProductIds = new ArrayList<>(cart.keySet());
        int rowIndex = 0;
        for (int id : cartRowIds) {
            View row = view.findViewById(id);
            if (row != null) {
                if (rowIndex < cartProductIds.size()) {
                    int pid = cartProductIds.get(rowIndex);
                    Product p = findProduct(pid);
                    int qty = Objects.requireNonNullElse(cart.get(pid), 0);
                    hideViews(row, R.id.row_category, R.id.row_srp, R.id.row_timestamp, R.id.row_order, R.id.row_sales, R.id.row_checkout, R.id.row_status_container);
                    showViews(row, R.id.row_name, R.id.row_quantity, R.id.row_subtotal, R.id.row_action_container, R.id.row_cart_actions);
                    setText(row, R.id.row_name, p != null ? p.getName() : "Unknown");
                    setText(row, R.id.row_quantity, String.valueOf(qty));
                    setText(row, R.id.row_subtotal, String.format(Locale.US, "₱ %.2f", (p != null ? p.getRetailPrice() : 0) * qty));
                    View btnPlus = row.findViewById(R.id.btn_plus);
                    View btnMinus = row.findViewById(R.id.btn_minus);
                    if (btnPlus != null && p != null) {
                        btnPlus.setEnabled(p.getStockQuantity() > 0);
                        btnPlus.setOnClickListener(v -> {
                            if (p.getStockQuantity() > 0) {
                                p.setStockQuantity(p.getStockQuantity() - 1);
                                cart.put(pid, qty + 1);
                                updateProductTable(false);
                                updateCartUI();
                            }
                        });
                    }
                    if (btnMinus != null && p != null) {
                        btnMinus.setOnClickListener(v -> {
                            p.setStockQuantity(p.getStockQuantity() + 1);
                            int newQty = qty - 1;
                            if (newQty <= 0) cart.remove(pid);
                            else cart.put(pid, newQty);
                            updateProductTable(false);
                            updateCartUI();
                        });
                    }
                    if (row.getVisibility() != View.VISIBLE) {
                        row.setVisibility(View.VISIBLE);
                        animateSingleRow(row, rowIndex);
                    }
                } else row.setVisibility(View.GONE);
            }
            rowIndex++;
        }
        TextView totalAmountTv = view.findViewById(R.id.total_amount);
        if (totalAmountTv != null) totalAmountTv.setText(String.format(Locale.US, "₱ %.2f", calculateTotal()));
    }
}
