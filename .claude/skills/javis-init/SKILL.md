---
name: javis-init
description: Initialize a Javis workflow or project context. Use when the user asks to start Javis, initialize Javis for the current repo, bootstrap Javis state, or prepare the project for later Javis story/review work.
---

# Javis Init

Use this skill when the user wants to initialize Javis for the current project.

## Workflow

1. Inspect the current repository and identify the project name, stack, and any existing Javis-related files or state.
2. Create or update the minimum initialization artifacts required for Javis in this repo.
3. Report what was initialized, what assumptions were made, and any next commands or follow-up steps.

## Notes

- Keep initialization idempotent when possible.
- Prefer reusing existing project metadata over inventing new values.
- If the repo already appears initialized, verify and summarize instead of duplicating setup.
