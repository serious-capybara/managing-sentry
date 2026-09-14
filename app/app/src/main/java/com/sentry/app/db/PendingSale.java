package com.sentry.app.db;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "pending_sales")
public class PendingSale {
    @PrimaryKey(autoGenerate = true)
    private int id;
    
    private String saleRequestJson;

    public PendingSale(String saleRequestJson) {
        this.saleRequestJson = saleRequestJson;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getSaleRequestJson() { return saleRequestJson; }
    public void setSaleRequestJson(String saleRequestJson) { this.saleRequestJson = saleRequestJson; }
}
