# CI Secrets

All secrets live in: **GitHub → Settings → Secrets and variables → Actions → New repository secret**

---

## pr-check.yml

This workflow has no secrets. It runs on public GitHub Actions runners with no external service credentials.

---

## sentry-release.yml

| Secret name | Required | Where to find the value |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | Yes | Sentry → Settings → Auth Tokens → **Create Internal Integration** token. Scope: `project:releases`, `org:read`. |
| `SENTRY_ORG` | Yes | Your Sentry organization slug. Visible in the URL: `sentry.io/organizations/<slug>/`. |
| `SENTRY_PROJECT` | Yes | Your Sentry project slug for the web app. Visible in Sentry → Projects → Settings → `project slug`. |

> If web and mobile are separate Sentry projects, add `SENTRY_PROJECT_MOBILE` and update the workflow's mobile step accordingly.

---

## mobile-build.yml

| Secret name | Required | Where to find the value |
|---|---|---|
| `EXPO_TOKEN` | Yes | expo.dev → Account Settings → **Access Tokens** → Create a token. The token authenticates `eas build` without interactive login. |

> **Prerequisite:** Before `EXPO_TOKEN` is useful, the EAS project must be initialized with `eas init` from `apps/mobile/` (deferred to ~Block 8, requires Expo account which is deferred to ~Week 22).

---

## Setup checklist (do after this PR merges)

- [ ] Add `SENTRY_AUTH_TOKEN` to GitHub Secrets
- [ ] Add `SENTRY_ORG` to GitHub Secrets
- [ ] Add `SENTRY_PROJECT` to GitHub Secrets
- [ ] Add `EXPO_TOKEN` to GitHub Secrets (after Expo account is created)
- [ ] Enable branch protection: GitHub → Settings → Branches → Add rule
  - Branch name pattern: `main`
  - ✓ Require a pull request before merging
  - ✓ Require status checks to pass — add: `check` (from pr-check.yml)
  - ✓ Require branches to be up to date before merging
