# Fix Menu Text Color Visibility

The user reports that the text color for the Dashboard, Products, History, and Log Out buttons becomes the same color as the menu background on a Samsung device, making them invisible. This is likely due to the buttons inheriting theme-default text colors (which might be dark) while the background is hardcoded to a dark color (`sidebar_bg`).

## Proposed Changes

### [UI Layouts]

I will explicitly set `android:textColor="@color/white"` for the four menu buttons in both the standard and tablet layout files. I will also ensure the `dash_menu_bg` drawable is available for all device types to prevent potential crashes on phones.

#### [MODIFY] [activity_main.xml](file:///home/restyaldave/Desktop/Axiom/Projects/Managing-Sentry/app/src/main/res/layout/activity_main.xml)
- Add `android:textColor="@color/white"` to `btn_dashboard`, `btn_products`, `btn_history`, and `btn_log_out`.

#### [MODIFY] [activity_main.xml](file:///home/restyaldave/Desktop/Axiom/Projects/Managing-Sentry/app/src/main/res/layout-sw600dp/activity_main.xml)
- Add `android:textColor="@color/white"` to `btn_dashboard`, `btn_products`, `btn_history`, and `btn_log_out`.

#### [NEW] [dash_menu_bg.xml](file:///home/restyaldave/Desktop/Axiom/Projects/Managing-Sentry/app/src/main/res/drawable/dash_menu_bg.xml)
- Create a base version of the menu background for non-tablet devices to ensure the sidebar is visible and the app doesn't crash when referencing this drawable.

## Verification Plan

### Manual Verification
- The user should deploy the app to their Samsung device via wireless debugging.
- Verify that the text "Dashboard", "Products", "History", and "Log Out" is now clearly visible in white against the dark blue sidebar.
