# Development

## Requirements

- Linux
- Git
- Java 17
- the repository Gradle wrapper
- Codex CLI for the optional local agent workflow

## Start the Codex workflow

From the repository root:

```bash
./dev
```

Use a new session for a new sprint and the resume option only for the same
repository and task. Codex is started with repository-scoped workspace write
access. Project instructions are defined in `AGENTS.md`.

## Build dependency

A local Learn-Monitor backend JAR can be supplied with:

```bash
STUDENT_DATABASE_JAR=/absolute/path/student-database.jar scripts/build-project
```

On the current development server, `scripts/build-project` can detect the established
backend JAR location. It may read that JAR as a compile dependency but must not
write to the runtime directory.

The build script uses the ignored repository-local
`.gradle/codex-user-home` directory by default so that Gradle can write its
cache within the repository-scoped sandbox. An explicitly set
`GRADLE_USER_HOME` takes precedence.

## Routine commands

```bash
scripts/status
scripts/build-project
scripts/check
```

## Automatic sprint handoff

After `SPRINT.md` has been prepared, run:

```bash
scripts/codex-sprint
```

For the first workflow commit in a repository that still contains the
untracked bootstrap files, use:

```bash
scripts/codex-sprint --bootstrap
```

The runner creates an isolated `codex/<sprint-id>` branch, runs Codex
non-interactively, repeats the project checks outside the Codex sandbox,
creates a signed report commit, and pushes only that sprint branch. Merge and
deployment remain separate approval steps.
