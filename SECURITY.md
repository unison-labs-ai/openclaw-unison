# Security Policy

## Reporting a vulnerability

Please report security issues privately — **do not open a public GitHub issue.**

Email **security@unisonlabs.ai** with:

- a description of the issue and its impact,
- steps to reproduce (a proof-of-concept if you have one),
- any suggested remediation.

We aim to acknowledge within 3 business days and to keep you updated as we
investigate. We'll credit reporters who want it once a fix ships.

## Scope

This repository is an **OpenClaw plugin** — open-source client code that calls
the Unison brain API. It holds no secrets and is not a security boundary.
Authentication, authorization, tenant isolation, and rate limiting are enforced
**server-side** by the Unison brain API. Reports about this plugin are most useful
when they concern:

- handling of `usk_` API keys on disk or in config files,
- credential exposure through logging or error messages,
- dependency or supply-chain risks.

Server-side or account issues should also go to the same address.

## Credential handling

The plugin reads the `usk_` bearer token from:
1. The `UNISON_TOKEN` environment variable (takes precedence), or
2. The `apiKey` field in `~/.openclaw/openclaw.json` (via `${UNISON_TOKEN}` env-ref).

The token is never logged (the logger redacts values containing `usk_`) and is
transmitted only to the configured `UNISON_API_URL` host via HTTPS. It is never
written to `dist/`, committed to git, or forwarded elsewhere.
