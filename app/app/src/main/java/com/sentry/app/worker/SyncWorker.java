package com.sentry.app.worker;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.gson.Gson;
import com.sentry.app.data.remote.api.RetrofitClient;
import com.sentry.app.data.remote.dto.ApiResponse;
import com.sentry.app.data.local.entity.History;
import com.sentry.app.data.remote.dto.SaleRequest;
import com.sentry.app.data.local.db.AppDatabase;
import com.sentry.app.data.local.entity.PendingSale;

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
                    db.pendingSaleDao().delete(ps);
                    anyFailed = true;
                }
            } catch (Exception e) {
                anyFailed = true;
            }
        }

        if (!anyFailed) {
            try {
                Response<List<History>> historyResponse =
                        RetrofitClient.getApiService().getHistory().execute();
                if (historyResponse.isSuccessful() && historyResponse.body() != null) {
                    db.historyDao().deleteAll();
                    db.historyDao().insertHistory(historyResponse.body());
                }

                Response<List<com.sentry.app.data.local.entity.Product>> productsResponse =
                        RetrofitClient.getApiService().getProducts().execute();
                if (productsResponse.isSuccessful() && productsResponse.body() != null) {
                    db.productDao().insertProducts(productsResponse.body());
                }
            } catch (Exception ignored) {
            }
        }

        return anyFailed ? Result.retry() : Result.success();
    }
}
