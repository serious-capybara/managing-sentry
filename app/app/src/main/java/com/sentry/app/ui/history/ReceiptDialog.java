package com.sentry.app.ui.history;

import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.cardview.widget.CardView;
import androidx.core.content.ContextCompat;
import androidx.print.PrintHelper;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sentry.app.R;
import com.sentry.app.data.local.entity.History;

import java.util.Locale;

/** Shows the receipt of a past sale matching the exact modal size, curves, padding, and receipt UI as CheckoutDialogFragment. */
public final class ReceiptDialog {
    private ReceiptDialog() {}

    public static void show(Context context, History h) {
        float density = context.getResources().getDisplayMetrics().density;
        int gap20 = (int) (20 * density);
        int gap24 = (int) (24 * density);
        int gap16 = (int) (16 * density);
        int gap12 = (int) (12 * density);
        int gap8 = (int) (8 * density);

        // Outer FrameLayout with padding to create gaps around top, bottom, left, right
        FrameLayout outerFrame = new FrameLayout(context);
        outerFrame.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        outerFrame.setPadding(gap20, gap20, gap20, gap20);

        // Main modal container with rounded curves bg_modal
        LinearLayout modalCard = new LinearLayout(context);
        modalCard.setOrientation(LinearLayout.VERTICAL);
        modalCard.setBackgroundResource(R.drawable.bg_modal);
        modalCard.setPadding(gap24, gap24, gap24, gap24);
        modalCard.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        outerFrame.addView(modalCard);

        // Modal Title
        TextView tvTitle = new TextView(context);
        tvTitle.setText("Transaction Receipt");
        tvTitle.setTextColor(ContextCompat.getColor(context, R.color.slate_900));
        tvTitle.setTextSize(TypedValue.COMPLEX_UNIT_PX, context.getResources().getDimension(R.dimen.title));
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.gravity = Gravity.CENTER_HORIZONTAL;
        titleParams.bottomMargin = gap20;
        tvTitle.setLayoutParams(titleParams);
        modalCard.addView(tvTitle);

        // Receipt CardView (matching checkout modal preview card)
        CardView receiptCard = new CardView(context);
        receiptCard.setCardBackgroundColor(ContextCompat.getColor(context, R.color.slate_50));
        receiptCard.setRadius(12 * density);
        receiptCard.setCardElevation(0);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (int) (320 * density));
        cardParams.bottomMargin = gap20;
        receiptCard.setLayoutParams(cardParams);

        LinearLayout cardContent = new LinearLayout(context);
        cardContent.setOrientation(LinearLayout.VERTICAL);
        cardContent.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Sub-header title
        TextView tvPreviewTitle = new TextView(context);
        tvPreviewTitle.setText(R.string.receipt_preview_title);
        tvPreviewTitle.setTextColor(ContextCompat.getColor(context, R.color.slate_600));
        tvPreviewTitle.setTextSize(TypedValue.COMPLEX_UNIT_PX, context.getResources().getDimension(R.dimen.header_three));
        tvPreviewTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvPreviewTitle.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams prevTitleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        prevTitleParams.gravity = Gravity.CENTER_HORIZONTAL;
        prevTitleParams.topMargin = gap16;
        tvPreviewTitle.setLayoutParams(prevTitleParams);
        cardContent.addView(tvPreviewTitle);

