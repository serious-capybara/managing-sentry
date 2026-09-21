package com.sentry.app.utils;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

public class NetworkUtils {

    private NetworkUtils() {
    }

    /**
     * Checks if the device is currently connected to the internet.
     * @param context Application context
     * @return true if connected, false otherwise
     */
    public static boolean isNetworkConnected(Context context) {
        if (context == null) return false;
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            
            Network activeNet = cm.getActiveNetwork();
            if (activeNet == null) return false;
            NetworkCapabilities cap = cm.getNetworkCapabilities(activeNet);
            return cap != null && (
                    cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    (cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                     cap.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                     cap.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
            );
        } catch (Exception e) {
            return false;
        }
    }
}
