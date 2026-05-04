# PCAS Software Standard — Documentation Hub

This directory contains the working drafts of the PCAS (Pump Controller / Atlas
Copco Standard) software standard. The two principal documents — the Software
Development Procedure (SDP) and the Software Configuration Management Working
Practice (SCM) — are derived from the Eastbourne site originals (DOCX) plus the
NSST and ISP Confluence references.

## Purpose

- Maintain a single source-controlled, reviewable Markdown copy of the PCAS SDP
  and SCM.
- Preserve a section-by-section traceability link back to the Eastbourne sources
  so reviewers can audit every divergence.
- Enable the SDP and SCM to evolve together with the rest of the `sw-portal`
  repository (PRs, code reviews, CI lint) instead of living only as DOCX.

## Audience

| Reader                          | What they get from this directory                                          |
| ------------------------------- | -------------------------------------------------------------------------- |
| PCAS engineers                  | The authoritative SDP/SCM they must follow.                                |
| Software Manager / Project Lead | Mapping table to verify nothing was lost during the Eastbourne → PCAS port. |
| Quality / Audit                 | Change log + retention policy (in `pcas-sdp.md` §6 / §7) for compliance.    |
| New joiners                     | A single entry point (this README) explaining the doc set.                 |

## Mapping Strategy

1. **Heading parity first.** Every section in the Eastbourne sources is reflected
   by exactly one heading in `pcas-sdp.md` or `pcas-scm.md`. Headings carry an
   HTML comment of the form `<!-- Maps to Eastbourne SDP §X.Y -->` (or `SCM`).
2. **Renumber only on conflict.** Numbering is preserved verbatim except where
   the Eastbourne source produces a clash — for example two sibling `1.1` or two
   sibling `8.1` headings — in which case PCAS introduces a unique number and
   records the rename in `section-mapping.md` and in the heading comment itself.
3. **Status by enumeration.** `section-mapping.md` is the single place that lists
   every Eastbourne section and tags it with `planned`, `written`,
   `intentionally omitted`, or `replaced`. Any divergence must be visible there.
4. **No DOCX edits.** The original Eastbourne DOCX files in `eastbourne.refer/`
   are read-only. They are never modified — they are only re-extracted if the
   originals are revised.

## Source Citations

The following Confluence pages are the official PCAS-side references that bind
the Eastbourne content to the wider Atlas Copco software ecosystem:

- **NSST 895680517** — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517
- **NSST 603062275** — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban
- **ISP 1039237122** — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122

Inside `pcas-sdp.md` and `pcas-scm.md`, individual paragraphs cite the relevant
NSST/ISP page where the PCAS interpretation diverges from or extends the
Eastbourne text.

## File Layout

```
docs/standard/
├── README.md                ← this file
├── pcas-sdp.md              ← PCAS Software Development Procedure
├── pcas-scm.md              ← PCAS Software Configuration Management WP
├── section-mapping.md       ← Eastbourne ↔ PCAS section enumeration
└── eastbourne.refer/        ← read-only DOCX sources (do NOT edit)
    ├── Eastbourne Site Software Development Procedure (3).docx
    └── Software Configuration Management Working Practice (2).docx
```

## Change Log

All material edits to `pcas-sdp.md`, `pcas-scm.md`, or `section-mapping.md` must
be recorded here. Per-section change history is additionally tracked inside
each document (`pcas-sdp.md` §6).

| Date       | Author          | Files Touched                                       | Summary                                      |
| ---------- | --------------- | --------------------------------------------------- | -------------------------------------------- |
| 2026-05-04 | Builder (Phase 1) | README.md, pcas-sdp.md, pcas-scm.md, section-mapping.md | Initial scaffolding — headings + TBD stubs only. |

## How to Regenerate from DOCX

The DOCX originals are the legal sources of truth. If they are revised, regenerate
the Markdown skeletons as follows:

1. **Drop the new DOCX into `eastbourne.refer/`** with the original filename
   (do not delete the previous version until the diff has been reviewed).
2. **Convert to Markdown.** From the repo root:
   ```bash
   pandoc \
     "docs/standard/eastbourne.refer/Eastbourne Site Software Development Procedure (3).docx" \
     -o /tmp/eastbourne-sdp.md
   pandoc \
     "docs/standard/eastbourne.refer/Software Configuration Management Working Practice (2).docx" \
     -o /tmp/eastbourne-scm.md
   ```
   Alternatively, use the `markitdown` skill (`markitdown` MCP) for a richer
   structured conversion.
3. **Diff against the existing skeleton.** Compare `/tmp/eastbourne-sdp.md`
   against `pcas-sdp.md` heading-by-heading. New or removed Eastbourne sections
   must be reflected in `section-mapping.md` first.
4. **Update `section-mapping.md`** with one row per added / removed / renumbered
   section.
5. **Patch `pcas-sdp.md` / `pcas-scm.md`** so that every Eastbourne § still has
   a matching `<!-- Maps to Eastbourne ... §X.Y -->` heading. Append a row to the
   change log above.
6. **Open a PR** with the DOCX, the regenerated Markdown intermediates (kept out
   of git via `.gitignore`), and the resulting skeleton edits. Reviewers verify
   the mapping table is complete before merging.

## Phase Plan (informational)

| Phase | Output                                                              |
| ----- | ------------------------------------------------------------------- |
| 1     | This scaffolding (headings + mapping table + TBD stubs).            |
| 2     | Section bodies authored from Eastbourne + NSST/ISP references.       |
| 3+    | Review cycles, PCAS-specific divergences, formal sign-off.          |

Phase 1 is intentionally body-free: every section heading is followed by a
`> TBD in Phase 2` block so reviewers can confirm structural completeness before
content is written.
