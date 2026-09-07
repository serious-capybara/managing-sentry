# Contributing to Managing Sentry

Thank you for contributing to Managing Sentry. This repository is organized as a monorepo with two separate application codebases:

- `app/` — Android application
- `web/` — Web application

This structure is intentional. Each project has its own dependencies, toolchain, and IDE workflow. Please follow the rules in this guide to keep the monorepo clean and avoid cross-project issues.

---

## 1. Monorepo Directory Structure Overview

At the root of the repository, you will find the main monorepo files and the two application folders:

```text
.
├── docker-compose.yml
├── .gitignore
├── README.md
├── .env
├── app/
│   └── ... Android project files and Gradle configuration
├── web/
│   └── ... Web project files and frontend configuration
└── ...
```

Important:
- `app/` contains the Android project and must be treated as a separate project root for Android development.
- `web/` contains the web frontend and must be treated as a separate project root for web development.
- The monorepo root should not be opened as the Android project root.
- The monorepo root should not be used as the primary workspace when working on the web app.

---

## 2. How to Open the Project in IDEs

### For Android Development (Android Studio / IntelliJ)

When working on the Android application:

1. Open only the `app/` directory in Android Studio or IntelliJ IDEA.
2. Do not open the main monorepo root folder as the project root for Android work.
3. Select `app/` as the project root so the IDE can correctly resolve:
   - Gradle files
   - Android module configuration
   - `.gradle/`
   - `.idea/`
   - local project metadata
   - generated build artifacts

Why this matters:
- It prevents the root monorepo directory from being polluted with Android-specific project metadata.
- It keeps Gradle configuration and local files inside the Android project folder.
- It avoids confusion between the web project and Android project tooling.

Use this rule strictly:
- Android tasks belong to `app/`
- Android files must remain inside `app/`

### For Web Development (VS Code / WebStorm)

When working on the web interface:

1. Open the `web/` folder directly in VS Code or WebStorm.
2. Do not open the monorepo root as the primary workspace for web development.
3. This allows the IDE to properly detect:
   - Node.js dependencies
   - package.json scripts
   - TypeScript or JavaScript config
   - frontend auto-completion and tooling
   - project-specific linting and runtime behavior

Why this matters:
- Opening the `web/` subdirectory directly allows the IDE to work with the correct project settings.
- It keeps the project configuration isolated and prevents the IDE from mixing root-level and project-level metadata.

---

## 3. Git Branching Strategy (Member-Based Branches)

Each collaborator added to the GitHub repository must work from a personal branch that identifies them.

### Branch Naming Rule

Use a branch name based on your name or your personal work identity, for example:

- `firstname-lastname`
- `firstname-feature`
- `jane-doe`

Examples:

```bash
git checkout -b firstname-lastname
```

### Required Workflow

1. Pull the latest changes from `main`:

```bash
git checkout main
git pull origin main
```

2. Create or switch to your personal branch:

```bash
git checkout -b yourname
```

If the branch already exists:

```bash
git checkout yourname
```

3. Make your changes locally.
4. Commit your work to your personal branch.
5. Push your branch to the remote repository.

```bash
git push -u origin yourname
```

6. Open a Pull Request to `main` after your branch is ready.

### Branch Rules

- Never commit directly to `main`.
- Do not work from someone else’s branch unless explicitly assigned.
- Keep each contributor’s work isolated to their own branch.
- Use descriptive commits, but keep them focused and related to the work being done.

---

## 4. Commit and Push Workflow

Before committing or pushing code, contributors must confirm they are working on their own branch.

### Check your current branch

From the repository root, run:

```bash
git branch --show-current
```

Your branch should match your personal branch name, for example:

```bash
firstname-lastname
```

If you are not on your own branch, switch to it:

```bash
git checkout yourname
```

### Important: run Git commands from the repo root

Because this is a monorepo, Git should be used from the main repository root, not from inside `app/` or `web/`.

If you are currently inside `app/` or `web/`, return to the monorepo root first:

```bash
cd ..
```

Then run your Git commands from the root:

```bash
git status
git add .
git commit -m "Describe your change"
git push -u origin yourname
```

### Commit rules

