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
