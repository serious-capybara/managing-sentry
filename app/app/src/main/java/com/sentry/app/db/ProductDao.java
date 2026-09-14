package com.sentry.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;

import com.sentry.app.data.Product;

import java.util.List;

@Dao
public interface ProductDao {
    @Query("SELECT * FROM products")
    List<Product> getAllProducts();

    @Query("SELECT * FROM products WHERE productId = :productId LIMIT 1")
    Product getProductById(int productId);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertProducts(List<Product> products);

    @Update
    void updateProduct(Product product);

    @Query("UPDATE products SET stockQuantity = stockQuantity - :qty WHERE productId = :productId AND stockQuantity >= :qty")
    void decrementStock(int productId, int qty);

    @Query("DELETE FROM products")
    void deleteAll();
}

