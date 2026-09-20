package com.sentry.app.ui.products;

import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.DialogFragment;
import androidx.print.PrintHelper;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;
import com.sentry.app.R;
import com.sentry.app.data.local.prefs.SessionManager;
import com.sentry.app.data.remote.dto.SaleItem;
import com.sentry.app.data.remote.dto.SaleRequest;
import com.sentry.app.data.repository.DataRepository;

import java.io.Serializable;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class CheckoutDialogFragment extends DialogFragment {

    private double totalAmount = 0.0;
    private List<SaleItem> saleItems = new ArrayList<>();
    private EditText etAmountReceived, etReference, etChange, etNotes;
    private LinearLayout receiptContainer;
    private View containerReference;
    private MaterialAutoCompleteTextView actvPaymentMethod;
    private Button btnOk, btnCancel;
    private OnSaleSuccessListener listener;
    private boolean isProcessing = false;
    private boolean isSaleCompleted = false;
    private int generatedOrderId = -1;

    private static final String KEY_TOTAL = "total_amount";
    private static final String KEY_ITEMS = "sale_items";
    private static final String KEY_COMPLETED = "is_completed";
    private static final String KEY_RECEIVED = "received_text";
    private static final String KEY_NOTES = "notes_text";
    private static final String KEY_REF = "ref_text";
    private static final String KEY_PAYMENT = "payment_method";
    private static final String KEY_ORDER_ID = "order_id";

    public interface OnSaleSuccessListener {
        void onSaleSuccess();
    }

    public void setOnSaleSuccessListener(OnSaleSuccessListener listener) {
        this.listener = listener;
    }

    public static CheckoutDialogFragment newInstance(double totalAmount, ArrayList<SaleItem> items) {
        CheckoutDialogFragment fragment = new CheckoutDialogFragment();
        Bundle args = new Bundle();
        args.putDouble(KEY_TOTAL, totalAmount);
        args.putSerializable(KEY_ITEMS, items);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) {
            totalAmount = savedInstanceState.getDouble(KEY_TOTAL);
            isSaleCompleted = savedInstanceState.getBoolean(KEY_COMPLETED);
            generatedOrderId = savedInstanceState.getInt(KEY_ORDER_ID, -1);
            Serializable serializable = savedInstanceState.getSerializable(KEY_ITEMS);
            if (serializable instanceof List) {
                @SuppressWarnings("unchecked")
                List<SaleItem> list = (List<SaleItem>) serializable;
                saleItems = list;
            }
        } else if (getArguments() != null) {
            totalAmount = getArguments().getDouble(KEY_TOTAL, 0.0);
            Serializable serializable = getArguments().getSerializable(KEY_ITEMS);
            if (serializable instanceof List) {
                @SuppressWarnings("unchecked")
                List<SaleItem> list = (List<SaleItem>) serializable;
                saleItems = list;
            }
        }
    }

    @Override
    public void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putDouble(KEY_TOTAL, totalAmount);
        outState.putSerializable(KEY_ITEMS, (ArrayList<SaleItem>) saleItems);
        outState.putBoolean(KEY_COMPLETED, isSaleCompleted);
        outState.putInt(KEY_ORDER_ID, generatedOrderId);
        if (etAmountReceived != null) outState.putString(KEY_RECEIVED, etAmountReceived.getText().toString());
        if (etNotes != null) outState.putString(KEY_NOTES, etNotes.getText().toString());
        if (etReference != null) outState.putString(KEY_REF, etReference.getText().toString());
        if (actvPaymentMethod != null) outState.putString(KEY_PAYMENT, actvPaymentMethod.getText().toString());
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

        if (savedInstanceState != null) {
            if (etAmountReceived != null) etAmountReceived.setText(savedInstanceState.getString(KEY_RECEIVED));
            if (etNotes != null) etNotes.setText(savedInstanceState.getString(KEY_NOTES));
            if (etReference != null) etReference.setText(savedInstanceState.getString(KEY_REF));
            if (actvPaymentMethod != null) {
                String payment = savedInstanceState.getString(KEY_PAYMENT);
                actvPaymentMethod.setText(payment, false);
                updateReferenceVisibility(payment != null ? payment : "");
            }
        }

        if (isSaleCompleted) {
            applyCompletedState();
        }
        calculateChange();
    }

    private void initializeViews(View view) {
        EditText etTotalAmountLocal = view.findViewById(R.id.et_total_amount);
        etAmountReceived = view.findViewById(R.id.et_amount_received);
        etReference = view.findViewById(R.id.et_reference);
        containerReference = view.findViewById(R.id.container_reference);
        etChange = view.findViewById(R.id.et_change);
        actvPaymentMethod = view.findViewById(R.id.actv_payment_method);
        btnOk = view.findViewById(R.id.btn_modal_ok);
        btnCancel = view.findViewById(R.id.btn_modal_cancel);
        etNotes = view.findViewById(R.id.et_notes);
        receiptContainer = view.findViewById(R.id.receipt_container);

        if (etTotalAmountLocal != null) {
            etTotalAmountLocal.setText(String.format(Locale.US, "₱ %.2f", totalAmount));
        }
    }

    private void updateReceiptPreview(double received, double change) {
        if (receiptContainer == null) return;
        receiptContainer.removeAllViews();

        SessionManager sessionManager = new SessionManager(requireContext());
        String cashierName = sessionManager.getUsername() != null ? sessionManager.getUsername() : "Cashier";
        String dateStr = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date());

        addVerticalSpace(24);
        addCenteredRow(getString(R.string.receipt_store_name), true);
        addCenteredRow(getString(R.string.receipt_store_place), false);
        addCenteredRow(getString(R.string.receipt_store_phone), false);
        
        addVerticalSpace(16);
        addSeparator();
        addVerticalSpace(16);

        String orderIdText = isSaleCompleted && generatedOrderId != -1 ? "ORD-" + generatedOrderId : "PENDING";
        addColumnRow("Order ID:", orderIdText);
        addColumnRow("Date:", dateStr);
        addColumnRow("Cashier:", cashierName);
        
        addVerticalSpace(16);
        addSeparator();
        addVerticalSpace(16);

        for (SaleItem item : saleItems) {
            String name = item.getProductName() != null ? item.getProductName() : "Item #" + item.getProductId();
            String qtyStr = item.getQuantity() > 1 ? item.getQuantity() + "x " : "";
            String price = String.format(Locale.US, "%.2f", item.getLineSubtotal());
            addColumnRow(qtyStr + name, price);
        }
        
        addVerticalSpace(16);
        addSeparator();
        addVerticalSpace(16);
        
        addColumnRow(getString(R.string.receipt_label_total), String.format(Locale.US, "%.2f", totalAmount));
        addColumnRow(getString(R.string.receipt_label_cash), String.format(Locale.US, "%.2f", received));
        addColumnRow(getString(R.string.receipt_label_change), String.format(Locale.US, "%.2f", change));
        
        addVerticalSpace(16);
        addSeparator();
        addVerticalSpace(16);

        String notes = etNotes != null ? etNotes.getText().toString().trim() : "";
        if (!notes.isEmpty()) {
            addVerticalSpace(12);
            addLeftRow(getString(R.string.label_notes) + ": " + notes);
        }
        
        addVerticalSpace(16);
        addCenteredRow(getString(R.string.receipt_thank_you), true);
        addVerticalSpace(24);
    }

    private void setupPaymentMethodDropdown() {
        if (actvPaymentMethod == null) return;
        String[] methods = getResources().getStringArray(R.array.payment_methods);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_dropdown_item_1line, methods);
        actvPaymentMethod.setAdapter(adapter);
        if (actvPaymentMethod.getText().toString().isEmpty()) {
            actvPaymentMethod.setText(methods[0], false);
        }

        actvPaymentMethod.setOnItemClickListener((parent, view, position, id) -> {
            String selected = (String) parent.getItemAtPosition(position);
            updateReferenceVisibility(selected);
        });
    }

    private void updateReferenceVisibility(String method) {
        boolean isOnline = !method.equalsIgnoreCase("Cash");
        if (containerReference != null) {
            containerReference.setVisibility(isOnline ? View.VISIBLE : View.GONE);
        }
        if (!isOnline && etReference != null) {
            etReference.setText("");
        }
    }

    private void setupCalculations() {
        TextWatcher watcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { calculateChange(); }
            @Override public void afterTextChanged(Editable s) {}
        };
        if (etAmountReceived != null) etAmountReceived.addTextChangedListener(watcher);
        if (etNotes != null) etNotes.addTextChangedListener(watcher);
    }

    private void calculateChange() {
        try {
            double received = parseAmount(etAmountReceived.getText().toString());
            double change = Math.max(0.0, received - totalAmount);
            if (received < totalAmount) {
                if (etChange != null) etChange.setText(getString(R.string.currency_zero));
                updateReceiptPreview(received, 0.0);
            } else {
                if (etChange != null) etChange.setText(String.format(Locale.US, getString(R.string.currency_format), change));
                updateReceiptPreview(received, change);
            }
        } catch (Exception e) {
            if (etChange != null) etChange.setText(getString(R.string.currency_zero));
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
        row.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView tvLeft = createBaseTextView();
        tvLeft.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        tvLeft.setText(left);
        TextView tvRight = createBaseTextView();
        tvRight.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        tvRight.setText(right);
        tvRight.setGravity(Gravity.END);
        row.addView(tvLeft);
        row.addView(tvRight);
        receiptContainer.addView(row);
    }

    private void addSeparator() {
        View line = new View(requireContext());
        line.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 2));
        line.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.slate_200));
        receiptContainer.addView(line);
    }

    private void addVerticalSpace(int dp) {
        View space = new View(requireContext());
        int height = (int) (dp * getResources().getDisplayMetrics().density);
        space.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height));
        receiptContainer.addView(space);
    }

    private TextView createBaseTextView() {
        TextView tv = new TextView(requireContext());
        tv.setTextColor(ContextCompat.getColor(requireContext(), R.color.slate_900));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, getResources().getDimension(R.dimen.body_three));
        return tv;
    }

    private double parseAmount(String amount) {
        if (amount == null || amount.isEmpty()) return 0.0;
        String clean = amount.replaceAll("[^\\d.]", "");
        return clean.isEmpty() ? 0.0 : Double.parseDouble(clean);
    }

    private void setupActions() {
        if (btnCancel != null) btnCancel.setOnClickListener(v -> dismiss());
        if (btnOk != null) {
            btnOk.setOnClickListener(v -> {
                if (isSaleCompleted) doPrint();
                else if (!isProcessing) performSale();
            });
        }
    }

    private void applyCompletedState() {
        if (btnOk != null) {
            btnOk.setText(R.string.btn_print_receipt);
            btnOk.setEnabled(true);
        }
        if (btnCancel != null) btnCancel.setText(R.string.btn_done);
        if (etAmountReceived != null) etAmountReceived.setEnabled(false);
        if (etReference != null) etReference.setEnabled(false);
        if (etNotes != null) etNotes.setEnabled(false);
        if (actvPaymentMethod != null) actvPaymentMethod.setEnabled(false);
    }

    private void doPrint() {
        if (receiptContainer == null) return;
        Bitmap bitmap = Bitmap.createBitmap(receiptContainer.getWidth(), receiptContainer.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);
        receiptContainer.draw(canvas);
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
        isProcessing = true;
        btnOk.setEnabled(false);
        btnOk.setText(R.string.processing);
        
        SessionManager sm = new SessionManager(requireContext());
        SaleRequest req = new SaleRequest(sm.getUserId(), totalAmount, received, received - totalAmount, saleItems, etNotes.getText().toString());
        if (etReference != null) req.setReferenceNumber(etReference.getText().toString().trim());

        new DataRepository(requireContext()).performSale(req, orderId -> {
            if (getActivity() == null) return;
            getActivity().runOnUiThread(() -> {
                if (listener != null) listener.onSaleSuccess();
                generatedOrderId = orderId;
                isSaleCompleted = true;
                isProcessing = false;
                calculateChange();
                applyCompletedState();
                Toast.makeText(getContext(), R.string.sale_success, Toast.LENGTH_SHORT).show();
            });
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getDialog() != null && getDialog().getWindow() != null) {
            int width = (int) (getResources().getDisplayMetrics().widthPixels * (getResources().getConfiguration().smallestScreenWidthDp >= 600 ? 0.80 : 0.90));
            getDialog().getWindow().setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }
}
