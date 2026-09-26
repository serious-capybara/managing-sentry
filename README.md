# Managing Sentry

> **A hybrid Point of Sale and Inventory Management System** built for Alekos' Corner General Merchandise — digitizing daily business operations with offline resilience and real-time data access.

---

> [!NOTE]
> **Dual Backend Notice:** This repository contains two parallel backend implementations maintained for academic evaluation purposes — a **PHP backend** (`backend/`) and a **FastAPI (Python) backend** (`backend-fastapi/`). Both implement the same core functionality. After project defense, the team will officially adopt one and archive the other. See [Architecture](#architecture) for details.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Clone the Repository](#clone-the-repository)
  - [Running the Backend (Docker)](#running-the-backend-docker)
  - [Running the Android App](#running-the-android-app)
  - [Running the Web Portal](#running-the-web-portal)
- [Project Background](#project-background)
- [Scope and Limitations](#scope-and-limitations)
- [Significance](#significance)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Managing Sentry** is a custom business management system designed to replace the paper-based workflows of a small family-run general merchandise store. The system combines an **Android POS application**, a **web-based admin portal**, and a **dockerized backend** to provide reliable, accurate, and fast business operations — even without an internet connection.

The name reflects the system's philosophy: **Managing** for organizing business data, and **Sentry** for being a dependable guardian of business records.

| | |
|:---|:---|
| **Problem Solved** | Paper-based sales tracking, manual inventory errors, and lack of business reporting |
| **Solution** | Hybrid POS + inventory system with offline support and real-time sync |
| **Target Users** | Store owners, managers, and staff |
| **Key Benefit** | Faster checkouts, accurate stock tracking, and data-driven decisions |

---

## Features

- **Digital Checkout** — Fast, error-free sales processing on Android tablets
- **Real-Time Inventory Tracking** — Automatic stock deduction on each transaction
- **Low Stock Alerts** — Proactive notifications before items run out
- **Offline Functionality** — Local SQLite database ensures uninterrupted operations during downtime
- **Auto-Sync** — Synchronizes offline transactions with the central database on reconnection
- **Web Admin Portal** — Browser-based dashboard for product management, sales monitoring, and reporting
- **Transaction History** — Filterable logs of all past sales and inventory movements
- **Sales Analytics** — Daily and weekly trend reports for informed restocking decisions
- **Role-Based Access** — Separate access levels for Admins, Managers, and Staff

---

## Tech Stack

### Android Application (`app/`)

| Layer | Technology |
|:---|:---|
| Language | Java |
| Platform | Android SDK |
| Build System | Gradle |
| Architecture | Single-Activity, Fragment-based navigation |
| Local Database | SQLite (offline storage) |
| Networking | Retrofit (HTTP client) |
| IDE | Android Studio (recommended) |

### Web Portal (`web/`)

| Layer | Technology |
|:---|:---|
| Structure | HTML5 |
| Styling | CSS3 |
| Logic | Vanilla JavaScript |

### Backend — PHP (`backend/`)

| Layer | Technology |
|:---|:---|
| Language | PHP 8.2 |
| Server | PHP built-in server (via Docker) |
| Database Driver | PDO with `pdo_pgsql` |
| Runtime | Docker (`php:8.2-cli`) |
| Port | `8000` |

### Backend — FastAPI (`backend-fastapi/`)

| Layer | Technology |
|:---|:---|
| Language | Python 3.11 |
| Framework | FastAPI |
| Server | Uvicorn (ASGI) |
| Runtime | Docker (`python:3.11-slim`) |
| Port | `8001` |

### Infrastructure

| Component | Technology |
|:---|:---|
| Database | PostgreSQL 18 (Docker) |
| Container Orchestration | Docker Compose |
| DB Port (host → container) | `5433` → `5432` |

---

## Architecture

### Monorepo Directory Structure

```text
Managing-Sentry/
├── app/                        # Android POS application (Java, Gradle)
│   └── app/src/main/
│       ├── java/com/sentry/app/
│       │   ├── MainActivity.java         # Host activity, sidebar/navigation
│       │   ├── DashboardFragment.java    # Sales entry and cart management
│       │   ├── ProductsFragment.java     # Inventory view and stock management
│       │   └── HistoryFragment.java      # Transaction logs with filters
│       └── res/
│           ├── layout/                   # Base layouts (phone shells)
│           ├── layout-sw600dp/           # Tablet-optimized layouts
│           ├── drawable/                 # Custom shapes, selectors, and icons
│           ├── anim/                     # Navigation transition animations
│           └── values/                   # Strings (₱ Philippine Peso), arrays, colors
│
├── web/                        # Web admin portal (HTML, CSS, JavaScript)
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── backend/                    # PHP backend (PDO + PostgreSQL)
│   └── app/
│       ├── api/                          # API endpoint handlers
│       ├── config/                       # Database configuration
│       ├── core/                         # Core utilities
│       └── init.php                      # Application bootstrap
│
├── backend-fastapi/            # FastAPI backend (Python + PostgreSQL)
│   └── app/
│       ├── api/                          # API route definitions
│       ├── core/                         # Core config and security
│       ├── database/                     # Database session and connection
│       ├── models/                       # SQLAlchemy ORM models
│       ├── routers/                      # FastAPI routers
│       └── requirements.txt
│
├── db/                         # Database initialization scripts
├── docker-compose.yml          # Orchestrates PostgreSQL, PHP, and FastAPI services
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

### Dual Backend Service Map

All services run simultaneously via Docker Compose and share the same PostgreSQL instance:

| Service | Stack | Serves | Host Port |
|:---|:---|:---|:---|
| `php-app` | PHP 8.2 | Android-facing API (`backend/app`) | `8000` |
| `php-web` | PHP 8.2 | Web portal API (`backend/web`) | `8002` |
| `fastapi` | Python 3.11 + FastAPI | Android-facing API (`backend-fastapi/app`) | `8001` |
| `fastapi-web` | Python 3.11 + FastAPI | Web portal API (`backend-fastapi/web`) | `8003` *(planned)* |
| `db` | PostgreSQL 18 | Shared database | `5433` |

> [!NOTE]
> `fastapi-web` is a **planned service** — `backend-fastapi/web/` has not been implemented yet. When development begins, a dedicated `fastapi-web` container (port `8003`) will be added to `docker-compose.yml` to serve the web portal API separately, following the same pattern as `php-app` / `php-web`.

---

## Getting Started

### Prerequisites

Ensure the following are installed before proceeding:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- [Android Studio](https://developer.android.com/studio) (stable release)
- JDK 17 or later
- A modern web browser (for the web portal)

---

### Clone the Repository

```bash
git clone <repo-url>
cd Managing-Sentry
```

---

### Running the Backend (Docker)

> [!IMPORTANT]
> The `docker-compose.yml` contains absolute bind mount paths set to the project owner's machine. **You must update these paths to your own local checkout path before deploying.** Do not commit your edited version back to Git.

**1. Edit `docker-compose.yml`** — update the `volumes` bind mount paths for all three PHP and FastAPI services:

```yaml
# php-app service — Android-facing API (backend/app)
# Before:
  - /home/the-grand-capybara/Desktop/.../backend/app:/app
# After (your path):
  - /home/YOUR_USERNAME/path/to/Managing-Sentry/backend/app:/app

# php-web service — Web portal API (backend/web)
# Before:
  - /home/the-grand-capybara/Desktop/.../backend/web:/app
# After (your path):
  - /home/YOUR_USERNAME/path/to/Managing-Sentry/backend/web:/app

# fastapi service — FastAPI backend (backend-fastapi/app)
# Before:
  - /home/the-grand-capybara/Desktop/.../backend-fastapi/app:/app
# After (your path):
  - /home/YOUR_USERNAME/path/to/Managing-Sentry/backend-fastapi/app:/app
```

**2. Create your local `.env` file** in the repo root with the required database credentials (refer to `.env.example` inside `backend/app/` for the required variables).

**3. Start all services:**

```bash
docker compose up -d
```

**4. Verify the stack is running:**

```bash
docker ps -a
```

You should see four containers running: `db` (PostgreSQL), `php-app`, `php-web`, and `fastapi`.

**5. Test the backends:**

```
PHP Android API:  http://localhost:8000
PHP Web API:      http://localhost:8002
FastAPI backend:  http://localhost:8001/docs
```

> [!NOTE]
> A `fastapi-web` service (port `8003`) is planned for the future once `backend-fastapi/web/` is implemented. When ready, it will be added to `docker-compose.yml` as a dedicated container serving the web portal FastAPI backend — mirroring the same `php-app` / `php-web` separation pattern.

> [!WARNING]
> Never commit your personal bind mount paths or `.env` credentials to the shared repository. These are local-only configurations.


---

### Running the Android App

**1. Open the `app/` directory** in Android Studio (do **not** open the monorepo root).

**2. Sync Gradle** files when prompted.

**3. Configure the backend URL** in `RetrofitClient.java`:

```java
// For Android Emulator:
private static final String BASE_URL = "http://10.0.2.2:8000/";

// For a real device over Wi-Fi (replace with your machine's local IP):
private static final String BASE_URL = "http://192.168.x.x:8000/";
```

> Find your local IP on Linux/macOS with `ip addr show`, or on Windows with `ipconfig`. Do not commit a personal IP address back to the repository.

**4. Select a tablet emulator** (e.g., Pixel Tablet) and click **Run**.

---

### Running the Web Portal

The web portal is a static application with no build step required. Open `web/index.html` directly in a browser, or serve it locally:

```bash
cd web
npx serve .
```

---

## Project Background

Alekos' Corner General Merchandise is a family-run store whose daily operations — sales processing, inventory tracking, and restocking — were all managed on physical paper receipts. This introduced recurring operational problems:

| Problem | Impact |
|:---|:---|
| **Manual overhead** | Pricing and restocking consumed excessive time |
| **Peak-hour bottlenecks** | Handwriting receipts slowed checkout during busy hours |
| **Record insecurity** | Physical receipts were easily lost, damaged, or misplaced |
| **No analytics** | No access to sales trends, stock levels, or business reports |

**Managing Sentry** was built to address each of these issues through digitization, automation, and resilient offline support.

---

## Scope and Limitations

### In Scope

- Android tablet POS application with offline storage and auto-sync
- Web-based admin portal for product management and sales monitoring
- Real-time inventory tracking with low-stock alerts
- Automated daily and weekly movement reports
- Role-based access control for Admins, Managers, and Staff

### Out of Scope

| Limitation | Reason |
|:---|:---|
| Multi-tenant support | Built exclusively for Alekos' Corner; not a general retail platform |
| E-commerce / online ordering | No customer-facing storefront |
| Barcode scanning | Relies on manual product selection |
| Payment terminal integration | Records cash transactions only; no credit card processing |

---

## Significance

| Stakeholder | Benefit |
|:---|:---|
| **Owners / Managers** | Elimination of paper clutter, reduced financial risk, and data-driven decision making |
| **Staff** | Faster transactions, fewer manual errors, and uninterrupted operations during outages |
| **Customers** | Shorter wait times and accurate, reliable pricing at checkout |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before starting any work. The guide covers:

- Monorepo structure and IDE setup rules
- Git branching strategy (personal branch workflow)
- Commit and push conventions
- Docker local setup and configuration rules
- Android and web development workflows
- Pull Request guidelines
- AI coding assistant scope boundaries

**Quick summary:**
1. Always work from your own personal branch (e.g., `firstname-lastname`).
2. Never commit directly to `main`.
3. Keep Android changes inside `app/` and web changes inside `web/`.
4. Run all Git commands from the monorepo root, not from inside a subdirectory.
5. Open a Pull Request when your branch is ready for review.

---

## License

Created for **Alekos' Corner General Merchandise** under Heir Client Business Innovation. All rights reserved.
