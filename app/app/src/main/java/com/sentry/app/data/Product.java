package com.sentry.app.data;

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
}