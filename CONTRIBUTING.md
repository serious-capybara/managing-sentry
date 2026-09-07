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

# Local Docker / Portainer Setup (team-specific)

This section is for local development only. Some values in this repo are machine-specific and must stay local on each teammate's computer.

### 1. Prerequisites

Install Docker before doing anything else.

- Install Docker Desktop if you are working locally, or use Portainer if your team runs stacks through it.
- Make sure Docker is running.
- If you are using Portainer, confirm you can create a stack and paste YAML content.

### 2. Clone the repo and find the compose file

```bash
git clone <repo-url>
cd Managing-Sentry
ls
```

At the repo root, you will find:

```text
./docker-compose.yml
```

This is the file used to start the backend stack locally.

### 3. IMPORTANT: edit your own local copy before deploying

The root `docker-compose.yml` is the project owner's master file. It contains absolute bind mount paths for their machine. Those paths are not valid for everyone else.

Before creating or deploying the stack, each teammate must edit their own local copy of `docker-compose.yml` and change the bind mount paths to match their own machine.

This is required because Docker bind mounts need a real absolute filesystem path on the machine running Docker. Relative paths do not work reliably in Portainer's Web Editor, and Portainer resolves them against its own internal storage instead of your local project folder.

Example:

Before (owner's machine):

```yaml
volumes:
  - /home/the-grand-capybara/Desktop/Axiom/Projects/Managing-Sentry/backend:/app
```

After (your local machine, example):

```yaml
volumes:
  - /home/their-username/wherever-they-cloned-it/Managing-Sentry/backend:/app
```

If your `db` service also mounts the init SQL file, update that path too:

```yaml
volumes:
  - /home/the-grand-capybara/Desktop/Axiom/Projects/Managing-Sentry/db/init.sql:/docker-entrypoint-initdb.d/init.sql
```

to:

```yaml
volumes:
  - /home/their-username/wherever-they-cloned-it/Managing-Sentry/db/init.sql:/docker-entrypoint-initdb.d/init.sql
```

Important:
- Do not leave the owner’s absolute path in your file.
- Do not leave a relative path like `./backend` for Portainer.
- This is a local-only change for your machine.

### 4. Deploy the stack in Portainer

After editing your local copy, deploy it in Portainer:

- paste the edited YAML into the Web Editor, or
- go to `Stacks` > `Add Stack` and paste the edited YAML there

The important part is to deploy your edited local version, not the original shared file from Git.

### 5. Do not push your edited docker-compose.yml back to Git

This file is intentionally local-only.

Do not run:

```bash
git add docker-compose.yml
git commit -m "Update docker compose paths"
git push
```

Do not commit personal bind paths or local environment-specific values back to the shared repo.

If the project owner later updates the official `docker-compose.yml`, re-apply only your own volume path edits on top of the new file before deploying again. Do not keep using an old personal copy.

Recommended options:

- add `docker-compose.yml` to your local Git exclude file, such as `.git/info/exclude`, or
- simply avoid `git add` / `git commit` for this file after editing

Either approach is fine.

### 6. Android-side configuration

The Android app uses a backend URL in `RetrofitClient.java`.

#### Emulator

Use:

```java
private static final String BASE_URL = "http://10.0.2.2:8000/";
```

This works for the Android emulator and does not require any local edits.

#### Real device over Wi‑Fi / wireless debugging

Use your own computer's local network IP instead of `10.0.2.2` or `127.0.0.1`:

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

Look for the local network IPv4 address, such as `192.168.1.25`, not `127.0.0.1`.

Also:
- your PC and Android device must be on the same Wi‑Fi network
- `10.0.2.2` only works on the emulator
- this `BASE_URL` change is also local-only and should not be committed with a personal IP hardcoded in it

### 7. How to verify it's working

Once the stack is running:

```bash
docker ps -a
```

You should see both containers running, and the PHP container should expose the published port such as `0.0.0.0:8000->8000/tcp`.

Then test the backend before testing from Android:

```text
http://localhost:8000/test.php
```

Open that URL in a browser or Postman. If it responds successfully, the PHP + Postgres stack is running and serving files from the mounted `backend/` folder.

### 8. Common mistakes

- forgetting to update the bind mount path and ending up with an empty `/app` folder inside the PHP container
- accidentally committing a personal `docker-compose.yml` path or Android `BASE_URL` IP change
- using `10.0.2.2` on a real device by mistake
- leaving an old personal docker-compose file in place after the official one changes

This repo is shared, but machine-specific values stay local:
- absolute bind mount paths in `docker-compose.yml`
- absolute init SQL mount paths
- Android `BASE_URL` values with your own local IP

Keep those edits local and do not push them to the shared repository.

---