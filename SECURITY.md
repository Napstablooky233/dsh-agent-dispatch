# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a vulnerability

Prefer the repository's private **Report a vulnerability** advisory on GitHub. If that is not available, email **qq1679081267@gmail.com**.

Include:
- Plugin version (`dsh-agent-dispatch`)
- DSH version
- Operating system
- Steps to reproduce

A reply is normally expected within 7 days.

## Scope

The following surfaces are in scope for this plugin:

- The `/api/agent-dispatch/*` HTTP API (same-origin, loopback only)
- Configuration writes to `$DSH_HOME/agent-dispatch/config.json`
- Text injected into the `systemPrompt` section on every step
- Browser-half stylesheet injection

Two verifiable facts:
1. The API returns **403** for any non-loopback request (covered by `scripts/smoke-host.mjs`).
2. The plugin makes **no outbound network requests** of its own.

## Out of scope

- DSH core and its other plugins
- The third-party free-model gateway that helper agents run on
- Anything that already requires a compromised local machine