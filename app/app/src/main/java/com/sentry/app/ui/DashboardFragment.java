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

/**
 * Dashboard Fragment - Main screen with product selection and checkout.
 */
public class DashboardFragment extends BaseFragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_dashboard, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        setupUI(view);
        setupResizableDividers(view);
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
        setupMainTable(view);
        setupCart(view);
        setupCheckout(view);
    }

    private void setupCheckout(View view) {
        View checkoutBtn = view.findViewById(R.id.btn_checkout);
        TextView totalAmountTv = view.findViewById(R.id.tv_total_amount);

        if (checkoutBtn != null) {
            checkoutBtn.setOnClickListener(v -> {
                String total = (totalAmountTv != null) ? totalAmountTv.getText().toString() : "₱ 0.00";
                CheckoutDialogFragment dialog = CheckoutDialogFragment.newInstance(total);
                dialog.show(getChildFragmentManager(), "CheckoutDialog");
            });
        }
    }

    private void setupHeaders(View view) {
        setupMainTableHeader(view.findViewById(R.id.header_row));
        setupCartHeader(view.findViewById(R.id.cart_header));
    }

    private void setupMainTableHeader(View header) {
        if (header == null) return;
        // Dashboard Table: Name, Cat, SRP, Action
        hideViews(header, R.id.header_timestamp, R.id.header_order, R.id.header_quantity, R.id.header_sales, R.id.header_subtotal, R.id.header_status);
        showViews(header, R.id.header_name, R.id.header_category, R.id.header_srp, R.id.header_checkout);
    }

    private void setupCartHeader(View header) {
        if (header == null) return;
        // Cart Table: Name, Qty, Total (Subtotal), Action
        hideViews(header, R.id.header_category, R.id.header_srp, R.id.header_timestamp, R.id.header_order, R.id.header_sales, R.id.header_status);
        showViews(header, R.id.header_name, R.id.header_quantity, R.id.header_subtotal, R.id.header_checkout);
    }

    private void setupMainTable(View view) {
        String[][] products = {
                {"Biogesic 500mg", "Medicine", "₱ 5.50"},
                {"Neozep Forte", "Medicine", "₱ 6.00"},
                {"Safeguard White 130g", "Personal Care", "₱ 48.00"},
                {"Colgate Regular 150g", "Personal Care", "₱ 95.00"},
                {"Kopiko Black 3-in-1", "Grocery", "₱ 8.00"},
                {"Gardenia White Bread", "Grocery", "₱ 75.00"},
                {"Bear Brand Milk 320g", "Grocery", "₱ 115.00"},
                {"Century Tuna Oil 155g", "Grocery", "₱ 38.00"},
                {"Pale Pilsen 330ml Can", "Beverage", "₱ 65.00"},
                {"Poten-Cee Vitamin C", "Vitamins", "₱ 7.50"}
        };

        int[] rowIds = {R.id.row_1, R.id.row_2, R.id.row_3, R.id.row_4, R.id.row_5, R.id.row_6, R.id.row_7, R.id.row_8, R.id.row_9, R.id.row_10};

        for (int i = 0; i < rowIds.length; i++) {
            View row = view.findViewById(rowIds[i]);
            if (row != null && i < products.length) {
                // Dashboard Row: Name, Cat, SRP, Action (Checkout)
                hideViews(row, R.id.row_timestamp, R.id.row_order, R.id.row_quantity, R.id.row_sales, R.id.row_subtotal, R.id.row_status, R.id.row_cart_actions);
                showViews(row, R.id.row_name, R.id.row_category, R.id.row_srp, R.id.row_action_container, R.id.row_checkout);
                setText(row, R.id.row_name, products[i][0]);
                setText(row, R.id.row_category, products[i][1]);
                setText(row, R.id.row_srp, products[i][2]);
            }
        }
    }

    private void setupCart(View view) {
        String[][] cartData = {
                {"Safeguard White 130g", "2", "₱ 96.00"},
                {"Colgate Regular 150g", "1", "₱ 95.00"},
                {"Bear Brand Milk 320g", "1", "₱ 115.00"},
                {"Century Tuna Oil 155g", "3", "₱ 114.00"}
        };

        int[] cartRowIds = {R.id.cart_row_1, R.id.cart_row_2, R.id.cart_row_3, R.id.cart_row_4};

        for (int i = 0; i < cartRowIds.length; i++) {
            View row = view.findViewById(cartRowIds[i]);
            if (row != null && i < cartData.length) {
                // Cart Row: Name, Qty, Total (Subtotal), Action (Cart Actions)
                hideViews(row, R.id.row_category, R.id.row_srp, R.id.row_timestamp, R.id.row_order, R.id.row_sales, R.id.row_checkout, R.id.row_status);
                showViews(row, R.id.row_name, R.id.row_quantity, R.id.row_subtotal, R.id.row_action_container, R.id.row_cart_actions);
                setText(row, R.id.row_name, cartData[i][0]);
                setText(row, R.id.row_quantity, cartData[i][1]);
                setText(row, R.id.row_subtotal, cartData[i][2]);
            }
        }
        
        TextView totalAmountTv = view.findViewById(R.id.tv_total_amount);
        if (totalAmountTv != null) {
            totalAmountTv.setText("₱ 419.00"); // Dummy total for testing
        }
    }
}
