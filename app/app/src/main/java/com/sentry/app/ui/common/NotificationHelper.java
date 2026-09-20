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

import java.util.LinkedList;
import java.util.Queue;

public class NotificationHelper {

    private static class NotificationRequest {
        final Activity activity;
        final String message;
        final String highlight;
        final int backgroundColor;

        NotificationRequest(Activity activity, String message, String highlight, int backgroundColor) {
            this.activity = activity;
            this.message = message;
            this.highlight = highlight;
            this.backgroundColor = backgroundColor;
        }
    }

    private static final Queue<NotificationRequest> notificationQueue = new LinkedList<>();
    private static boolean isNotificationShowing = false;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void showNotification(Activity activity, String message, String highlight, int backgroundColor) {
        if (activity == null || activity.isFinishing()) return;
        
        mainHandler.post(() -> {
            notificationQueue.add(new NotificationRequest(activity, message, highlight, backgroundColor));
            processQueue();
        });
    }

    private static void processQueue() {
        if (isNotificationShowing || notificationQueue.isEmpty()) return;

        NotificationRequest request = notificationQueue.poll();
        if (request == null || request.activity == null || request.activity.isFinishing()) {
            processQueue();
            return;
        }

        isNotificationShowing = true;
        displayNotification(request);
    }

    private static void displayNotification(NotificationRequest request) {
        Activity activity = request.activity;
        ViewGroup rootView = activity.findViewById(android.R.id.content);
        if (rootView == null) {
            isNotificationShowing = false;
            processQueue();
            return;
        }

        LayoutInflater inflater = LayoutInflater.from(activity);
        View notificationView = inflater.inflate(R.layout.layout_notification_pill, rootView, false);
        notificationView.getBackground().setTint(request.backgroundColor);

        TextView tvMessage = notificationView.findViewById(R.id.tv_notif_message);
        
        if (request.highlight != null && !request.highlight.isEmpty()) {
            String fullText = request.message + " " + request.highlight;
            SpannableStringBuilder ssb = new SpannableStringBuilder(fullText);
            int start = request.message.length() + 1;
            int end = fullText.length();
            
            ssb.setSpan(new StyleSpan(Typeface.BOLD), start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            ssb.setSpan(new ForegroundColorSpan(Color.parseColor("#7DD3FC")), start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            
            tvMessage.setText(ssb);
        } else {
            tvMessage.setText(request.message);
        }

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.gravity = android.view.Gravity.TOP | android.view.Gravity.CENTER_HORIZONTAL;
        
        params.topMargin = (int) (64 * activity.getResources().getDisplayMetrics().density);
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

        mainHandler.postDelayed(() -> {
            if (activity.isFinishing()) {
                isNotificationShowing = false;
                processQueue();
                return;
            }
            
            notificationView.animate()
                    .alpha(0f)
                    .translationY(-50f)
                    .setDuration(400)
                    .setInterpolator(new AccelerateInterpolator())
                    .withEndAction(() -> {
                        rootView.removeView(notificationView);
                        isNotificationShowing = false;
                        mainHandler.postDelayed(NotificationHelper::processQueue, 300);
                    })
                    .start();
        }, 3500);
    }
}
