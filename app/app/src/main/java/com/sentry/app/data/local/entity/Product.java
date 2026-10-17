package com.sentry.app.data.local.entity;

import androidx.room.Entity;
import androidx.room.PrimaryKey;
import com.google.gson.annotations.SerializedName;

@Entity(tableName = "products")
public class Product {
    @PrimaryKey
    @SerializedName("product_id")
    private int productId;
    
    private String name;
    private String category;
    
    @SerializedName("base_cost")
    private double baseCost;
    
    @SerializedName("markup_amount")
    private double markupAmount;
    
    @SerializedName("retail_price")
    private double retailPrice;
    
    @SerializedName("stock_quantity")
    private int stockQuantity;
    
    @SerializedName("expiration_date")
    private String expirationDate;
    
    @SerializedName("low_stock_alert_level")
    private int lowStockAlertLevel;

    public int getProductId() { return productId; }
    public void setProductId(int productId) { this.productId = productId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public double getBaseCost() { return baseCost; }
    public void setBaseCost(double baseCost) { this.baseCost = baseCost; }
    public double getMarkupAmount() { return markupAmount; }
    public void setMarkupAmount(double markupAmount) { this.markupAmount = markupAmount; }
    public double getRetailPrice() { return retailPrice; }
    public void setRetailPrice(double retailPrice) { this.retailPrice = retailPrice; }
    public int getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(int stockQuantity) { this.stockQuantity = stockQuantity; }
    public String getExpirationDate() { return expirationDate; }
    public void setExpirationDate(String expirationDate) { this.expirationDate = expirationDate; }
    public int getLowStockAlertLevel() { return lowStockAlertLevel; }
    public void setLowStockAlertLevel(int lowStockAlertLevel) { this.lowStockAlertLevel = lowStockAlertLevel; }
    
    public String getStatus() {
        if (stockQuantity <= 0) return "Out of Stock";
        if (stockQuantity <= lowStockAlertLevel) return "Low Stock";
        return "In Stock";
    }

    /** Whole calendar days until the expiration date (negative when already expired), or null if none is set. */
    public Integer getDaysLeft() {
        if (expirationDate == null || expirationDate.trim().isEmpty()) return null;
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            java.util.Date expiryDate = sdf.parse(expirationDate.trim().substring(0, 10));
            if (expiryDate == null) return null;

            java.util.Calendar todayCal = java.util.Calendar.getInstance();
            todayCal.set(java.util.Calendar.HOUR_OF_DAY, 0);
            todayCal.set(java.util.Calendar.MINUTE, 0);
            todayCal.set(java.util.Calendar.SECOND, 0);
            todayCal.set(java.util.Calendar.MILLISECOND, 0);

            java.util.Calendar expiryCal = java.util.Calendar.getInstance();
            expiryCal.setTime(expiryDate);
            expiryCal.set(java.util.Calendar.HOUR_OF_DAY, 0);
            expiryCal.set(java.util.Calendar.MINUTE, 0);
            expiryCal.set(java.util.Calendar.SECOND, 0);
            expiryCal.set(java.util.Calendar.MILLISECOND, 0);

            long diffMillis = expiryCal.getTimeInMillis() - todayCal.getTimeInMillis();
            return (int) Math.round((double) diffMillis / (1000.0 * 60 * 60 * 24));
        } catch (Exception e) {
            return null;
        }
    }

    /** The exact number of days left, for example "12 days", "1 day", "0 days" or "-3 days". */
    public String getExpiryText() {
        Integer days = getDaysLeft();
        if (days == null) return "—";
        return days + (Math.abs(days) == 1 ? " day" : " days");
    }

    public boolean isExpiredOrDueSoon() {
        Integer days = getDaysLeft();
        return days != null && days <= 1;
    }
}
