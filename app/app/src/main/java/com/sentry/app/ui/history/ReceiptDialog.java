package com.sentry.app.ui.history;

import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Typeface;
import android.view.Gravity;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sentry.app.R;
import com.sentry.app.data.local.entity.History;

import java.util.Locale;

/** Shows the receipt of a past sale (opened by tapping "Receipt" in History). */
public final class ReceiptDialog {
    private ReceiptDialog() {}

    private static String line(String left, String right) {
        int width = 34;
        int gap = Math.max(1, width - left.length() - right.length());
        return left + " ".repeat(gap) + right + "\n";
    }

    public static void show(Context context, History h) {
        StringBuilder out = new StringBuilder();
        out.append(context.getString(R.string.receipt_store_name)).append("\n");
        out.append(context.getString(R.string.receipt_store_place)).append("\n");
        out.append(context.getString(R.string.receipt_store_phone)).append("\n");
        out.append("----------------------------------\n");
        out.append(line("Order", h.getOrderNumber()));
        out.append(line("Date", h.getDisplayTimestamp()));
        String cashier = h.getCashier() == null || h.getCashier().trim().isEmpty() ? "—" : h.getCashier();
        out.append(line("Cashier", cashier));
        out.append("----------------------------------\n");

        try {
            if (h.getItemsJson() != null && !h.getItemsJson().isEmpty()) {
                JsonArray items = JsonParser.parseString(h.getItemsJson()).getAsJsonArray();
                for (JsonElement element : items) {
                    JsonObject item = element.getAsJsonObject();
                    int qty = item.get("qty").getAsInt();
                    double price = item.get("price").getAsDouble();
                    out.append(item.get("name").getAsString()).append("\n");
                    out.append(line("  " + qty + " x " + String.format(Locale.US, "%.2f", price),
                            String.format(Locale.US, "%.2f", qty * price)));
                }
            }
        } catch (Exception ignored) {
            out.append("(items unavailable)\n");
        }

        double tendered = h.getAmountTendered() > 0 ? h.getAmountTendered() : h.getTotalAmount();
        out.append("----------------------------------\n");
        out.append(line("TOTAL", String.format(Locale.US, "P %.2f", h.getTotalAmount())));
        out.append(line("Cash", String.format(Locale.US, "P %.2f", tendered)));
        out.append(line("Change", String.format(Locale.US, "P %.2f", h.getChangeGiven())));
        if (h.getNotes() != null && !h.getNotes().trim().isEmpty()) {
            out.append("----------------------------------\n");
            StringBuilder userNotes = new StringBuilder();
            for (String noteLine : h.getNotes().split("\n")) {
                if (!noteLine.startsWith("By ")) userNotes.append(noteLine.trim()).append(" ");
            }
            if (userNotes.length() > 0) out.append("Notes: ").append(userNotes.toString().trim()).append("\n");
        }

        TextView text = new TextView(context);
        text.setText(out.toString());
        text.setTypeface(Typeface.MONOSPACE);
        text.setTextSize(12f);
        text.setGravity(Gravity.START);
        int pad = (int) (20 * context.getResources().getDisplayMetrics().density);
        text.setPadding(pad, pad, pad, pad);

        ScrollView scroll = new ScrollView(context);
        scroll.addView(text);

        new AlertDialog.Builder(context)
                .setView(scroll)
                .setPositiveButton("Close", null)
                .show();
    }
}