        // Scrollable Receipt container with hidden Android scrollbars
        ScrollView receiptScroll = new ScrollView(context);
        receiptScroll.setVerticalScrollBarEnabled(false);
        receiptScroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f);
        scrollParams.topMargin = gap8;
        receiptScroll.setLayoutParams(scrollParams);

        LinearLayout receiptContainer = new LinearLayout(context);
        receiptContainer.setOrientation(LinearLayout.VERTICAL);
        receiptContainer.setPadding(gap16, gap12, gap16, gap16);
        receiptContainer.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        receiptScroll.addView(receiptContainer);
        cardContent.addView(receiptScroll);
        receiptCard.addView(cardContent);
        modalCard.addView(receiptCard);

        // Populate Receipt Content
        addCenteredRow(context, receiptContainer, context.getString(R.string.receipt_store_name), true);
        addCenteredRow(context, receiptContainer, context.getString(R.string.receipt_store_place), false);
        addCenteredRow(context, receiptContainer, context.getString(R.string.receipt_store_phone), false);

        addVerticalSpace(context, receiptContainer, 12);
        addSeparator(context, receiptContainer);
        addVerticalSpace(context, receiptContainer, 12);

        String cashier = h.getCashier() == null || h.getCashier().trim().isEmpty() ? "Cashier" : h.getCashier();
        addColumnRow(context, receiptContainer, "Order ID:", h.getOrderNumber());
        addColumnRow(context, receiptContainer, "Date:", h.getDisplayTimestamp());
        addColumnRow(context, receiptContainer, "Cashier:", cashier);

        addVerticalSpace(context, receiptContainer, 12);
        addSeparator(context, receiptContainer);
        addVerticalSpace(context, receiptContainer, 12);

        try {
            if (h.getItemsJson() != null && !h.getItemsJson().isEmpty()) {
                JsonArray items = JsonParser.parseString(h.getItemsJson()).getAsJsonArray();
                for (JsonElement element : items) {
                    JsonObject item = element.getAsJsonObject();
                    int qty = item.get("qty").getAsInt();
                    double price = item.get("price").getAsDouble();
                    String name = item.has("name") ? item.get("name").getAsString() : "Item";
                    String qtyStr = qty > 1 ? qty + "x " : "";
                    String priceStr = String.format(Locale.US, "₱ %.2f", qty * price);
                    addColumnRow(context, receiptContainer, qtyStr + name, priceStr);
                }
            }
        } catch (Exception ignored) {
            addLeftRow(context, receiptContainer, "(Items unavailable)");
        }

        addVerticalSpace(context, receiptContainer, 12);
        addSeparator(context, receiptContainer);
        addVerticalSpace(context, receiptContainer, 12);

        double tendered = h.getAmountTendered() > 0 ? h.getAmountTendered() : h.getTotalAmount();
        addColumnRow(context, receiptContainer, context.getString(R.string.receipt_label_total), String.format(Locale.US, "₱ %.2f", h.getTotalAmount()));
        addColumnRow(context, receiptContainer, context.getString(R.string.receipt_label_cash), String.format(Locale.US, "₱ %.2f", tendered));
        addColumnRow(context, receiptContainer, context.getString(R.string.receipt_label_change), String.format(Locale.US, "₱ %.2f", h.getChangeGiven()));

        if (h.getNotes() != null && !h.getNotes().trim().isEmpty()) {
            addVerticalSpace(context, receiptContainer, 12);
            addSeparator(context, receiptContainer);
            addVerticalSpace(context, receiptContainer, 8);
            addLeftRow(context, receiptContainer, context.getString(R.string.label_notes) + ": " + h.getNotes().trim());
        }

        addVerticalSpace(context, receiptContainer, 12);
        addCenteredRow(context, receiptContainer, context.getString(R.string.receipt_thank_you), true);
        addVerticalSpace(context, receiptContainer, 16);

        // Buttons
        LinearLayout buttonRow = new LinearLayout(context);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button btnClose = new Button(context);
        btnClose.setText("Close");
        btnClose.setTextColor(ContextCompat.getColor(context, R.color.slate_900));
        btnClose.setBackgroundResource(R.drawable.button_slate_bg);
        btnClose.setTextSize(TypedValue.COMPLEX_UNIT_PX, context.getResources().getDimension(R.dimen.header_three));
        btnClose.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(0, (int) (context.getResources().getDimension(R.dimen.input_height)), 1.0f);
        closeParams.setMarginEnd(gap12);
        btnClose.setLayoutParams(closeParams);

        Button btnPrint = new Button(context);
        btnPrint.setText(R.string.btn_print_receipt);
        btnPrint.setTextColor(Color.WHITE);
        btnPrint.setBackgroundResource(R.drawable.bg_button_green);
        btnPrint.setTextSize(TypedValue.COMPLEX_UNIT_PX, context.getResources().getDimension(R.dimen.header_three));
        btnPrint.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams printParams = new LinearLayout.LayoutParams(0, (int) (context.getResources().getDimension(R.dimen.input_height)), 1.0f);
        btnPrint.setLayoutParams(printParams);

        buttonRow.addView(btnClose);
        buttonRow.addView(btnPrint);
        modalCard.addView(buttonRow);

        AlertDialog dialog = new AlertDialog.Builder(context)
                .setView(outerFrame)
                .create();

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }

        btnClose.setOnClickListener(v -> dialog.dismiss());
        btnPrint.setOnClickListener(v -> {
            Bitmap bitmap = Bitmap.createBitmap(receiptContainer.getWidth(), receiptContainer.getHeight(), Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);
            receiptContainer.draw(canvas);
            PrintHelper photoPrinter = new PrintHelper(context);
            photoPrinter.setScaleMode(PrintHelper.SCALE_MODE_FIT);
            photoPrinter.printBitmap("Sentry Receipt " + h.getOrderNumber(), bitmap);
        });

        dialog.show();

        if (dialog.getWindow() != null) {
            int width = (int) (context.getResources().getDisplayMetrics().widthPixels * (context.getResources().getConfiguration().smallestScreenWidthDp >= 600 ? 0.75 : 0.92));
            dialog.getWindow().setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }

    private static void addCenteredRow(Context context, LinearLayout container, String text, boolean bold) {
        TextView tv = createBaseTextView(context);
        tv.setText(text);
        tv.setGravity(Gravity.CENTER_HORIZONTAL);
        if (bold) tv.setTypeface(null, android.graphics.Typeface.BOLD);
        container.addView(tv);
    }

    private static void addLeftRow(Context context, LinearLayout container, String text) {
        TextView tv = createBaseTextView(context);
        tv.setText(text);
        tv.setGravity(Gravity.START);
        container.addView(tv);
    }

    private static void addColumnRow(Context context, LinearLayout container, String left, String right) {
        LinearLayout row = new LinearLayout(context);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView tvLeft = createBaseTextView(context);
        tvLeft.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        tvLeft.setText(left);
        TextView tvRight = createBaseTextView(context);
        tvRight.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        tvRight.setText(right);
        tvRight.setGravity(Gravity.END);
        row.addView(tvLeft);
        row.addView(tvRight);
        container.addView(row);
    }

    private static void addSeparator(Context context, LinearLayout container) {
        View line = new View(context);
        line.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 2));
        line.setBackgroundColor(ContextCompat.getColor(context, R.color.slate_200));
        container.addView(line);
    }

    private static void addVerticalSpace(Context context, LinearLayout container, int dp) {
        View space = new View(context);
        int height = (int) (dp * context.getResources().getDisplayMetrics().density);
        space.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height));
        container.addView(space);
    }

    private static TextView createBaseTextView(Context context) {
        TextView tv = new TextView(context);
        tv.setTextColor(ContextCompat.getColor(context, R.color.slate_900));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, context.getResources().getDimension(R.dimen.body_three));
        return tv;
    }
}
