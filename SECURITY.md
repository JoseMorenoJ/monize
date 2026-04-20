# Security Policy

Monize handles sensitive personal financial data, so security is taken seriously. This document describes which versions receive security updates and how to responsibly report a vulnerability.

## Supported Versions

Monize follows a rolling-release model. Only the latest minor release line receives security updates. Older versions are not patched -- please keep your deployment up to date.

| Version  | Supported          |
| -------- | ------------------ |
| 1.8.x    | :white_check_mark: |
| < 1.8    | :x:                |

If you are self-hosting, pull the latest image tag (or `latest`) and re-deploy to receive security fixes.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, report them privately using one of the following channels:

1. **Preferred:** Use GitHub's [private vulnerability reporting](https://github.com/kenlasko/monize/security/advisories/new) feature to open a draft security advisory.
2. Alternatively, open a minimal public issue asking for a private contact method (do **not** include any vulnerability details).

### What to Include

To help triage quickly, please include as much of the following as possible:

- A clear description of the vulnerability and its potential impact
- Affected component(s) (backend, frontend, database, auth, AI, MCP, etc.) and version
- Steps to reproduce, including any required configuration, requests, or payloads
- Proof-of-concept code, screenshots, or logs where relevant
- Your assessment of severity (e.g. CVSS vector) if you have one
- Whether the issue has been disclosed anywhere else

### What to Expect

- **Acknowledgement:** within 2 days of your report
- **Initial assessment:** within 7 days, including whether the report is accepted, needs more information, or is declined (with reasoning)
- **Progress updates:** at least every 7 days while the issue is open
- **Fix timeline:** critical issues are targeted for a patch release as soon as a fix is validated; lower-severity issues are rolled into the next scheduled release
- **Disclosure:** once a fix is released, the advisory will be published and (with your permission) credit you as the reporter

### Scope

In scope:

- The Monize backend (`backend/`), frontend (`frontend/`), database schema/migrations (`database/`), Helm chart (`helm/`), and Docker Compose deployment files in this repository
- Authentication and authorization flows (JWT, OIDC, TOTP 2FA, PATs, refresh tokens, CSRF)
- Multi-tenancy / data-isolation issues between users
- Handling of financial data, secrets, and encrypted API keys
- AI Assistant and MCP server tool surfaces

Out of scope:

- Vulnerabilities in third-party dependencies that are already tracked by upstream (please report upstream and, if you like, link the advisory here)
- Issues that require a pre-compromised host, browser, or already-authenticated malicious administrator
- Attacks that rely on the user deploying with insecure configuration explicitly warned against in the documentation (e.g. weak `JWT_SECRET`, exposing the database port to the internet)
- Denial-of-service via unrealistic traffic volumes against a self-hosted instance
- Reports generated purely by automated scanners without a demonstrated impact

## Safe Harbor

Good-faith security research conducted in accordance with this policy is welcomed. Please:

- Only test against instances you own or have explicit permission to test
- Avoid privacy violations, data destruction, and service disruption
- Give a reasonable window for a fix before any public disclosure

Thank you for helping keep Monize and its users safe.
