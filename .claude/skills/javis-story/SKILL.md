---
name: javis-story
description: Define, refine, or implement a Javis story workflow for the current repository. Use when the user asks to create a story, break down a requirement into a story, prepare acceptance criteria, or execute work for a named Javis story.
---

# Javis Story

Use this skill when the user is working on a Javis story.

## Workflow

1. Identify the story goal, scope, constraints, and acceptance criteria.
2. Inspect the codebase paths relevant to the story before proposing or changing code.
3. If implementation is requested, make the code changes, verify them, and summarize outcomes against the story requirements.
4. If the story is still vague, refine it into concrete, testable deliverables first.

## Notes

- Keep the story outcome tied to observable behavior, not just code edits.
- Surface missing requirements or ambiguous acceptance criteria early.
- Prefer small, verifiable increments when the story is broad.
