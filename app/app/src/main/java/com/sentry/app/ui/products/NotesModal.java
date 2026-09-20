package com.sentry.app.ui.products;

import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.DialogFragment;

import com.sentry.app.R;

public class NotesModal extends DialogFragment {

    private String notes = "";

    public static NotesModal newInstance(String notes) {
        NotesModal fragment = new NotesModal();
        Bundle args = new Bundle();
        args.putString("notes", notes);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            notes = getArguments().getString("notes", "");
        }
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
        return inflater.inflate(R.layout.dialog_notes, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        
        TextView tvContent = view.findViewById(R.id.tv_notes_content);

        if (tvContent != null) {
            tvContent.setText(notes);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getDialog() != null && getDialog().getWindow() != null) {
            getDialog().getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            
            // Add a small buffer to the window width to prevent black corner artifacts
            int buffer = (int) (8 * getResources().getDisplayMetrics().density); // 4dp each side
            
            int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.80);
            boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
            if (isTablet) {
                width = (int) (getResources().getDisplayMetrics().widthPixels * 0.40);
            }
            getDialog().getWindow().setLayout(width + buffer, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
    }
}
