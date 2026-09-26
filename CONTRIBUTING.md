# Contributing to Managing Sentry

Thank you for taking the time to contribute. This document is the single source of truth for how work is organized, committed, and reviewed in this repository. Please read it fully before opening any branch or pull request.

---

## Table of Contents

- [Repository Structure](#repository-structure)
- [Opening the Project in an IDE](#opening-the-project-in-an-ide)
- [Branching Strategy](#branching-strategy)
- [Commit and Push Workflow](#commit-and-push-workflow)
- [AI Coding Assistant Rules](#ai-coding-assistant-rules)
- [Local Development Workflows](#local-development-workflows)
- [Local Backend Setup (Docker)](#local-backend-setup-docker)
- [Local Database Setup (pgAdmin4)](#local-database-setup-pgadmin4)
- [Android Network Configuration](#android-network-configuration)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Common Mistakes](#common-mistakes)

---

## Repository Structure

This is a **monorepo** containing multiple separate project codebases. Each sub-project has its own dependencies, toolchain, and IDE configuration.

```text
Managing-Sentry/
├── app/                  # Android POS application (Java, Gradle)
├── web/                  # Web admin portal (HTML, CSS, JavaScript)
├── backend/              # PHP 8.2 backend (PDO + PostgreSQL)
├── backend-fastapi/      # FastAPI backend (Python 3.11 + PostgreSQL)
├── db/                   # Database initialization scripts
├── docker-compose.yml    # Orchestrates all backend services
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

**Rules:**
- `app/` is the Android project root. It must be opened and treated as a standalone Android project.
- `web/` is the web project root. It must be opened and treated as a standalone web project.
- The monorepo root should **not** be used as the Android or web project root.
- Changes to Android code must stay inside `app/`.
- Changes to web code must stay inside `web/`.

---

## Opening the Project in an IDE

### Android Development — Android Studio or IntelliJ IDEA

Open **only** the `app/` directory as the project root, not the monorepo root.

```
File → Open → [select the app/ folder]
```

This ensures the IDE correctly resolves:
- Gradle files and Android module configuration
- `.gradle/` and `.idea/` metadata
- Generated build artifacts and local project settings

> [!WARNING]
> Opening the monorepo root in Android Studio will pollute the repository root with Android-specific metadata and break Gradle resolution.

### Web Development — VS Code or WebStorm

Open **only** the `web/` directory as the workspace root.

```
File → Open Folder → [select the web/ folder]
```

This ensures the IDE correctly resolves:
- `package.json` scripts and Node.js configuration
- TypeScript or JavaScript tooling
- Linting, formatting, and auto-completion

---

## Branching Strategy

Every contributor works from a **personal branch** that identifies them by name.

### Branch Naming

Use your name or work identity as the branch name:

```
firstname-lastname
firstname-feature
```

Examples: `jane-doe`, `john-feature`, `ana-santos`

### Creating Your Branch

**1. Pull the latest changes from `main`:**

```bash
git checkout main
git pull origin main
```

**2. Create your personal branch:**

```bash
git checkout -b firstname-lastname
```

If your branch already exists:

```bash
git checkout firstname-lastname
```

**3. Make your changes, commit, and push:**

```bash
git add .
git commit -m "Short, descriptive summary of the change"
git push -u origin firstname-lastname
```

**4. Open a Pull Request** to `main` when your work is ready for review.

### Branch Rules

| Rule | Details |
|:---|:---|
| No direct commits to `main` | All changes go through a Pull Request |
| Stay on your own branch | Do not work from another contributor's branch unless explicitly assigned |
| Isolate your scope | Do not mix Android and web changes in the same branch or commit |
| Write descriptive commits | Each commit message should clearly explain what changed and why |

---

## Commit and Push Workflow

> [!IMPORTANT]
> Always run Git commands from the **monorepo root**, not from inside `app/` or `web/`. Each sub-project is not a separate Git repository.

### Step-by-Step Workflow

**1. Return to the monorepo root if you are inside a subdirectory:**

```bash
cd ..
```

**2. Verify you are on your own branch:**

```bash
git branch --show-current
```

The output should match your personal branch name. If not, switch:

```bash
git checkout firstname-lastname
```

**3. Check the status of your changes:**

```bash
git status
```

**4. Stage only the relevant files:**

```bash
git add path/to/changed/file
```

Avoid `git add .` unless you have verified every modified file belongs to your current task.

**5. Commit with a clear message:**

```bash
git commit -m "Fix low stock alert not triggering on zero quantity"
```

**6. Push to your remote branch:**

```bash
git push -u origin firstname-lastname
```

### Commit Message Guidelines

Write commit messages in the **imperative mood**, as if completing the sentence: *"This commit will…"*

| Good | Bad |
|:---|:---|
| `Add product search to inventory screen` | `added stuff` |
| `Fix crash on empty cart checkout` | `fix bug` |
| `Update RetrofitClient base URL for emulator` | `changed url` |

---

## AI Coding Assistant Rules

> [!IMPORTANT]
> **Strict scope boundaries apply when using AI coding assistants** (e.g., GitHub Copilot, Cursor, Claude, ChatGPT).

| Task | AI Must Only Touch |
|:---|:---|
| Android development | Files inside `app/` only |
| Web development | Files inside `web/` only |
| PHP backend | Files inside `backend/` only |
| FastAPI backend | Files inside `backend-fastapi/` only |

**The AI must never cross project boundaries.** Any issue caused by AI-generated code must remain isolated to its respective folder. Cross-contamination between `app/` and `web/` is strictly prohibited and can break builds, introduce dependency conflicts, and corrupt project-specific tooling.

This rule applies to all contributors without exception.

---

## Local Development Workflows

### Android

```bash
cd app
./gradlew assembleDebug
```

Then open the `app/` directory in Android Studio for live development and debugging.

### Web Portal

The web portal has no build step. Open `web/index.html` in a browser directly, or serve it:

```bash
cd web
npx serve .
```

### Backend (PHP or FastAPI)

See [Local Backend Setup (Docker)](#local-backend-setup-docker) below.

---

## Local Backend Setup (Docker)

The backend services are run locally using Docker Compose. This section explains how to configure and start the stack on your machine.

### 1. Install Docker

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Compose. Confirm Docker is running before proceeding.

### 2. Clone and Locate the Compose File

```bash
git clone <repo-url>
cd Managing-Sentry
ls
```

You should see `docker-compose.yml` at the repo root. This file orchestrates three services: `db`, `php`, and `fastapi`.

### 3. Update Bind Mount Paths

> [!IMPORTANT]
> The `docker-compose.yml` contains absolute paths from the project owner's machine. These paths **will not work on your machine**. You must update them before deploying.

Open `docker-compose.yml` and replace the bind mount paths for the `php` and `fastapi` services with your own local checkout path:

```yaml
# Before (project owner's path):
volumes:
  - /home/the-grand-capybara/Desktop/Axiom/Projects/Managing-Sentry/backend:/app

# After (your path):
volumes:
  - /home/YOUR_USERNAME/path/to/Managing-Sentry/backend:/app
```

Apply the same change to the `fastapi` service and any `db` volume mounts if present.

> [!CAUTION]
> Do **not** commit your edited `docker-compose.yml` back to Git. Your personal absolute paths should never exist in the shared repository. To prevent accidental staging, you can add it to your local Git exclude:
> ```bash
> echo "docker-compose.yml" >> .git/info/exclude
> ```

### 4. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp backend/app/.env.example backend/app/.env
```

Edit the `.env` file with your database credentials. Do not commit `.env` files to Git.

### 5. Start the Stack

```bash
docker compose up -d
```

### 6. Verify and Test

```bash
docker ps -a
```

You should see three containers running: `db`, `php`, and `fastapi`.

Test each backend:

```
PHP backend:     http://localhost:8000/test.php
FastAPI backend: http://localhost:8001/docs
```

### 7. Updating the Stack After Owner Changes

If the project owner updates `docker-compose.yml` (e.g., new services or changed ports):

1. Pull the updated file from Git.
2. Re-apply your personal bind mount path edits.
3. Re-deploy the stack.
4. Do not keep running an outdated personal copy.

---

## Local Database Setup (pgAdmin4)

Each contributor runs their own isolated local PostgreSQL instance. This is intentional — there is no shared team database during local development. Test data will differ between machines.

### Connecting to Your Local Docker Database

1. Open **pgAdmin4**.
2. Right-click `Servers` → `Register` → `Server`.
3. In the **General** tab, give the connection a descriptive name (e.g., `Local Docker`).
4. In the **Connection** tab, fill in the following:

| Field | Value |
|:---|:---|
| Host name/address | `localhost` |
| Port | `5433` (matches the left side of `5433:5432` in `docker-compose.yml`) |
| Maintenance database | `postgres` |
| Username | Value of `DB_USER` from your local `.env` |
| Password | Value of `DB_PASSWORD` from your local `.env` |

5. Click **Save**.

### Creating the Application Database

1. Expand your new server → right-click `Databases` → `Create` → `Database`.
2. Name it to match `DB_NAME` from your `.env` (e.g., `sentry`).
3. Click **Save**.

> Use a dedicated application database, not the default `postgres` database. The `postgres` database is reserved for admin and maintenance purposes.

### Creating the `users` Table

Expand your database → `Schemas` → `public` → `Tables` → right-click `Tables` → `Create` → `Table`.

Create the table with the following columns:

| Column | Type | Constraints |
|:---|:---|:---|
| `user_id` | `integer` | Primary Key, Identity / Auto-increment |
| `full_name` | `character varying` | — |
| `user_name` | `character varying` | Unique |
| `password_hash` | `character varying` | — |
| `role` | `character varying` | — |

### Password Hashing

> [!CAUTION]
> Never store plain-text passwords in the `password_hash` column. Always hash passwords before inserting them.

The backend uses PHP's `password_hash()` for registration and `password_verify()` for login. To manually generate a hashed password for a test user, run:

```bash
php -r "echo password_hash('YOUR_PLAIN_TEXT_PASSWORD', PASSWORD_BCRYPT, ['cost' => 12]) . PHP_EOL;"
```

Copy the output and paste it into the `password_hash` column. Prefer creating test users through the app's registration flow whenever possible, as this exercises the full hashing logic.

---

## Android Network Configuration

The Android app communicates with the backend via `RetrofitClient.java`. The base URL must match your local setup.

### Emulator (Standard)

```java
private static final String BASE_URL = "http://10.0.2.2:8000/";
```

`10.0.2.2` is the Android emulator's loopback alias for the host machine's `localhost`. This works for all contributors without modification.

### Real Device over Wi-Fi

```java
private static final String BASE_URL = "http://192.168.x.x:8000/";
```

Replace `192.168.x.x` with your machine's local network IPv4 address:

```bash
# Linux / macOS:
ip addr show

# Windows:
ipconfig
```

**Requirements:**
- Your PC and Android device must be on the same Wi-Fi network.
- `10.0.2.2` does **not** work on physical devices.
- Do not commit a personal IP address to the repository.

---

## Pull Request Guidelines

Before opening a Pull Request:

- [ ] Your branch is up to date with `main`
- [ ] Changes are isolated to the correct project folder (`app/`, `web/`, `backend/`, or `backend-fastapi/`)
- [ ] No accidental edits exist in an unrelated project folder
- [ ] All relevant checks pass (Gradle build, linting, etc.)
- [ ] You have reviewed the diff before submitting

### PR Title Format

Write PR titles that are specific and descriptive:

| Good | Bad |
|:---|:---|
| `Fix Android login validation on empty password` | `fix stuff` |
| `Add low stock alert to inventory screen` | `update` |
| `Improve web dashboard table responsiveness` | `dashboard changes` |

### PR Description

Include a brief description of:
- What was changed and why
- How it was tested
- Any known limitations or follow-up tasks

---

## Common Mistakes

| Mistake | Consequence | Prevention |
|:---|:---|:---|
| Opening the monorepo root in Android Studio | Corrupts root with Android metadata; breaks Gradle | Open only `app/` in Android Studio |
| Forgetting to update bind mount paths in `docker-compose.yml` | Empty `/app` in container; 404 errors on all endpoints | Edit paths before deploying |
| Committing personal `docker-compose.yml` edits | Personal paths exposed in the shared repo | Add to `.git/info/exclude` or never `git add` it |
| Committing `BASE_URL` with a personal IP | Breaks the app for all other contributors | Use `10.0.2.2` for emulator; never commit a real IP |
| Running `git add .` without checking `git status` | Unrelated files from other project folders get staged | Always review `git status` before staging |
| Committing directly to `main` | Bypasses review; can introduce unstable code | Always work from your personal branch |
| Using `10.0.2.2` on a real device | Connection refused; the alias only works on the emulator | Use your machine's local IPv4 for physical devices |

---

*Thank you for contributing. Please keep the repository clean, your branches focused, and your commits descriptive. If you have questions, open an issue and a maintainer will respond.*