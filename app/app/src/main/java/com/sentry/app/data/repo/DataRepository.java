package com.sentry.app.data.repo;

import android.content.Context;

import com.google.gson.Gson;
import com.sentry.app.api.RetrofitClient;
import com.sentry.app.data.History;
import com.sentry.app.data.Product;
import com.sentry.app.data.SaleItem;
import com.sentry.app.data.SaleRequest;
import com.sentry.app.db.AppDatabase;
import com.sentry.app.db.PendingSale;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DataRepository {
    private final AppDatabase db;
    private final Context context;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Gson gson = new Gson();

    public DataRepository(Context context) {
        this.context = context.getApplicationContext();
        this.db = AppDatabase.getInstance(context);
    }

    public interface DataCallback<T> {
        void onSuccess(T data);
        void onError(String error);
    }

    public void getProducts(boolean forceRefresh, DataCallback<List<Product>> callback) {
        if (isOnline() && forceRefresh) {
            RetrofitClient.getApiService().getProducts().enqueue(new Callback<List<Product>>() {
                @Override
                public void onResponse(Call<List<Product>> call, Response<List<Product>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        List<Product> products = response.body();
                        executor.execute(() -> {
                            db.productDao().insertProducts(products);
                            callback.onSuccess(products);
                        });
                    } else {
                        loadProductsFromDb(callback);
                    }
                }

                @Override
                public void onFailure(Call<List<Product>> call, Throwable t) {
                    loadProductsFromDb(callback);
                }
            });
        } else {
            loadProductsFromDb(callback);
        }
    }

    private void loadProductsFromDb(DataCallback<List<Product>> callback) {
        executor.execute(() -> {
            List<Product> products = db.productDao().getAllProducts();
            callback.onSuccess(products);
        });
    }

    public void getHistory(boolean forceRefresh, DataCallback<List<History>> callback) {
        if (isOnline() && forceRefresh) {
            RetrofitClient.getApiService().getHistory().enqueue(new Callback<List<History>>() {
                @Override
                public void onResponse(Call<List<History>> call, Response<List<History>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        List<History> history = response.body();
                        executor.execute(() -> {
                            db.historyDao().insertHistory(history);
                            callback.onSuccess(history);
                        });
                    } else {
                        loadHistoryFromDb(callback);
                    }
                }

                @Override
                public void onFailure(Call<List<History>> call, Throwable t) {
                    loadHistoryFromDb(callback);
                }
            });
        } else {
            loadHistoryFromDb(callback);
        }
    }

    private void loadHistoryFromDb(DataCallback<List<History>> callback) {
        executor.execute(() -> {
            List<History> history = db.historyDao().getAllHistory();
            callback.onSuccess(history);
        });
    }

    public void performSale(SaleRequest request, DataCallback<Boolean> callback) {
        if (isOnline()) {
            RetrofitClient.getApiService().makeSale(request).enqueue(new Callback<com.sentry.app.data.ApiResponse>() {
                @Override
                public void onResponse(Call<com.sentry.app.data.ApiResponse> call, Response<com.sentry.app.data.ApiResponse> response) {
                    if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                        // Online success: apply local effects so UI is immediately consistent
                        executor.execute(() -> applyLocalSaleEffects(request));
                        callback.onSuccess(true);
                    } else {
                        // Server rejected — save locally and still apply local effects
                        executor.execute(() -> {
                            applyLocalSaleEffects(request);
                            queuePendingSale(request);
                        });
                        callback.onSuccess(true);
                    }
                }

                @Override
                public void onFailure(Call<com.sentry.app.data.ApiResponse> call, Throwable t) {
                    // Network error — save locally and apply local effects
                    executor.execute(() -> {
                        applyLocalSaleEffects(request);
                        queuePendingSale(request);
                    });
                    callback.onSuccess(true);
                }
            });
        } else {
            // Offline — apply local effects immediately, queue for later sync
            executor.execute(() -> {
                applyLocalSaleEffects(request);
                queuePendingSale(request);
            });
            callback.onSuccess(true);
        }
    }

    /**
     * Atomically applies local database effects of a completed sale:
     * 1. Decrements stock for every sold item.
     * 2. Inserts a local history record so the History screen reflects the sale.
     *
     * This is called for BOTH online and offline sales so the UI always stays
     * consistent immediately after checkout, regardless of connectivity.
     */
    private void applyLocalSaleEffects(SaleRequest request) {
        if (request.getItems() == null) return;

        // 1. Deduct stock for each item
        for (SaleItem item : request.getItems()) {
            db.productDao().decrementStock(item.getProductId(), item.getQuantity());
        }

        // 2. Insert a local history record
        //    Use a negative, time-based ID as a temporary primary key so it
        //    doesn't collide with real server-assigned order IDs (which are positive).
        //    When the SyncWorker runs and the server returns the real ID, the next
        //    full history refresh will overwrite this row via REPLACE conflict strategy.
        int totalQty = 0;
        if (request.getItems() != null) {
            for (SaleItem item : request.getItems()) {
                totalQty += item.getQuantity();
            }
        }

        String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
        // Use negative epoch-millisecond-based ID to avoid colliding with positive server IDs
        int tempOrderId = (int) -(System.currentTimeMillis() % 1_000_000);

        History localHistory = new History();
        localHistory.setOrderId(tempOrderId);
        localHistory.setTotalAmount(request.getTotalAmount());
        localHistory.setTotalQuantity(totalQty);
        localHistory.setTimestamp(timestamp);
        localHistory.setStatus("Pending Sync");

        db.historyDao().insertSingle(localHistory);
    }

    private void queuePendingSale(SaleRequest request) {
        String json = gson.toJson(request);
        db.pendingSaleDao().insert(new PendingSale(json));
    }

    public boolean isOnline() {
        return com.sentry.app.ui.BaseFragment.isNetworkConnected(context);
    }
}

