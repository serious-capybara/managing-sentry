package com.sentry.app.ui.products;

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
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import androidx.print.PrintHelper;
import android.graphics.Bitmap;
import android.graphics.Canvas;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.DialogFragment;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;
import com.sentry.app.R;
import com.sentry.app.data.remote.api.RetrofitClient;
import com.sentry.app.data.remote.dto.ApiResponse;
import com.sentry.app.data.remote.dto.SaleItem;
import com.sentry.app.data.remote.dto.SaleRequest;
import com.sentry.app.data.local.prefs.SessionManager;
import com.sentry.app.data.repository.DataRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutDialogFragment extends DialogFragment {

    private double totalAmount = 0.0;
    private List<SaleItem> saleItems = new ArrayList<>();
    private EditText etTotalAmount, etAmountReceived, etReference, etChange, etNotes;
    private LinearLayout receiptContainer;
    private View containerReference;
    private MaterialAutoCompleteTextView actvPaymentMethod;
    private Button btnOk, btnCancel;
    private Runnable onSaleSuccessListener;
    private boolean isProcessing = false;
    private boolean isSaleCompleted = false;

    public void setOnSaleSuccessListener(Runnable listener) {
        this.onSaleSuccessListener = listener;
    }

    public static CheckoutDialogFragment newInstance(double totalAmount, ArrayList<SaleItem> items) {
        CheckoutDialogFragment fragment = new CheckoutDialogFragment();
        Bundle args = new Bundle();
        args.putDouble("total_amount", totalAmount);
        args.putSerializable("sale_items", items);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            totalAmount = getArguments().getDouble("total_amount", 0.0);
            saleItems = (List<SaleItem>) getArguments().getSerializable("sale_items");
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
        return inflater.inflate(R.layout.dialog_checkout, container, false);
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
        etNotes = view.findViewById(R.id.et_notes);
        receiptContainer = view.findViewById(R.id.receipt_container);

        etTotalAmount.setText(String.format(Locale.US, "₱ %.2f", totalAmount));
        updateReceiptPreview(0.0, 0.0);
    }

    private void updateReceiptPreview(double received, double change) {
        if (receiptContainer == null) return;
        receiptContainer.removeAllViews();

        SessionManager sessionManager = new SessionManager(requireContext());
        String cashierName = sessionManager.getUsername() != null ? sessionManager.getUsername() : "Cashier";

        // Store Info
        addVerticalSpace(30);
        addCenteredRow(getString(R.string.receipt_store_name), true);
        addVerticalSpace(30);

        addCenteredRow("Cashier: " + cashierName, false);
        addCenteredRow(getString(R.string.receipt_store_place), false);
        addCenteredRow(getString(R.string.receipt_store_phone), false);

        addVerticalSpace(24);
        addSeparator();
        addVerticalSpace(24);

        // Items
        for (SaleItem item : saleItems) {
            String name = item.getProductName() != null ? item.getProductName() : "Item #" + item.getProductId();
            String qty = item.getQuantity() > 1 ? item.getQuantity() + "x " : "";
            String price = String.format(Locale.US, "%.2f", item.getLineSubtotal());
            addColumnRow(qty + name, price);
        }
        addVerticalSpace(24);
        addSeparator();
        addVerticalSpace(24);

        // Totals
        addColumnRow(getString(R.string.receipt_label_total), String.format(Locale.US, "%.2f", totalAmount));
        addColumnRow(getString(R.string.receipt_label_cash), String.format(Locale.US, "%.2f", received));

        addVerticalSpace(24);
        addSeparator();
        addVerticalSpace(24);

        String notes = etNotes != null ? etNotes.getText().toString().trim() : "";
        if (!notes.isEmpty()) {
            addVerticalSpace(16);
            addLeftRow(getString(R.string.label_notes) + ": " + notes);
        }
        addVerticalSpace(24);

        addCenteredRow(getString(R.string.receipt_thank_you), true);

        addVerticalSpace(30);
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

        if (etNotes != null) {
            etNotes.addTextChangedListener(new TextWatcher() {
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
    }

    private void calculateChange() {
        try {
            double received = parseAmount(etAmountReceived.getText().toString());
            double change = received - totalAmount;

            if (change < 0) {
                etChange.setText(getString(R.string.currency_zero));
                updateReceiptPreview(received, 0.0);
            } else {
                etChange.setText(String.format(Locale.US, getString(R.string.currency_format), change));
                updateReceiptPreview(received, change);
            }
        } catch (NumberFormatException e) {
            etChange.setText(getString(R.string.currency_zero));
            updateReceiptPreview(0.0, 0.0);
        }
    }

    private void addCenteredRow(String text, boolean bold) {
        TextView tv = createBaseTextView();
        tv.setText(text);
        tv.setGravity(Gravity.CENTER_HORIZONTAL);
        if (bold) tv.setTypeface(null, android.graphics.Typeface.BOLD);
        receiptContainer.addView(tv);
    }

    private void addLeftRow(String text) {
        TextView tv = createBaseTextView();
        tv.setText(text);
        tv.setGravity(Gravity.START);
        receiptContainer.addView(tv);
    }

    private void addColumnRow(String left, String right) {
        LinearLayout row = new LinearLayout(requireContext());
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView tvLeft = createBaseTextView();
        tvLeft.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        tvLeft.setText(left);
        tvLeft.setGravity(Gravity.START);

        TextView tvRight = createBaseTextView();
        tvRight.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        tvRight.setText(right);
        tvRight.setGravity(Gravity.END);

        row.addView(tvLeft);
        row.addView(tvRight);
        receiptContainer.addView(row);
    }

    private void addSeparator() {
        View line = new View(requireContext());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 2);
        line.setLayoutParams(params);
        line.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.slate_200));
        receiptContainer.addView(line);
    }

    private void addVerticalSpace(int dp) {
        View space = new View(requireContext());
        int height = (int) (dp * getResources().getDisplayMetrics().density);
        space.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, height));
        receiptContainer.addView(space);
    }

    private TextView createBaseTextView() {
        TextView tv = new TextView(requireContext());
        tv.setTextColor(ContextCompat.getColor(requireContext(), R.color.slate_900));
        tv.setTextSize(13);
        return tv;
    }

    private double parseAmount(String amount) {
        if (amount == null || amount.isEmpty()) return 0.0;
        String clean = amount.replaceAll("[^\\d.]", "");
        if (clean.isEmpty()) return 0.0;
        return Double.parseDouble(clean);
    }

    private void setupActions() {
        btnCancel.setOnClickListener(v -> dismiss());
        btnOk.setOnClickListener(v -> {
            if (isSaleCompleted) {
                doPrint();
            } else {
                if (isProcessing) return;
                performSale();
            }
        });
    }

    private void doPrint() {
        if (receiptContainer == null) return;

        // Create a bitmap of the receipt
        Bitmap bitmap = Bitmap.createBitmap(receiptContainer.getWidth(), receiptContainer.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE); // Ensure white background for the printed receipt
        receiptContainer.draw(canvas);

        // Print the bitmap
        PrintHelper photoPrinter = new PrintHelper(requireContext());
        photoPrinter.setScaleMode(PrintHelper.SCALE_MODE_FIT);
        photoPrinter.printBitmap("Sentry Receipt", bitmap);
    }

    private void performSale() {
        double received = parseAmount(etAmountReceived.getText().toString());
        if (received < totalAmount) {
            etAmountReceived.setError(getString(R.string.error_insufficient_amount));
            return;
        }
        
        String notes = etNotes != null ? etNotes.getText().toString() : "";

        isProcessing = true;
        btnOk.setEnabled(false);
        btnOk.setText(R.string.processing);

        double change = received - totalAmount;
        
        SessionManager sessionManager = new SessionManager(requireContext());
        int userId = sessionManager.getUserId();
        
        SaleRequest request = new SaleRequest(userId, totalAmount, received, change, saleItems, notes);
        
        DataRepository repository = new DataRepository(requireContext());
        repository.performSale(request, new DataRepository.DataCallback<Boolean>() {
            @Override
            public void onSuccess(Boolean success) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    if (onSaleSuccessListener != null) onSaleSuccessListener.run();
                    
                    isSaleCompleted = true;
                    isProcessing = false;
                    btnOk.setEnabled(true);
                    btnOk.setText(R.string.btn_print_receipt);
                    btnCancel.setText(R.string.btn_done);
                    
                    // Show a toast or feedback
                    if (getContext() != null) {
                        android.widget.Toast.makeText(getContext(), R.string.sale_success, android.widget.Toast.LENGTH_SHORT).show();
                    }
                });
            }

            @Override
            public void onError(String error) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    if (onSaleSuccessListener != null) onSaleSuccessListener.run();
                    dismiss();
                });
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getDialog() != null && getDialog().getWindow() != null) {
            getDialog().getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));

            // Add a small buffer to the window width to prevent black corner artifacts
            // without changing the actual visible width of the card.
            int buffer = (int) (8 * getResources().getDisplayMetrics().density); // 4dp each side

            boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
            int width;
            if (isTablet) {
                width = (int) (getResources().getDisplayMetrics().widthPixels * 0.85);
            } else {
                width = (int) (getResources().getDisplayMetrics().widthPixels * 0.90);
            }
            getDialog().getWindow().setLayout(width + buffer, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }
}
