# Architecture

## Responsibility

This plugin supplies the school-specific Arcanum user interface on top of the
Learn-Monitor backend. It renders role-specific pages and consumes backend data
through existing plugin and HTTP contracts.

## Boundaries

- Backend persistence, authentication, task semantics, and calculations remain
  in `student-database`.
- This repository owns school-specific HTML, CSS, JavaScript, route metadata,
  and visual assets.
- The Java classes are the plugin bootstrap and configuration shell. They must
  not become a second implementation of backend authentication, persistence,
  task semantics, or calculations.
- Public and authenticated resource exposure is declared in
  `src/main/resources/meta/paths/get_paths.json`; the corresponding files stay
  in their existing resource namespaces.
- Optional functional modules remain separate plugins.
- Production runtime files are deployment artifacts and are not development
  sources.

## Assets

Dynamic names, classes, scores, buttons, cards, and other user data are rendered
as real interface elements. Backgrounds and decorative artwork remain separate
PNG assets.
