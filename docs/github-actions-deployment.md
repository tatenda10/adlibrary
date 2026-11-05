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

- `VPS_HOST`: VPS IP address or hostname.
- `VPS_PORT`: SSH port, normally `22`.
- `VPS_USER`: dedicated deployment user, such as `deploy`.
- `VPS_SSH_KEY`: private SSH key whose public key is authorized on the VPS.
- `VPS_APP_PATH`: absolute repository path on the VPS, such as `/var/www/viraladlibrary`.
- `PRODUCTION_HEALTHCHECK_URL`: public API health endpoint, for example `https://api.example.com/health`.

The deployment uses SSH directly. GitHub connects to the VPS, pulls the tested `main` commit, installs dependencies, builds the client and admin applications, and restarts the Node server through PM2.

## What the workflow does

1. Installs locked dependencies with `npm ci`.
2. Lints and builds `client` and `admin`.
3. Runs server tests when a test script exists.
4. Validates the Node server entrypoint.
5. Packages the tested client, admin, and server artifacts.
6. Uploads a 14-day GitHub release artifact.
7. Connects to the VPS over SSH and deploys the tested commit.
8. Polls the configured health endpoint and fails if the deployment is unhealthy.

If the deployment secret is not configured yet, CI remains usable and the deploy workflow records that it created an artifact without triggering hosting.
