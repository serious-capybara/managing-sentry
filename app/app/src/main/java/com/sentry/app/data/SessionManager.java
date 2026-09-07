package com.sentry.app.data;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * SessionManager handles persistent user sessions.
 * Follows Clean Code by encapsulating SharedPreferences logic.
 */
public class SessionManager {
    private static final String PREFS_NAME = "sentry_prefs";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_FULL_NAME = "full_name";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_ROLE = "role";
    private static final String KEY_LAST_USE = "last_use_timestamp";
    private static final long SESSION_TIMEOUT_DAYS = 7L;

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public void saveUser(User user) {
        if (user == null) return;
        
        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt(KEY_USER_ID, user.getUserId());
        
        if (user.getFullName() != null) editor.putString(KEY_FULL_NAME, user.getFullName());
        if (user.getUserName() != null) editor.putString(KEY_USER_NAME, user.getUserName());
        if (user.getRole() != null) editor.putString(KEY_ROLE, user.getRole());
        
        editor.putLong(KEY_LAST_USE, System.currentTimeMillis());
        editor.apply();
    }

    public void refreshTimestamp() {
        prefs.edit().putLong(KEY_LAST_USE, System.currentTimeMillis()).apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
    }

    public String getFullName() {
        return prefs.getString(KEY_FULL_NAME, "User");
    }

    public String getUserName() {
        return prefs.getString(KEY_USER_NAME, "username");
    }

    public boolean isSessionActive() {
        int userId = prefs.getInt(KEY_USER_ID, -1);
        long lastUse = prefs.getLong(KEY_LAST_USE, 0);

        if (userId == -1) return false;

        long expiryTime = SESSION_TIMEOUT_DAYS * 24 * 60 * 60 * 1000;
        return (System.currentTimeMillis() - lastUse) < expiryTime;
    }
}
