# Security Policy

## Supported versions

Security fixes are provided for the latest released version of ResumePilot.

## Reporting a vulnerability

Do not open a public issue containing a working exploit, real resume, API key, identity number, cookies, tokens, or unredacted recruiting-page data. Contact the repository owner through a private GitHub security advisory.

Include the affected version, browser version, reproduction steps using synthetic data, impact, and any suggested mitigation.

## Security invariants

- ResumePilot must never trigger a final job-application submission.
- High-sensitivity fields must never be sent to an AI endpoint.
- Secrets and profile values must never be written to logs or diagnostics.
- Remote executable code is not allowed.
- New permissions require documentation and review.
