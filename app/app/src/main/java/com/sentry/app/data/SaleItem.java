package com.sentry.app.data;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class SaleItem implements Serializable {
    @SerializedName("product_id")
    private int productId;
    
    private int quantity;
    
    @SerializedName("cost_snapshot")
    private double costSnapshot;
    
    @SerializedName("price_snapshot")
    private double priceSnapshot;
    
    @SerializedName("line_subtotal")
    private double lineSubtotal;

    public SaleItem(int productId, int quantity, double costSnapshot, double priceSnapshot, double lineSubtotal) {
        this.productId = productId;
        this.quantity = quantity;
        this.costSnapshot = costSnapshot;
        this.priceSnapshot = priceSnapshot;
        this.lineSubtotal = lineSubtotal;
    }

    public int getProductId() { return productId; }
    public int getQuantity() { return quantity; }
    public double getCostSnapshot() { return costSnapshot; }
    public double getPriceSnapshot() { return priceSnapshot; }
    public double getLineSubtotal() { return lineSubtotal; }
}

