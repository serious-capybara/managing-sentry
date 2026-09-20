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

    @SerializedName("reference_number")
    private String referenceNumber;
    
    private List<SaleItem> items;

    public SaleRequest() {}

    public SaleRequest(int userId, double totalAmount, double amountTendered, double changeGiven, List<SaleItem> items, String notes) {
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.amountTendered = amountTendered;
        this.changeGiven = changeGiven;
        this.items = items;
        this.notes = notes;
    }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }

    public double getAmountTendered() { return amountTendered; }
    public void setAmountTendered(double amountTendered) { this.amountTendered = amountTendered; }

    public double getChangeGiven() { return changeGiven; }
    public void setChangeGiven(double changeGiven) { this.changeGiven = changeGiven; }

    public List<SaleItem> getItems() { return items; }
    public void setItems(List<SaleItem> items) { this.items = items; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getReferenceNumber() { return referenceNumber; }
    public void setReferenceNumber(String referenceNumber) { this.referenceNumber = referenceNumber; }
}