- Always verify the branch before committing.
- Commit only the files relevant to your task.
- Do not commit unrelated changes from the other project folder.
- If you are working on Android, keep the changes inside `app/`.
- If you are working on web, keep the changes inside `web/`.

---

## 5. Strict Rules for AI Coding Assistants

> **IMPORTANT: Strict AI Scope Boundaries**
>
> If you are using an AI coding assistant (e.g., GitHub Copilot, Cursor, ChatGPT, Claude) to write or modify code:
>
> - **App-only tasks:** The AI must only read and modify files located inside the `app/` directory. It must NEVER edit or modify any files inside the `web/` directory.
> - **Web-only tasks:** The AI must only read and modify files located inside the `web/` directory. It must NEVER edit or modify any files inside the `app/` directory.
> - **Isolation Rule:** This boundary prevents cross-contamination, broken dependencies, and unwanted side effects. Any issue caused by AI or manual changes should strictly remain isolated to its respective project folder (`app/` or `web/`).

This rule is mandatory for all contributors.

Examples:
- If you are fixing an Android bug, the AI must only operate inside `app/`.
- If you are fixing a frontend bug, the AI must only operate inside `web/`.
- Never allow one project to make edits in the other project unless explicitly approved and clearly scoped.

---

## 6. Recommended Local Development Workflow

### Android workflow

```bash
cd app
./gradlew assembleDebug
```

Then open the `app/` directory in Android Studio for live development and debugging.

### Web workflow

```bash
cd web
npm install
npm run dev
```

Then open the `web/` directory directly in VS Code or WebStorm for frontend development.

---

## 7. Pull Request Guidelines

Before opening a PR:

- Make sure your branch is up to date with `main`
- Run the relevant checks for your project
- Confirm the changes are isolated to the correct folder
- Ensure no accidental edits were made in the other project
- Review the diff before committing

PR titles should be clear and specific. Example:

- `Fix Android login validation`
- `Improve web dashboard responsiveness`
- `Add inventory filter to web UI`

---

## 8. Final Notes

This monorepo is intentionally split between `app/` and `web/`.

To keep the project stable:
- work inside the correct project folder
- use your own personal branch
- keep AI and manual changes isolated
- do not cross-edit between Android and web code

Thank you for helping keep the project organized, stable, and maintainable.

---
---

# Managing Sentry Local Setup Guide

This repository is a shared Git monorepo. The backend is run locally with Docker Compose, and the Android app connects to it over HTTP. Because this is a team project, some local configuration values are machine-specific and must stay local.

Use this guide in order.

## 1. Prerequisites

Install Docker before doing anything else.

- Install Docker Desktop if you are on a local workstation, or use Portainer if your team runs stacks through it.
- Make sure Docker is running and your account can access Docker/Portainer.
- If using Portainer, confirm you can create a stack and paste YAML content.

Do not start editing project files until Docker is installed and working.

## 2. Clone the repo and locate the compose file

Clone the repository to your machine, then open the project root.

```bash
git clone <repo-url>
cd Managing-Sentry
ls
```

At the repo root, you should see the main Docker file:

```text
./docker-compose.yml
```

This is the file the team uses to start the local backend stack.

## 3. IMPORTANT: edit your own local copy of docker-compose.yml before deploying

This is the most important rule for the team.

The project root `docker-compose.yml` is maintained by the project owner as the "master" file. It contains absolute bind mount paths that are correct for the owner's machine. Those paths must not be kept as-is for everyone else.

Because the backend uses Docker bind mounts, the path must be a real absolute filesystem path on your machine. Relative paths are not reliable in Portainer's Web Editor, and the Web Editor resolves paths relative to Portainer's internal storage rather than your local project folder.

Do this on your own machine before creating or deploying the stack:

1. Open the project root `docker-compose.yml` in your editor.
2. Change the bind mount paths for the `php` service to your own local checkout path.
3. If your `db` service also mounts `db/init.sql`, update that path too.
4. Do not commit this edited file back to Git.

Example:

