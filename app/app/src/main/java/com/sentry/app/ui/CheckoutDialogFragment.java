package com.sentry.app.ui;

import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.DialogFragment;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;
import com.sentry.app.R;

import java.util.Locale;

/**
 * CheckoutDialogFragment handles the final sale processing logic.
 * Follows @ui-ux-pro-max for consistency and elegant behavior.
 */
public class CheckoutDialogFragment extends DialogFragment {

    private String totalAmountStr = "0.00";
    private EditText etTotalAmount, etAmountReceived, etReference, etChange;
    private View containerReference;
    private MaterialAutoCompleteTextView actvPaymentMethod;
    private Button btnOk, btnCancel;

    public static CheckoutDialogFragment newInstance(String totalAmount) {
        CheckoutDialogFragment fragment = new CheckoutDialogFragment();
        Bundle args = new Bundle();
        args.putString("total_amount", totalAmount);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            totalAmountStr = getArguments().getString("total_amount", "0.00");
        }
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {
        Dialog dialog = super.onCreateDialog(savedInstanceState);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }
        return dialog;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.checkout_modal, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        initializeViews(view);
        setupPaymentMethodDropdown();
        setupCalculations();
        setupActions();
    }

    private void initializeViews(View view) {
        etTotalAmount = view.findViewById(R.id.et_total_amount);
        etAmountReceived = view.findViewById(R.id.et_amount_received);
        etReference = view.findViewById(R.id.et_reference);
        containerReference = view.findViewById(R.id.container_reference);
        etChange = view.findViewById(R.id.et_change);
        actvPaymentMethod = view.findViewById(R.id.actv_payment_method);
        btnOk = view.findViewById(R.id.btn_modal_ok);
        btnCancel = view.findViewById(R.id.btn_modal_cancel);

        etTotalAmount.setText(totalAmountStr);
    }

    private void setupPaymentMethodDropdown() {
        String[] methods = getResources().getStringArray(R.array.payment_methods);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_dropdown_item_1line, methods);
        actvPaymentMethod.setAdapter(adapter);
        actvPaymentMethod.setText(methods[0], false); // Default to Cash

        actvPaymentMethod.setOnItemClickListener((parent, view, position, id) -> {
            String selected = (String) parent.getItemAtPosition(position);
            boolean isOnline = !selected.equalsIgnoreCase("Cash");
            
            if (containerReference != null) {
                containerReference.setVisibility(isOnline ? View.VISIBLE : View.GONE);
            }
            if (!isOnline) {
                etReference.setText("");
            }
        });
    }

    private void setupCalculations() {
        etAmountReceived.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                calculateChange();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void calculateChange() {
        try {
            double total = parseAmount(totalAmountStr);
            double received = parseAmount(etAmountReceived.getText().toString());
            double change = received - total;

            if (change < 0) {
                etChange.setText(getString(R.string.currency_zero));
            } else {
                etChange.setText(String.format(Locale.US, getString(R.string.currency_format), change));
            }
        } catch (NumberFormatException e) {
            etChange.setText(getString(R.string.currency_zero));
        }
    }

    private double parseAmount(String amount) {
        if (amount == null || amount.isEmpty()) return 0.0;
        String clean = amount.replaceAll("[^\\d.]", "");
        return Double.parseDouble(clean);
    }

    private void setupActions() {
        btnCancel.setOnClickListener(v -> dismiss());
        btnOk.setOnClickListener(v -> {
            // Logic for completing sale goes here
            dismiss();
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getDialog() != null && getDialog().getWindow() != null) {
            // Force wrap content or specific size for tablet
            boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
            int width;
            if (isTablet) {
                width = (int) (getResources().getDisplayMetrics().widthPixels * 0.85);
            } else {
                // On phone, don't fill the whole width for a better "modal" feel
                width = (int) (getResources().getDisplayMetrics().widthPixels * 0.90);
            }
            getDialog().getWindow().setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }
}
