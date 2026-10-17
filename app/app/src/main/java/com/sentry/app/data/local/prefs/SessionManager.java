package com.sentry.app.data.local.prefs;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import java.io.IOException;
import java.security.GeneralSecurityException;

import com.sentry.app.data.remote.api.RetrofitClient;
import com.sentry.app.data.remote.dto.User;

/**
 * SessionManager handles persistent user sessions using EncryptedSharedPreferences for security.
 */
public class SessionManager {
    private static final String PREFS_NAME = "sentry_secure_prefs";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_FULL_NAME = "full_name";
    private static final String KEY_USER_NAME = "username";
    private static final String KEY_ROLE = "role";
    private static final String KEY_TOKEN = "auth_token";
    private static final String KEY_LAST_USE = "last_use_timestamp";
    private static final long SESSION_TIMEOUT_DAYS = 7L;

    private SharedPreferences prefs;

    @SuppressWarnings("deprecation")
    public SessionManager(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();

            this.prefs = EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                );
        } catch (GeneralSecurityException | IOException e) {
            // Fallback to standard SharedPreferences if encryption fails (should be logged)
            this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        }

        String savedToken = getToken();
        if (savedToken != null && !savedToken.isEmpty()) {
            RetrofitClient.setAuthToken(savedToken);
        }
    }

    public void saveUser(User user) {
        if (user == null) return;
        
        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt(KEY_USER_ID, user.getUserId());
        
        if (user.getFullName() != null) editor.putString(KEY_FULL_NAME, user.getFullName());
        if (user.getUsername() != null) editor.putString(KEY_USER_NAME, user.getUsername());
        if (user.getRole() != null) editor.putString(KEY_ROLE, user.getRole());
        if (user.getToken() != null) {
            editor.putString(KEY_TOKEN, user.getToken());
            RetrofitClient.setAuthToken(user.getToken());
        }
        
        editor.putLong(KEY_LAST_USE, System.currentTimeMillis());
        editor.apply();
    }

    public void refreshTimestamp() {
        prefs.edit().putLong(KEY_LAST_USE, System.currentTimeMillis()).apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
        RetrofitClient.setAuthToken(null);
    }

    public int getUserId() {
        return prefs.getInt(KEY_USER_ID, -1);
    }

    public String getFullName() {
        return prefs.getString(KEY_FULL_NAME, "User");
    }

    public String getUsername() {
        return prefs.getString(KEY_USER_NAME, "username");
    }

    public String getToken() {
        return prefs.getString(KEY_TOKEN, null);
    }

    @SuppressWarnings("IfCanBeSwitch")
    public boolean isSessionActive() {
        int userId = prefs.getInt(KEY_USER_ID, -1);
        long lastUse = prefs.getLong(KEY_LAST_USE, 0);
        String token = getToken();

        if (userId == -1 || token == null || token.trim().isEmpty()) {
            return false;
        }

        long expiryTime = SESSION_TIMEOUT_DAYS * 24 * 60 * 60 * 1000;
        boolean active = (System.currentTimeMillis() - lastUse) < expiryTime;
        if (active) {
            RetrofitClient.setAuthToken(token);
        }
        return active;
    }
}
