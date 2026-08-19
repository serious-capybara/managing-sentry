# Managing Sentry

**Managing Sentry** is a custom Point of Sale (POS) and inventory management system built for Alekos’ Corner General Merchandise. The system is designed to streamline daily business operations by replacing inefficient paper-based processes with a reliable, hybrid digital solution.

The name reflects the system's core philosophy: **"Managing"** for organizing business data and **"Sentry"** for providing a reliable, safe, and dependable guardian for business records.

## Table of Contents
- [Executive Summary](#executive-summary)
- [Project Background](#background-of-the-project)
- [Statement of the Problem](#statement-of-the-problem)
- [Project Objectives](#project-objectives)
- [Scope and Limitations](#scope-and-limitations)
- [Significance of the Project](#significance-of-the-project)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Contributing](#contributing)

---

## Executive Summary

| Item | Details |
| :--- | :--- |
| **Problem Addressed** | Paper-based processes, physical paperwork storage issues, and manual writing errors. |
| **Proposed Solution** | A hybrid POS and inventory system operating both online and offline. |
| **Target Users** | Administrators, Managers, and Staff Members. |
| **Core Features** | Manual checkout, real-time stock updates, low stock alerts, and sales trend analytics. |
| **Key Benefit** | Faster checkouts, accurate tracking, and dependable offline operations. |

---

## Background of the Project

### Current Situation & Process Workflow
Alekos’ Corner General Merchandise is a family-run business. Their standard daily process involves store opening, processing customer sales, manual inventory checks, and purchasing/restocking. Currently, transactions are tracked using physical paper receipts, which are prone to loss and damage. Errors are corrected manually by crossing out or writing over data, leading to inconsistent records.

### Problems Encountered
- **Manual Overhead**: Pricing and restocking take excessive time.
- **Peak Hour Bottlenecks**: Manual writing slows down checkouts during busy late-night hours.
- **Record Security**: Physical receipts are easily lost or misplaced.
- **Reporting Gaps**: Lack of immediate access to sales trends or stock reports.

---

## Statement of the Problem

### General Problem
The business relies entirely on manual, paper-based processes for daily sales and inventory tracking, leading to slow checkouts, pricing errors, and high risk of financial record loss.

### Specific Problems
- **Inconsistent Receipt Management**: Vulnerable to physical loss or damage.
- **Manual Tracking Errors**: Delays in restocking critical items due to manual pricing mistakes.
- **Operational Bottlenecks**: handwriting receipts slows down service during peak times.
- **Lack of Analytics**: No automated daily or weekly reports for business decisions.

---

## Project Objectives

### General Objective
To design and implement **Managing Sentry**, a hybrid POS and inventory management system that digitizes transactions, automates tracking, and streamlines operations.

### Specific Objectives
- **Digitize Checkout**: Develop an Android application for fast, error-free sales processing.
- **Automate Inventory**: Build real-time stock tracking and low-stock alert features.
- **Web-Based Management**: Create a portal for owners to track trends and manage records.
- **Offline Functionality**: Ensure continuous operation during internet downtime via a local database.
- **Secure Storage**: Eliminate physical record risks through digital logs and backups.

---

## Scope and Limitations

### Project Scope
- **Android POS Application**: Digital checkout for staff, offline storage, and auto-sync capabilities.
- **Web Admin Portal**: Administrative controls, product catalog management, and sales monitoring.
- **Inventory Module**: Real-time quantity tracking and reorder estimates.
- **Reporting**: Automated daily/weekly movement reports.

### Project Limitations
- **Single-Business Customization**: Specifically built for Alekos’ Corner; not a multi-tenant retail system.
- **In-Store Only**: No customer-facing e-commerce or online ordering features.
- **Manual Input**: Relies on manual interface selection rather than barcode scanners.
- **Payment Processing**: Records cash/manual transactions; no direct credit card terminal integration.

---

## Significance of the Project

- **For Owners/Managers**: Elimination of paper clutter, risk reduction, and data-driven management.
- **For Staff/Workers**: Faster transactions, fewer manual errors, and uninterrupted operations.
- **For Customers**: Shorter wait times and reliable, accurate pricing.

---

## Tech Stack

- **Language**: Java 17+
- **Framework**: Android SDK
- **IDE**: Android Studio
- **Architecture**: Single-Activity, Fragment-based Navigation
- **UI Components**: 
  - Material 3 Design
  - Custom rounded "pill" cell layouts
  - Responsive weight-based column system
- **Optimization**: Tablet optimized (`layout-sw600dp`)
- **Animations**: 
  - 400ms Sliding Sidebar
  - Fragment Fade transitions
- **Database**: Local SQLite (for offline support)

---

## Getting Started

### 1. Prerequisites
- Android Studio Ladybug (or higher)
- JDK 17
- Android Tablet Emulator (sw600dp recommended)

### 2. Installation
```bash
git clone https://github.com/your-repo/Managing-Sentry.git
cd Managing-Sentry
```

### 3. Build and Run
1. Open the project in **Android Studio**.
2. Sync Project with Gradle Files.
3. Select a **Tablet Emulator** (e.g., Pixel Tablet).
4. Click **Run**.

---

## Architecture

### Directory Structure
```
app/src/main/
├── java/com/sentry/app/
│   ├── MainActivity.java      # Host Activity with Sidebar Toggle logic
│   ├── DashboardFragment.java # Multi-column sales entry with Cart
│   ├── ProductsFragment.java  # Inventory view
│   └── HistoryFragment.java   # Transaction logs with custom filters
└── res/
    ├── layout-sw600dp/        # Tablet-optimized layouts
    ├── layout/                # Base layouts (phone shells)
    ├── drawable/              # Custom shape selectors and icons
    ├── anim/                  # Navigation transitions
    └── values/                # Strings (Philippine Peso ₱), arrays, and colors
```

### Key UI Components
- **`pos_row.xml`**: Reusable data row with 9 configurable columns (Name, SRP, Qty, etc.).
- **`sort_dropdown.xml`**: Dense Material 3 dropdown for filtering.
- **`search_field.xml`**: Reusable borderless search bar.
- **`checkout_cart.xml`**: Bottom dashboard section with quantity controls.

---

## Contributing

We welcome contributions! To maintain a clean workflow, please follow these steps:

1. **Create your own branch** before making changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Follow the established **Clean Code** principles and naming conventions (e.g., `sidebar_bg`, `cell_white_bg`).
3. Ensure all new layouts are synchronized between `layout/` and `layout-sw600dp/`.
4. Commit your changes with descriptive messages:
   ```bash
   git commit -m "Add: realistic sample data for pharmaceutical products"
   ```
5. Push to your branch and open a **Pull Request**.

---

## License
Created for Alekos’ Corner General Merchandise under Heir Client Business Innovation. All rights reserved.
