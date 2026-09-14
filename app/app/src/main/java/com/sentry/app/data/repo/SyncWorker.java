package com.sentry.app.data.repo;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.gson.Gson;
import com.sentry.app.api.RetrofitClient;
import com.sentry.app.data.ApiResponse;
import com.sentry.app.data.History;
import com.sentry.app.data.SaleRequest;
import com.sentry.app.db.AppDatabase;
import com.sentry.app.db.PendingSale;

import java.util.List;

import retrofit2.Response;

public class SyncWorker extends Worker {
    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        AppDatabase db = AppDatabase.getInstance(getApplicationContext());
        List<PendingSale> pendingSales = db.pendingSaleDao().getAllPendingSales();
        Gson gson = new Gson();
        boolean anyFailed = false;

        for (PendingSale ps : pendingSales) {
            SaleRequest request = gson.fromJson(ps.getSaleRequestJson(), SaleRequest.class);
            try {
                Response<ApiResponse> response = RetrofitClient.getApiService().makeSale(request).execute();
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    db.pendingSaleDao().delete(ps);
                } else {
                    // Server rejected this specific sale — remove it from the queue to avoid
                    // infinite retries, but flag that we had at least one failure
                    db.pendingSaleDao().delete(ps);
                    anyFailed = true;
                }
            } catch (Exception e) {
                // Network error — keep the sale in the queue and retry later
                anyFailed = true;
            }
        }

        // After syncing, clear stale local history/products and re-fetch from server
        // so "Pending Sync" placeholder rows are replaced with real server records
        if (!anyFailed) {
            try {
                // Refresh history
                Response<List<History>> historyResponse =
                        RetrofitClient.getApiService().getHistory().execute();
                if (historyResponse.isSuccessful() && historyResponse.body() != null) {
                    db.historyDao().deleteAll();
                    db.historyDao().insertHistory(historyResponse.body());
                }

                // Refresh products (stock counts are now authoritative from server)
                Response<List<com.sentry.app.data.Product>> productsResponse =
                        RetrofitClient.getApiService().getProducts().execute();
                if (productsResponse.isSuccessful() && productsResponse.body() != null) {
                    db.productDao().insertProducts(productsResponse.body());
                }
            } catch (Exception ignored) {
                // Refresh is best-effort — the local data is still usable
            }
        }

        return anyFailed ? Result.retry() : Result.success();
    }
}

