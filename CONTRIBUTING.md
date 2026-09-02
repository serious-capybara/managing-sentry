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
