# AGENTS.md

## Scope

This repository contains the school-specific Arcanum frontend plugin for the
Learn-Monitor backend (`student-database`). Arcanum is the complete learning
monitoring concept; this repository is only its school-specific frontend.

## Mandatory boundaries

- Work only inside this repository.
- The only permitted outside-repository read is a configured
  `student-database.jar` used as a compile dependency.
- Never read, copy, alter, or inspect production databases, keystores, keys,
  credentials, backups, logs containing student data, or other real school
  data.
- Never write into a runtime directory or replace a deployed JAR.
- Never start, stop, or restart the production service.
- Never commit, push, create branches, merge, rebase, tag, or deploy unless the
  user explicitly authorizes that exact action.
- Before editing, run `git status --short --branch`.
- Do not discard or overwrite pre-existing user changes.

## Architecture

- Do not reproduce backend business logic in the frontend.
- Use existing Learn-Monitor routes, plugin handlers, and data contracts.
- Keep dynamic student data in HTML/CSS/JavaScript, not baked into images.
- Preserve the established Arcanum terminology and role model.
- Visual Arcanum and avatar assets are high-quality PNG/raster assets. Do not
  replace them with improvised SVG drawings.
- Keep tablet landscape use and responsive layouts working.

## Quality

- Keep changes focused and auditable.
- Update documentation when behavior or architecture changes.
- Run `scripts/check` before reporting completion.
- Do not weaken checks to make a failing change pass.
- In the final report, list changed files, checks run, results, and remaining
  risks. Do not claim deployment or GitHub publication unless it actually
  happened.

## Automated sprint handoff

- Codex itself must not perform Git write operations.
- Only `scripts/codex-sprint` may create and push branches matching
  `codex/<sprint-id>`.
- These branches are review branches only. The runner must never merge into the
  working branch, deploy artifacts, alter runtime data, or restart services.
- Signed commits and pushes made by the runner are authorized only for those
  isolated sprint branches.
