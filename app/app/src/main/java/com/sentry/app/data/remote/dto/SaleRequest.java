package com.sentry.app.data.remote.dto;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;
import java.util.List;

public class SaleRequest implements Serializable {
    @SerializedName("user_id")
    private int userId;
    
    @SerializedName("total_amount")
    private double totalAmount;
    
    @SerializedName("amount_tendered")
    private double amountTendered;
    
    @SerializedName("change_given")
    private double changeGiven;

    @SerializedName("notes")
    private String notes;
    
    private List<SaleItem> items;

    public SaleRequest(int userId, double totalAmount, double amountTendered, double changeGiven, List<SaleItem> items, String notes) {
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.amountTendered = amountTendered;
        this.changeGiven = changeGiven;
        this.items = items;
        this.notes = notes;
    }

    public int getUserId() { return userId; }
    public double getTotalAmount() { return totalAmount; }
    public double getAmountTendered() { return amountTendered; }
    public double getChangeGiven() { return changeGiven; }
    public List<SaleItem> getItems() { return items; }
    public String getNotes() { return notes; }
}
