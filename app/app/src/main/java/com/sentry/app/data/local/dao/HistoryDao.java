package com.sentry.app.data.local.dao;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import com.sentry.app.data.local.entity.History;

import java.util.List;

@Dao
public interface HistoryDao {
    @Query("SELECT * FROM histories ORDER BY transaction_timestamp DESC")
    List<History> getAllHistory();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertHistory(List<History> histories);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertSingle(History history);

    @Query("DELETE FROM histories")
    void deleteAll();

    @Query("SELECT MAX(orderId) FROM histories")
    int getMaxOrderId();

    @Query("DELETE FROM histories WHERE status != 'Pending Sync'")
    void deleteSyncedHistory();
}
