# Testing

The binding local verification command is:

```bash
scripts/check
```

It checks whitespace errors, runs the complete Gradle build and tests, and
prints the final Git status.

## Current gaps

The repository currently contains no automated test sources. Gradle's `test`
task therefore validates test discovery and execution infrastructure but does
not exercise plugin startup, route metadata, HTML, CSS, or JavaScript behavior.
Future test work should add repository-local tests with synthetic data for the
Java plugin shell and static resource contracts. Browser-level dashboard tests
require a separately agreed test setup and must never use production data.

A successful build does not authorize a commit, push, or deployment. Visual
changes must additionally be checked in the intended tablet and desktop
layouts with test data only.
