package com.sentry.app.data.local.db;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

import com.sentry.app.data.local.entity.History;
import com.sentry.app.data.local.entity.Product;
import com.sentry.app.data.local.entity.PendingSale;
import com.sentry.app.data.local.dao.HistoryDao;
import com.sentry.app.data.local.dao.ProductDao;
import com.sentry.app.data.local.dao.PendingSaleDao;

@Database(entities = {Product.class, History.class, PendingSale.class}, version = 3, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {
    private static AppDatabase instance;

    private static final androidx.room.migration.Migration MIGRATION_2_3 = new androidx.room.migration.Migration(2, 3) {
        @Override
        public void migrate(@androidx.annotation.NonNull androidx.sqlite.db.SupportSQLiteDatabase database) {
            database.execSQL("ALTER TABLE histories ADD COLUMN itemsJson TEXT");
            database.execSQL("ALTER TABLE histories ADD COLUMN amountTendered REAL NOT NULL DEFAULT 0");
            database.execSQL("ALTER TABLE histories ADD COLUMN changeGiven REAL NOT NULL DEFAULT 0");
            database.execSQL("ALTER TABLE histories ADD COLUMN cashier TEXT");
        }
    };

    public abstract ProductDao productDao();
    public abstract HistoryDao historyDao();
    public abstract PendingSaleDao pendingSaleDao();

    public static synchronized AppDatabase getInstance(Context context) {
        if (instance == null) {
            instance = Room.databaseBuilder(context.getApplicationContext(),
                            AppDatabase.class, "sentry_db")
                    .addMigrations(MIGRATION_2_3)
                    .fallbackToDestructiveMigration()
                    .build();
        }
        return instance;
    }
}
