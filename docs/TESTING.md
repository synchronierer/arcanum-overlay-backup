# Testing

The binding local verification command is:

```bash
scripts/check
```

It checks whitespace errors, runs the complete Gradle build and tests, and
prints the final Git status.

## Dashboard tests

Use Node.js 22+, run `npm ci`, then `scripts/check`. The check now runs the
synthetic jsdom tests in `tests/curriculum-dashboard.test.cjs` after the Gradle
build. See [curriculum dashboard](CURRICULUM_DASHBOARD.md) for coverage.

Plugin startup and live integration still require a separate acceptance test.
No production data is used. Build success does not authorize deployment.
