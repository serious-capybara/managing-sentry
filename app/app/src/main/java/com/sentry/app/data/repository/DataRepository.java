package com.sentry.app.data.repository;

import android.content.Context;
import androidx.annotation.NonNull;

import com.google.gson.Gson;
import com.sentry.app.data.remote.api.RetrofitClient;
import com.sentry.app.data.local.entity.History;
import com.sentry.app.data.local.entity.Product;
import com.sentry.app.data.remote.dto.SaleItem;
import com.sentry.app.data.remote.dto.SaleRequest;
import com.sentry.app.data.local.db.AppDatabase;
import com.sentry.app.data.local.entity.PendingSale;
import com.sentry.app.utils.NetworkUtils;

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

    private static final String STATUS_SUCCESS = "Success";
    private static final String STATUS_PENDING = "Pending Sync";
    private static final String DATE_FORMAT = "yyyy-MM-dd HH:mm:ss";

    private static boolean sHasSyncedProductsThisSession = false;
    private static boolean sHasSyncedHistoryThisSession = false;
    
    private static long sLastProductsRefreshTime = 0;
    private static long sLastHistoryRefreshTime = 0;
    private static final long REFRESH_COOLDOWN = 10000; // 10 seconds cooldown

    public static boolean hasSyncedProducts() {
        return sHasSyncedProductsThisSession;
    }

    public static void markProductsSynced() {
        sHasSyncedProductsThisSession = true;
    }

    public static boolean hasSyncedHistory() {
        return sHasSyncedHistoryThisSession;
    }

    public static void markHistorySynced() {
        sHasSyncedHistoryThisSession = true;
    }
    
    /**
     * Returns remaining cooldown time in seconds for Products refresh.
     */
    public static int getProductsCooldownSeconds() {
        long elapsed = System.currentTimeMillis() - sLastProductsRefreshTime;
        return (int) Math.max(0, (REFRESH_COOLDOWN - elapsed) / 1000);
    }
    
    public static void markProductsRefreshStarted() {
        sLastProductsRefreshTime = System.currentTimeMillis();
    }
    
    /**
     * Returns remaining cooldown time in seconds for History refresh.
     */
    public static int getHistoryCooldownSeconds() {
        long elapsed = System.currentTimeMillis() - sLastHistoryRefreshTime;
        return (int) Math.max(0, (REFRESH_COOLDOWN - elapsed) / 1000);
    }
    
    public static void markHistoryRefreshStarted() {
        sLastHistoryRefreshTime = System.currentTimeMillis();
    }

    public DataRepository(Context context) {
        this.context = context.getApplicationContext();
        this.db = AppDatabase.getInstance(context);
    }

    public interface DataCallback<T> {
        void onSuccess(T data);
        default void onError(String error) {}
    }

    public void getProductsWithSafetyNet(DataCallback<List<Product>> localCallback, DataCallback<List<Product>> remoteCallback) {
        loadProductsFromDb(localCallback);

        if (isOnline()) {
            RetrofitClient.getApiService().getProducts().enqueue(new Callback<>() {
                @Override
                public void onResponse(@NonNull Call<List<Product>> call, @NonNull Response<List<Product>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        List<Product> products = response.body();
                        executor.execute(() -> {
                            db.productDao().insertProducts(products);
                            remoteCallback.onSuccess(products);
                        });
                    } else {
                        remoteCallback.onError("Server error");
                    }
                }
                @Override
                public void onFailure(@NonNull Call<List<Product>> call, @NonNull Throwable t) {
                    remoteCallback.onError(t.getMessage());
                }
            });
        }
    }

    public void getHistoryWithSafetyNet(DataCallback<List<History>> localCallback, DataCallback<List<History>> remoteCallback) {
        loadHistoryFromDb(localCallback);

        if (isOnline()) {
            RetrofitClient.getApiService().getHistory().enqueue(new Callback<>() {
                @Override
                public void onResponse(@NonNull Call<List<History>> call, @NonNull Response<List<History>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        List<History> history = response.body();
                        sortHistoryDescending(history);
                        executor.execute(() -> {
                            db.historyDao().deleteSyncedHistory();
                            db.historyDao().insertHistory(history);
                            remoteCallback.onSuccess(history);
                        });
                    } else {
                        remoteCallback.onError("Server error");
                    }
                }
                @Override
                public void onFailure(@NonNull Call<List<History>> call, @NonNull Throwable t) {
                    remoteCallback.onError(t.getMessage());
                }
            });
        }
    }

    public void loadProductsFromDb(DataCallback<List<Product>> callback) {
        executor.execute(() -> {
            List<Product> products = db.productDao().getAllProducts();
            callback.onSuccess(products);
        });
    }

    public void loadHistoryFromDb(DataCallback<List<History>> callback) {
        executor.execute(() -> {
            List<History> history = db.historyDao().getAllHistory();
            sortHistoryDescending(history);
            callback.onSuccess(history);
        });
    }

    private void sortHistoryDescending(List<History> list) {
        if (list == null) return;
        list.sort((h1, h2) -> {
            int timeComparison = Long.compare(h2.getParsedTimestampMillis(), h1.getParsedTimestampMillis());
            if (timeComparison != 0) return timeComparison;
            return Integer.compare(h2.getOrderId(), h1.getOrderId());
        });
    }

    public void performSale(SaleRequest request, DataCallback<Integer> callback) {
        if (isOnline()) {
            RetrofitClient.getApiService().makeSale(request).enqueue(new Callback<>() {
                @Override
                public void onResponse(@NonNull Call<com.sentry.app.data.remote.dto.ApiResponse> call, @NonNull Response<com.sentry.app.data.remote.dto.ApiResponse> response) {
                    if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                        executor.execute(() -> {
                            int orderId = applyLocalSaleEffects(request, STATUS_SUCCESS);
                            callback.onSuccess(orderId);
                        });
                    } else {
                        handleSaleOffline(request, callback);
                    }
                }

                @Override
                public void onFailure(@NonNull Call<com.sentry.app.data.remote.dto.ApiResponse> call, @NonNull Throwable t) {
                    handleSaleOffline(request, callback);
                }
            });
        } else {
            handleSaleOffline(request, callback);
        }
    }

    private void handleSaleOffline(SaleRequest request, DataCallback<Integer> callback) {
        executor.execute(() -> {
            int orderId = applyLocalSaleEffects(request, STATUS_PENDING);
            queuePendingSale(request);
            callback.onSuccess(orderId);
        });
    }

    private int applyLocalSaleEffects(SaleRequest request, String status) {
        if (request.getItems() == null) return -1;

        updateLocalStock(request.getItems());
        return recordSaleInHistory(request, status);
    }

    private void updateLocalStock(List<SaleItem> items) {
        for (SaleItem item : items) {
            db.productDao().decrementStock(item.getProductId(), item.getQuantity());
        }
    }

    private int recordSaleInHistory(SaleRequest request, String status) {
        int totalQty = calculateTotalQuantity(request.getItems());
        String timestamp = new SimpleDateFormat(STATUS_PENDING.equals(status) ? DATE_FORMAT : "yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(new Date());
        int maxOrderId = db.historyDao().getMaxOrderId();
        int nextOrderId = (maxOrderId > 0) ? maxOrderId + 1 : 1;

        History localHistory = new History();
        localHistory.setOrderId(nextOrderId);
        localHistory.setTotalAmount(request.getTotalAmount());
        localHistory.setTotalQuantity(totalQty);
        localHistory.setTimestamp(timestamp);
        localHistory.setStatus(status);
        localHistory.setNotes(request.getNotes());

        db.historyDao().insertSingle(localHistory);
        return nextOrderId;
    }

    @SuppressWarnings("all")
    private int calculateTotalQuantity(List<SaleItem> items) {
        if (items == null) return 0;
        int total = 0;
        for (SaleItem item : items) {
            total += item.getQuantity();
        }
        return total;
    }

    private void queuePendingSale(SaleRequest request) {
        String json = gson.toJson(request);
        db.pendingSaleDao().insert(new PendingSale(json));
    }

    public boolean isOnline() {
        return NetworkUtils.isNetworkConnected(context);
    }
}