Before (project owner's file):

```yaml
volumes:
  - /home/the-grand-capybara/Desktop/Axiom/Projects/Managing-Sentry/backend:/app
```

After (your local copy, example):

```yaml
volumes:
  - /home/their-username/wherever-they-cloned-it/Managing-Sentry/backend:/app
```

If the `db` service also has an init script mount, update it similarly:

```yaml
volumes:
  - /home/the-grand-capybara/Desktop/Axiom/Projects/Managing-Sentry/db/init.sql:/docker-entrypoint-initdb.d/init.sql
```

to:

```yaml
volumes:
  - /home/their-username/wherever-they-cloned-it/Managing-Sentry/db/init.sql:/docker-entrypoint-initdb.d/init.sql
```

Important notes:

- The mount path must be a real absolute path on your machine.
- It cannot stay as the project owner's path.
- It cannot stay relative like `./backend` when deploying via Portainer's Web Editor.
- This is a local-only change for your machine.

## 4. Deploy the stack in Portainer

After you have edited your local copy of `docker-compose.yml`, deploy it.

Choose one of these methods in Portainer:

- Paste the edited YAML into the Web Editor and deploy, or
- Go to `Stacks` > `Add Stack` and paste the edited YAML there

The important part is that you are deploying your edited local version, not the original shared file from the repo.

## 5. Do not push your edited docker-compose.yml back to Git

This file is intentionally local-only.

Do not run:

```bash
git add docker-compose.yml
git commit -m "Update docker compose paths"
git push
```

Do not commit your personal bind mount path or personal local configuration back to the shared repo.

If the project owner updates the official `docker-compose.yml` later, for example with new services, changed ports, or a different backend setup, then:

1. Pull the updated master file from Git.
2. Re-apply only your own local volume path edits to that new file.
3. Deploy again from your edited copy.
4. Do not keep using an old personal version.

Recommended options:

- Add `docker-compose.yml` to your local Git exclude, such as `.git/info/exclude`, so it will not be accidentally staged.
- Or simply be careful never to `git add` or commit it after editing.

Either approach is fine; pick the one that works best for you.

## 6. Android-side configuration

The Android app needs a backend URL in `RetrofitClient.java`.

### If testing on the Android Emulator

Use:

```java
private static final String BASE_URL = "http://10.0.2.2:8000/";
```

This is the standard Android emulator host loopback and works for everyone without edits.

### If testing on a real device over Wi‑Fi / wireless debugging

Use your own computer's local network IP address instead of `10.0.2.2` or `127.0.0.1`:

```java
private static final String BASE_URL = "http://192.168.x.x:8000/";
```

Find the correct IPv4 address on your computer:

Linux / Mac:

```bash
ip addr show
```

Windows:

```cmd
ipconfig
```

Look for your local network IPv4 address, such as `192.168.1.25`, and not `127.0.0.1`.

Also:

- Your PC and your Android device must be on the same Wi‑Fi network.
- `10.0.2.2` only works on the emulator; it will not work on a real device.
- This BASE_URL edit is also local-only and should not be committed with a personal IP hardcoded into it.

## 7. How to verify it's working

Once the stack is running:

```bash
docker ps -a
```

You should see both containers running and the PHP container should show the published port, for example `0.0.0.0:8000->8000/tcp`.

Then test the backend before testing from the Android app:

```text
http://localhost:8000/test.php
```

Open that URL in a browser or Postman. If it responds successfully, the PHP + Postgres stack is up and serving files from the mounted `backend/` folder.

## 8. Common mistakes

- Forgetting to update the bind mount path in `docker-compose.yml` results in an empty `/app` folder inside the PHP container and many 404s.
- Accidentally committing your personal `docker-compose.yml` path edits or personal Android `BASE_URL` IP changes to Git.
- Using `10.0.2.2` on a real device by mistake. This only works in the Android emulator.
- Keeping a stale personal `docker-compose.yml` after the project owner updates the official file.

Follow the local-only rule: machine-specific paths and IPs stay local, and the shared Git repo stays clean.

## Final reminder

This repo is shared, but the machine-specific values below are not meant to be shared:

- `docker-compose.yml` absolute bind mount paths
- `db/init.sql` absolute bind mount paths
- Android `BASE_URL` with a personal IP address

Keep those edits local, deploy them locally, and do not push them back to the shared repo.