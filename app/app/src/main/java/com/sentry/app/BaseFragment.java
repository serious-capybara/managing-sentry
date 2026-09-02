package com.sentry.app;

import android.view.View;
import android.widget.TextView;

import androidx.annotation.ArrayRes;
import androidx.fragment.app.Fragment;

import com.google.android.material.textfield.MaterialAutoCompleteTextView;

/**
 * Base class for fragments in the Sentry app.
 * Centrally manages common UI operations and utilities.
 */
public abstract class BaseFragment extends Fragment {

    /**
     * Initializes a MaterialAutoCompleteTextView with items from a string array resource.
     *
     * @param view              The parent view containing the dropdown.
     * @param dropdownId        The resource ID of the dropdown view.
     * @param optionsArrayResId The resource ID of the string array containing options.
     */
    protected void setupDropdown(View view, int dropdownId, @ArrayRes int optionsArrayResId) {
        if (view == null) return;
        
        String[] options = getResources().getStringArray(optionsArrayResId);
        MaterialAutoCompleteTextView dropdown = view.findViewById(dropdownId);
        
        if (dropdown != null && options.length > 0) {
            dropdown.setSimpleItems(options);
            dropdown.setText(options[0], false);
        }
    }

    /**
     * Hides a set of views by setting their visibility to GONE.
     *
     * @param root The parent view containing the views to hide.
     * @param ids  The resource IDs of the views to hide.
     */
    protected void hideViews(View root, int... ids) {
        if (root == null) return;
        for (int id : ids) {
            View view = root.findViewById(id);
            if (view != null) {
                view.setVisibility(View.GONE);
            }
        }
    }

    /**
     * Sets the text of a TextView.
     *
     * @param root The parent view containing the TextView.
     * @param id   The resource ID of the TextView.
     * @param text The text to set.
     */
    protected void setText(View root, int id, String text) {
        if (root == null) return;
        TextView textView = root.findViewById(id);
        if (textView != null) {
            textView.setText(text);
        }
    }
}
