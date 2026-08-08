# Coding Rules

## General

- Use Java 17 and the existing Gradle wrapper.
- Keep changes small, readable, and reversible.
- Follow the existing project style before introducing new patterns.
- Avoid unrelated formatting or mass rewrites.
- Use Conventional Commits only after explicit user approval.
- Never commit generated build output, credentials, private keys, production
  data, or runtime artifacts.

## Web resources

- Keep HTML semantic and accessible.
- Keep CSS responsive for tablet landscape and smaller screens.
- Keep JavaScript defensive when data or DOM elements are missing.
- Public resource routes must be registered through the plugin's existing path
  metadata.
- Use raster assets only where they add value; do not embed dynamic UI text or
  student data into images.

## Verification

- Run `git diff --check`.
- Run `scripts/check`.
- Report failures honestly. Do not bypass or remove a check merely to obtain a
  green result.
