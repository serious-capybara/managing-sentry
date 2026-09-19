package com.sentry.app.ui.common;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.sentry.app.R;

public class NotificationHelper {

    public static void showNotification(Activity activity, String message, String highlight, int backgroundColor) {
        if (activity == null || activity.isFinishing()) return;

        ViewGroup rootView = activity.findViewById(android.R.id.content);
        if (rootView == null) return;

        LayoutInflater inflater = LayoutInflater.from(activity);
        View notificationView = inflater.inflate(R.layout.layout_notification_pill, rootView, false);

        notificationView.getBackground().setTint(backgroundColor);

        TextView tvMessage = notificationView.findViewById(R.id.tv_notif_message);
        
        if (highlight != null && !highlight.isEmpty()) {
            String fullText = message + " " + highlight;
            SpannableStringBuilder ssb = new SpannableStringBuilder(fullText);
            int start = message.length() + 1;
            int end = fullText.length();
            
            ssb.setSpan(new StyleSpan(Typeface.BOLD), start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            ssb.setSpan(new ForegroundColorSpan(Color.parseColor("#7DD3FC")), start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            
            tvMessage.setText(ssb);
        } else {
            tvMessage.setText(message);
        }

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.gravity = android.view.Gravity.TOP | android.view.Gravity.CENTER_HORIZONTAL;
        
        int topMarginDp = 64;
        params.topMargin = (int) (topMarginDp * activity.getResources().getDisplayMetrics().density);
        notificationView.setLayoutParams(params);

        notificationView.setAlpha(0f);
        notificationView.setTranslationY(-50f);

        rootView.addView(notificationView);

        notificationView.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(400)
                .setInterpolator(new DecelerateInterpolator())
                .start();

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (activity.isFinishing()) return;
            
            notificationView.animate()
                    .alpha(0f)
                    .translationY(-50f)
                    .setDuration(400)
                    .setInterpolator(new AccelerateInterpolator())
                    .withEndAction(() -> rootView.removeView(notificationView))
                    .start();
        }, 2500);
    }
}
