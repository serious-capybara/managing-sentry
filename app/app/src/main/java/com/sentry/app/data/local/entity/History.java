package com.sentry.app.data.local.entity;

import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.PrimaryKey;
import com.google.gson.annotations.SerializedName;

@Entity(tableName = "histories")
public class History {
    @ColumnInfo(name = "transaction_timestamp")
    @SerializedName("transaction_timestamp")
    private String timestamp;
    
    @PrimaryKey
    @SerializedName("order_id")
    private int orderId;
    
    @SerializedName("total_quantity")
    private int totalQuantity;
    
    @SerializedName("total_amount")
    private double totalAmount;
    
    @SerializedName("order_status")
    private String status;

    @SerializedName("notes")
    private String notes;

    public String getTimestamp() {
        return timestamp;
    }

    public String getDisplayTimestamp() {
        if (timestamp == null) return "";
        try {
            // PostgreSQL format can sometimes include milliseconds
            String cleanTimestamp = timestamp.split("\\.")[0];
            java.text.SimpleDateFormat inputSdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US);
            java.text.SimpleDateFormat outputSdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US);
            java.util.Date date = inputSdf.parse(cleanTimestamp);
            if (date != null) {
                return outputSdf.format(date);
            }
        } catch (Exception e) {
            // Fallback
        }
        return timestamp;
    }

    public long getParsedTimestampMillis() {
        if (timestamp == null || timestamp.trim().isEmpty()) return 0L;
        try {
            String clean = timestamp.split("\\.")[0].replace("T", " ").replace("Z", "").trim();
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US);
            java.util.Date date = sdf.parse(clean);
            return date != null ? date.getTime() : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }
    public String getOrderNumber() { return "ORD-" + orderId; }
    public int getOrderId() { return orderId; }
    public int getTotalQuantity() { return totalQuantity; }
    public double getTotalAmount() { return totalAmount; }
    public String getStatus() { return status; }
    public String getNotes() { return notes; }

    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public void setOrderId(int orderId) { this.orderId = orderId; }
    public void setTotalQuantity(int totalQuantity) { this.totalQuantity = totalQuantity; }
    public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }
    public void setStatus(String status) { this.status = status; }
    public void setNotes(String notes) { this.notes = notes; }
}
