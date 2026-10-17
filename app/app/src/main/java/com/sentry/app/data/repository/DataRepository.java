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
    private static final long REFRESH_COOLDOWN = 10000;

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
    
    public static int getProductsCooldownSeconds() {
        long elapsed = System.currentTimeMillis() - sLastProductsRefreshTime;
        return (int) Math.max(0, (REFRESH_COOLDOWN - elapsed) / 1000);
    }
    
    public static void markProductsRefreshStarted() {
        sLastProductsRefreshTime = System.currentTimeMillis();
    }
    
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
                            db.runInTransaction(() -> {
                                db.productDao().deleteAll();
                                db.productDao().insertProducts(products);
                            });
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
                            db.runInTransaction(() -> {
                                // mirror the server, but keep sales that are still waiting to be sent
                                if (db.pendingSaleDao().getAllPendingSales().isEmpty()) db.historyDao().deleteAll();
                                db.historyDao().insertHistory(history);
                            });
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

    /**
     * The sale is recorded on the phone immediately and put in the waiting list; sending it to
     * the server happens in the background, one sale at a time, so the next sale can start at once.
     */
    public void performSale(SaleRequest request, DataCallback<Integer> callback) {
        executor.execute(() -> {
            int orderId = applyLocalSaleEffects(request, STATUS_PENDING);
            // private 12-character code so a sale can never be saved twice (the server puts it in the "By NAME (CODE)" line)
            request.setClientRef(randomCode());
            queuePendingSale(request);
            callback.onSuccess(orderId);
            flushPendingSalesNow();
        });
    }

    /** Send every waiting sale to the server in order. Safe to call any time. */
    public void flushPendingSales() {
        executor.execute(this::flushPendingSalesNow);
    }

    private void flushPendingSalesNow() {
        List<PendingSale> waiting = db.pendingSaleDao().getAllPendingSales();
        boolean sentAny = false;
        boolean stoppedEarly = false;
        for (PendingSale ps : waiting) {
            SaleRequest request = gson.fromJson(ps.getSaleRequestJson(), SaleRequest.class);
            String token = request.getClientRef();
            try {
                // An earlier try may have reached the server before the connection dropped:
                // ask the server first, so the same sale is never saved a second time.
                if (token != null && wasAttempted(token)) {
                    Response<com.sentry.app.data.remote.dto.SaleCheckResponse> check =
                            RetrofitClient.getApiService().checkSale(token).execute();
                    if (!check.isSuccessful() || check.body() == null) {
                        stoppedEarly = true;
                        break;
                    }
                    if (check.body().isExists()) {
                        db.pendingSaleDao().delete(ps);
                        forgetAttempt(token);
                        sentAny = true;
                        continue;
                    }
                }
                if (token != null) markAttempt(token);

                Response<com.sentry.app.data.remote.dto.ApiResponse> response =
                        RetrofitClient.getApiService().makeSale(request).execute();
                int code = response.code();
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    db.pendingSaleDao().delete(ps);
                    if (token != null) forgetAttempt(token);
                    sentAny = true;
                } else if (code >= 400 && code < 500 && code != 401 && code != 408 && code != 429) {
                    db.pendingSaleDao().delete(ps);   // the server said no: drop it and restore real stock below
                    if (token != null) forgetAttempt(token);
                    sentAny = true;
                } else {
                    stoppedEarly = true;
                    break;
                }
            } catch (Exception offline) {
                stoppedEarly = true;
                break;
            }
        }
        if (stoppedEarly) scheduleRetry();
        if (sentAny && !stoppedEarly) refreshAllFromServer();
    }

    private String randomCode() {
        final String letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 12; i++) code.append(letters.charAt(random.nextInt(letters.length())));
        return code.toString();
    }

    private android.content.SharedPreferences attempts() {
        return context.getSharedPreferences("sale_attempts", Context.MODE_PRIVATE);
    }

    private boolean wasAttempted(String token) {
        return attempts().getBoolean(token, false);
    }

    private void markAttempt(String token) {
        attempts().edit().putBoolean(token, true).commit();   // saved before sending, on purpose
    }

    private void forgetAttempt(String token) {
        attempts().edit().remove(token).apply();
    }

    private void scheduleRetry() {
        androidx.work.Constraints online = new androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED).build();
        androidx.work.WorkManager.getInstance(context).enqueueUniqueWork(
                "retry-pending-sales",
                androidx.work.ExistingWorkPolicy.REPLACE,
                new androidx.work.OneTimeWorkRequest.Builder(com.sentry.app.worker.SyncWorker.class)
                        .setConstraints(online).build());
    }

    /** Download products and history and store them on the phone right away. */
    private void refreshAllFromServer() {
        try {
            Response<List<Product>> products = RetrofitClient.getApiService().getProducts().execute();
            if (products.isSuccessful() && products.body() != null) {
                db.runInTransaction(() -> {
                    db.productDao().deleteAll();
                    db.productDao().insertProducts(products.body());
                });
            }
            Response<List<History>> history = RetrofitClient.getApiService().getHistory().execute();
            if (history.isSuccessful() && history.body() != null) {
                db.runInTransaction(() -> {
                    db.historyDao().deleteAll();
                    db.historyDao().insertHistory(history.body());
                });
            }
        } catch (Exception ignored) {
            // the next refresh will fix it
        }
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
        localHistory.setAmountTendered(request.getAmountTendered());
        localHistory.setChangeGiven(request.getChangeGiven());
        localHistory.setCashier(new com.sentry.app.data.local.prefs.SessionManager(context).getFullName());
        localHistory.setItemsJson(buildItemsJson(request.getItems()));

        db.historyDao().insertSingle(localHistory);
        return nextOrderId;
    }

    private String buildItemsJson(List<SaleItem> items) {
        com.google.gson.JsonArray array = new com.google.gson.JsonArray();
        if (items != null) {
            for (SaleItem item : items) {
                com.google.gson.JsonObject o = new com.google.gson.JsonObject();
                o.addProperty("name", item.getProductName());
                o.addProperty("qty", item.getQuantity());
                o.addProperty("price", item.getPriceSnapshot());
                array.add(o);
            }
        }
        return array.toString();
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
