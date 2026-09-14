package com.sentry.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import com.sentry.app.data.History;

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
}

