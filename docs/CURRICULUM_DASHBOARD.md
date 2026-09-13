# Curriculum dashboard

The student dashboard uses `/mysubjects` (the existing `fetchMySubjects` helper)
and POST `/my-curriculum-catalog` with only a numeric subjectId. Session identity,
assignment and current semester are resolved by the backend. Requires the new
catalog backend and PM grant under `curriculum_student_progress`.

The contract is supplied by the separate backend dashboard-catalog work:
semesterId; centralTopics/centralTasks; flexibleTopics/flexibleTasks; planned
central/flexible/totalTokens with regularLimit 100 and hardLimit 105; progress
with the existing assigned totals/details and same semesterId. Tasks include
completed booleans and current token values. Central tasks have niveau/topicId/
topicName; flexible tasks have optional topicId/topicName. Central and flexible
IDs are separate namespaces. This consumer does not assign contexts, award
completions, calculate budgets or implement transfers.

Scores and grades use `progress.totalTokens`, not legacy completedTasks. Plans
are shown by kind, topic and task with open/earned status. Creating a task does
not award coins. Zero-token tasks and topics without tasks remain visible.
Flexible tasks without a topic remain in a clearly labelled group. Definitions
are read again on page load with no progress cache. Existing central selected/
locked actions are retained, filtered against the catalog's current central IDs
and displayed with the current definitions. Flexible plan rows are informational;
no flexible IDs are submitted to legacy central-task mutation routes.

Missing assignment, unavailable current semester, access failure and network/
invalid-response errors do not produce a zero score or grade. Partial totals are
labelled incomplete. Semester mismatches and missing current semester suppress
all scores until reload. The regular goal stays 100 and 101–105 are shown as extra
coins. Header profile/avatar and request controls remain in the existing layout.

## Validation

Install Node 22+ and run `npm ci`, then `scripts/check` with the configured
STUDENT_DATABASE_JAR compile dependency. Tests use jsdom and synthetic responses;
no school data or runtime files. The permanent tests cover the request contract,
separate identities, DOM status/grouping, safe text, 100/105, current values,
invalid/error responses, semester consistency, partial totals and zero tokens.
The build alone does not constitute a live integration or deployment test.


Browser verification also passed in Chromium at 1440×1000 and 1024×768 with
all requests intercepted locally: expected 10 earned / 15 planned coins, open
5-coin flexible task, no page errors and no horizontal document overflow.
The tablet plan screenshot was visually inspected. This uses synthetic API
responses and does not replace integrated backend/PM runtime acceptance.

The reproducible optional harness is `tests/browser/curriculum-dashboard.cjs`.
Install Playwright and Chromium in a local development cache, set
`PLAYWRIGHT_MODULE` to its package and `PLAYWRIGHT_BROWSERS_PATH` to its browser
cache, and run the harness from the repository root with Node 22+. Screenshots
and the JSON result are written to `.gradle/browser-tools/`.
