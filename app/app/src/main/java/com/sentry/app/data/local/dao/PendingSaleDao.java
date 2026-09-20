package com.sentry.app.data.local.dao;

import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.Query;

import com.sentry.app.data.local.entity.PendingSale;

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
