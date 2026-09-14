package com.sentry.app.ui;

import com.sentry.app.R;
import android.os.Bundle;
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

import com.sentry.app.data.Product;
import com.sentry.app.data.SaleItem;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Dashboard Fragment - Main screen with product selection and checkout.
 */
public class DashboardFragment extends BaseFragment {

    private List<Product> productList = new ArrayList<>();
    private List<Product> filteredList = new ArrayList<>();
    private String currentSearch = "";
    private String currentSort = "A-Z";
    private final Map<Integer, Integer> cart = new HashMap<>(); // ProductId -> Quantity
    private com.sentry.app.data.repo.DataRepository repository;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_dashboard, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        repository = new com.sentry.app.data.repo.DataRepository(requireContext());
        hideAllRows(view);
        setupUI(view);
        setupResizableDividers(view);
        setupSearchAndSort(view);
        fetchProducts();
    }

    private void hideAllRows(View view) {
        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};
        for (int id : rowIds) {
            View row = view.findViewById(id);
            if (row != null) row.setVisibility(View.GONE);
        }
        int[] cartRowIds = {R.id.cart_row_1, R.id.cart_row_2, R.id.cart_row_3, R.id.cart_row_4};
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
        for (Product p : productList) {
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            boolean matchesSearch = name.contains(currentSearch);
            
            if (matchesSearch) {
                filteredList.add(p);
            }
        }
        
        // Apply sorting
        if (currentSort.equals("A-Z")) {
            filteredList.sort((p1, p2) -> {
                String n1 = p1.getName() != null ? p1.getName() : "";
                String n2 = p2.getName() != null ? p2.getName() : "";
                return n1.compareToIgnoreCase(n2);
            });
        } else if (currentSort.contains("Low on Stock")) {
            filteredList.sort((p1, p2) -> Integer.compare(p1.getStockQuantity(), p2.getStockQuantity()));
        } else if (currentSort.contains("High on Stock")) {
            filteredList.sort((p1, p2) -> Integer.compare(p2.getStockQuantity(), p1.getStockQuantity()));
        }
        
        updateProductTable();
    }

    private void fetchProducts() {
        ViewGroup container = getView().findViewById(R.id.dashboard_content);
        showSkeleton(container, 5);
        
        repository.getProducts(true, new com.sentry.app.data.repo.DataRepository.DataCallback<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    productList = data;
                    applyFilters();
                });
            }

            @Override
            public void onError(String error) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    hideSkeleton(container);
                    productList.clear();
                    applyFilters();
                });
            }
        });
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

    private void setupVerticalResize(View view, View root) {
        View divider = view.findViewById(R.id.resize_divider_vertical);
        Guideline guideline = view.findViewById(R.id.horizontal_guideline);
        
        if (divider != null && guideline != null) {
            boolean isPhone = getResources().getConfiguration().smallestScreenWidthDp < 600;
            // Phone needs more space for the bottom section to show Total Bar + Cart Header + 1 Row
            float minBottomHeightDp = isPhone ? 250 : 200;
            float minTopHeightDp = isPhone ? 350 : 400;

            float minBottomHeightPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, minBottomHeightDp, getResources().getDisplayMetrics());
            float minTopHeightPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, minTopHeightDp, getResources().getDisplayMetrics());

            divider.setOnTouchListener((v, event) -> {
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    float y = event.getRawY();
                    int[] location = new int[2];
                    root.getLocationOnScreen(location);
                    float relativeY = y - location[1];
                    float totalHeight = root.getHeight();

                    // Account for title and sort row height
                    float bottomLimit = totalHeight - minBottomHeightPx;

                    float safeY = Math.max(minTopHeightPx, Math.min(relativeY, bottomLimit));
                    
                    ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) guideline.getLayoutParams();
                    params.guidePercent = safeY / totalHeight;
                    guideline.setLayoutParams(params);
                }
                v.performClick();
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
                
                // Return items to stock
                for (Map.Entry<Integer, Integer> entry : cart.entrySet()) {
                    Product p = findProduct(entry.getKey());
                    if (p != null) {
                        p.setStockQuantity(p.getStockQuantity() + entry.getValue());
                    }
                }
                
                cart.clear();
                updateProductTable();
                updateCartUI();
            });
        }
    }

    private void setupCheckout(View view) {
        View checkoutBtn = view.findViewById(R.id.btn_checkout);
        TextView totalAmountTv = view.findViewById(R.id.tv_total_amount);

        if (checkoutBtn != null) {
            checkoutBtn.setOnClickListener(v -> {
                if (cart.isEmpty()) return;
                
                double total = calculateTotal();
                ArrayList<SaleItem> items = new ArrayList<>();
                for (Map.Entry<Integer, Integer> entry : cart.entrySet()) {
                    Product p = findProduct(entry.getKey());
                    if (p != null) {
                        items.add(new SaleItem(p.getProductId(), entry.getValue(), p.getBaseCost(), p.getRetailPrice(), p.getRetailPrice() * entry.getValue()));
                    }
                }
                
                CheckoutDialogFragment dialog = CheckoutDialogFragment.newInstance(total, items);
                dialog.setOnSaleSuccessListener(() -> {
                    cart.clear();
                    updateCartUI(); // Clear the visual cart immediately
                    fetchProducts(); // Refresh stock from server after sale
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
        double total = 0;
        for (Map.Entry<Integer, Integer> entry : cart.entrySet()) {
            Product p = findProduct(entry.getKey());
            if (p != null) total += p.getRetailPrice() * entry.getValue();
        }
        return total;
    }

    private void setupHeaders(View view) {
        setupMainTableHeader(view.findViewById(R.id.header_row));
        setupCartHeader(view.findViewById(R.id.cart_header));
    }

    private void setupMainTableHeader(View header) {
        if (header == null) return;
        // Dashboard Table: Name, Qty, SRP, Action
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_category, R.id.header_sales, R.id.header_subtotal, R.id.header_status);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_srp, R.id.header_checkout);
    }

    private void setupCartHeader(View header) {
        if (header == null) return;
        // Cart Table: Name, Qty, Total (Subtotal), Action
        hideViews(header, R.id.header_category, R.id.header_srp, R.id.header_timestamp, R.id.header_order, R.id.header_sales, R.id.header_status);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_subtotal, R.id.header_checkout);
    }

    private void updateProductTable() {
        View view = getView();
        if (view == null) return;

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null) {
                if (i < filteredList.size()) {
                    Product p = filteredList.get(i);
                    hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_category, R.id.row_sales, R.id.row_subtotal, R.id.row_status, R.id.row_cart_actions);
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
                    row.setVisibility(View.GONE);
                }
            }
        }
    }

    private void addToCart(Product p) {
        if (p.getStockQuantity() > 0) {
            p.setStockQuantity(p.getStockQuantity() - 1);
            int qty = cart.getOrDefault(p.getProductId(), 0);
            cart.put(p.getProductId(), qty + 1);
            updateProductTable();
            updateCartUI();
        }
    }

    private void updateCartUI() {
        View view = getView();
        if (view == null) return;

        int[] cartRowIds = {R.id.cart_row_1, R.id.cart_row_2, R.id.cart_row_3, R.id.cart_row_4};
        List<Integer> cartProductIds = new ArrayList<>(cart.keySet());

        for (int i = 0; i < cartRowIds.length; i++) {
            View row = view.findViewById(cartRowIds[i]);
            if (row != null) {
                if (i < cartProductIds.size()) {
                    int pid = cartProductIds.get(i);
                    Product p = findProduct(pid);
                    int qty = cart.get(pid);
                    
                    hideViews(row, R.id.row_category, R.id.row_srp, R.id.row_timestamp, R.id.row_order, R.id.row_sales, R.id.row_checkout, R.id.row_status);
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
                                updateProductTable();
                                updateCartUI();
                            }
                        });
                    }
                    
                    if (btnMinus != null && p != null) {
                        btnMinus.setOnClickListener(v -> {
                            p.setStockQuantity(p.getStockQuantity() + 1);
                            int newQty = qty - 1;
                            if (newQty <= 0) {
                                cart.remove(pid);
                            } else {
                                cart.put(pid, newQty);
                            }
                            updateProductTable();
                            updateCartUI();
                        });
                    }
                    
                    row.setVisibility(View.VISIBLE);
                } else {
                    row.setVisibility(View.GONE);
                }
            }
        }
        
        TextView totalAmountTv = view.findViewById(R.id.tv_total_amount);
        if (totalAmountTv != null) {
            totalAmountTv.setText(String.format(Locale.US, "₱ %.2f", calculateTotal()));
        }
    }
}
