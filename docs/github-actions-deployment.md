# GitHub Actions deployment

This repository now has:

- `.github/workflows/ci.yml` for client, admin, and server checks.
- `.github/workflows/deploy.yml` for production deployment after `main` passes CI.

## Branch flow

```text
Pull request -> CI checks
develop      -> CI checks
main         -> CI checks -> production deployment
```

## Required GitHub configuration

Create a GitHub Environment named `production`. Add these environment secrets:

- `DEPLOY_WEBHOOK_URL`: deployment webhook from the hosting provider or deployment server.
- `PRODUCTION_HEALTHCHECK_URL`: public API health endpoint, for example `https://api.example.com/health`.

`DEPLOY_WEBHOOK_URL` is intentionally provider-neutral. It prevents deployment credentials from being committed and lets us connect Render, Railway, Fly.io, a VPS, or a custom deployment service later without changing the CI workflow.

## What the workflow does

1. Installs locked dependencies with `npm ci`.
2. Lints and builds `client` and `admin`.
3. Runs server tests when a test script exists.
4. Validates the Node server entrypoint.
5. Packages the tested client, admin, and server artifacts.
6. Uploads a 14-day GitHub release artifact.
7. Triggers the configured hosting deployment.
8. Polls the configured health endpoint and fails if the deployment is unhealthy.

If the deployment secret is not configured yet, CI remains usable and the deploy workflow records that it created an artifact without triggering hosting.
