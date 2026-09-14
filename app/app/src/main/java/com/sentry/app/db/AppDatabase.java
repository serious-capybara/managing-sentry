package com.sentry.app.db;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

import com.sentry.app.data.History;
import com.sentry.app.data.Product;

@Database(entities = {Product.class, History.class, PendingSale.class}, version = 1, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {
    private static AppDatabase instance;

    public abstract ProductDao productDao();
    public abstract HistoryDao historyDao();
    public abstract PendingSaleDao pendingSaleDao();

    public static synchronized AppDatabase getInstance(Context context) {
        if (instance == null) {
            instance = Room.databaseBuilder(context.getApplicationContext(),
                            AppDatabase.class, "sentry_db")
                    .fallbackToDestructiveMigration()
                    .build();
        }
        return instance;
    }
}
