package com.sentry.app.data.remote.dto;

import com.google.gson.annotations.SerializedName;

/** Answer to "was this sale already saved?" */
public class SaleCheckResponse {
    @SerializedName("exists")
    private boolean exists;

    @SerializedName("order_id")
    private Integer orderId;

    public boolean isExists() { return exists; }
    public Integer getOrderId() { return orderId; }
}
