package com.sentry.app.ui;

import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.DialogFragment;

import com.sentry.app.R;

/**
 * LogoutDialogFragment provides a simple but professional confirmation before ending the session.
 * Follows @ui-ux-pro-max and @frontend-design principles.
 */
public class LogoutDialogFragment extends DialogFragment {

    public interface LogoutListener {
        void onConfirmLogout();
    }

    private LogoutListener listener;

    public void setLogoutListener(LogoutListener listener) {
        this.listener = listener;
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {
        Dialog dialog = super.onCreateDialog(savedInstanceState);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }
        return dialog;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.logout_modal, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        Button btnCancel = view.findViewById(R.id.btn_logout_cancel);
        Button btnConfirm = view.findViewById(R.id.btn_logout_confirm);

        btnCancel.setOnClickListener(v -> dismiss());
        
        btnConfirm.setOnClickListener(v -> {
            if (listener != null) {
                listener.onConfirmLogout();
            }
            dismiss();
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getDialog() != null && getDialog().getWindow() != null) {
            boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
            int width;
            if (isTablet) {
                // Fixed professional width for tablet
                width = (int) (450 * getResources().getDisplayMetrics().density);
            } else {
                // Percentage-based for phone
                width = (int) (getResources().getDisplayMetrics().widthPixels * 0.85);
            }
            getDialog().getWindow().setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }
}
