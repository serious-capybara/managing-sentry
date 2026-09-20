package com.sentry.app.data.local.entity;

import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.PrimaryKey;
import com.google.gson.annotations.SerializedName;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

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
        if (timestamp == null || timestamp.isEmpty()) return "";
        long millis = getParsedTimestampMillis();
        if (millis == 0) return timestamp;
        return new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date(millis));
    }

    public long getParsedTimestampMillis() {
        if (timestamp == null || timestamp.trim().isEmpty()) return 0L;
        String clean = timestamp.split("\\.")[0].replace("T", " ").replace("Z", "").trim();
        
        String[] formats = {"yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm"};
        for (String format : formats) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat(format, Locale.US);
                Date date = sdf.parse(clean);
                if (date != null) return date.getTime();
            } catch (Exception ignored) {}
        }
        return 0L;
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
