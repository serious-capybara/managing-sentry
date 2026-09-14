package com.sentry.app.db;

import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.Query;

import java.util.List;

@Dao
public interface PendingSaleDao {
    @Query("SELECT * FROM pending_sales")
    List<PendingSale> getAllPendingSales();

    @Insert
    void insert(PendingSale sale);

    @Delete
    void delete(PendingSale sale);
}
