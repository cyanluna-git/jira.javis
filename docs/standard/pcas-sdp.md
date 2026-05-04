# PCAS Software Development Procedure (SDP)

> **Status:** Phase 2 body — Mirror-and-Modernize from Eastbourne SDP. Section
> numbering, anchors, and the inline `<!-- Maps to Eastbourne SDP §X.Y -->`
> annotations are inherited from the Phase 1 skeleton and must not change. The
> mapping of every section to its Eastbourne source-of-record lives in
> [`section-mapping.md`](./section-mapping.md).

This document is the PCAS-equivalent of the *Eastbourne Site Software Development
Procedure*. Each heading below is paired with a `<!-- Maps to Eastbourne SDP §X.Y -->`
comment that records the source-of-record.

**Source documents**
- `eastbourne.refer/Eastbourne Site Software Development Procedure (3).docx`
- NSST 895680517 — One SW Software Development Process — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517
- NSST 895746050 — SW 개발 프로세스 및 산출물 — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895746050
- NSST 603062275 — IS Legacy Product Lean Kanban — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban
- ISP 1039237122 — Bitbucket CI/CD — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122
- ISP 985563137 — North Star Agile Roadmap — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/985563137
- ISP 1085636609 — EOB Team Guidance — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609

## Table of Contents

- [1. Objectives & Scope](#1-objectives--scope)
  - [1.1 Overview](#11-overview)
  - [1.2 Scope](#12-scope)
- [2. Definitions](#2-definitions)
- [3. Responsibilities](#3-responsibilities)
- [4. Process](#4-process)
  - [4.1 Process Description](#41-process-description)
    - [4.1.1 Software Definition](#411-software-definition)
    - [4.1.2 Software Requirements Capture and Analysis](#412-software-requirements-capture-and-analysis)
    - [4.1.3 Software Design](#413-software-design)
    - [4.1.4 Software Implementation](#414-software-implementation)
      - [4.1.4.A Scrum Track](#414a-scrum-track)
      - [4.1.4.B Lean Kanban Track](#414b-lean-kanban-track)
    - [4.1.5 Software Verification & Testing](#415-software-verification--testing)
    - [4.1.6 Software Deployment](#416-software-deployment)
    - [4.1.7 Software Evaluation](#417-software-evaluation)
    - [4.1.8 Supporting and Related Processes](#418-supporting-and-related-processes)
    - [4.1.9 Mapping to Edwards Product Commercialisation Process](#419-mapping-to-edwards-product-commercialisation-process)
    - [4.1.10 Project and Design Reviews](#4110-project-and-design-reviews)
      - [4.1.10.A Scrum Track Reviews](#4110a-scrum-track-reviews)
      - [4.1.10.B Lean Kanban Track Reviews](#4110b-lean-kanban-track-reviews)
    - [4.1.11 Measurement](#4111-measurement)
    - [4.1.12 Review](#4112-review)
- [5. Support Documentation](#5-support-documentation)
  - [5.1 Global Procedures](#51-global-procedures)
  - [5.2 Local PCAS Procedures](#52-local-pcas-procedures)
  - [5.3 Non-Edwards Documents](#53-non-edwards-documents)
  - [5.4 Document Templates](#54-document-templates)
  - [5.5 Form Templates](#55-form-templates)
- [6. Change \\ Review History](#6-change--review-history)
- [7. Record Retention](#7-record-retention)

---

## 1. Objectives & Scope
<!-- Maps to Eastbourne SDP §1 -->

This procedure defines the software development process applied at the **Edwards
PCAS (Korea) site**. It is the local instance of the global Edwards Software
Development Procedure and inherits authority from EQE024 (Quality Engineering).
Where the global procedure prescribes intent, this document records *how* the
intent is realised inside the PCAS engineering organisation, including the dual
agile tracks introduced by the One SW initiative
([NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517)).

### 1.1 Overview
<!-- Maps to Eastbourne SDP §1.1 -->

PCAS develops and maintains software that is shipped to External Customers
either embedded in Edwards products or delivered as standalone tools and
services. This procedure governs that work end-to-end: definition, requirements,
design, implementation, verification, deployment, and post-launch evaluation.

The procedure is parented by:

- **EQE024** — Edwards Software Quality Engineering reference (global, unchanged).
- **Edwards Software Development Procedure** — global SDP (global, unchanged).
- **NSST 895680517** — One SW Software Development Process — the PCAS
  interpretation of the global SDP, which establishes the Scrum/Lean-Kanban dual
  track described throughout §4.

Together these three documents form the authoritative chain: global EQE024 →
global SDP → PCAS SDP (this document) →
[`pcas-scm.md`](./pcas-scm.md) for configuration management mechanics.

### 1.2 Scope
<!-- Maps to Eastbourne SDP §1.2 (originally numbered §1.1 in Eastbourne — see section-mapping.md) -->

This procedure applies to all software developed at PCAS that is delivered to an
External Customer, including:

- Embedded firmware shipped on Edwards products (EUV, ASP, OQC product lines).
- Service-Portal hosted applications and web tools.
- IS-Legacy maintenance releases ([NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban)).
- Bundle releases coordinated across product lines (see §4.1.6).

Internal-only experiments, throwaway scripts, and personal tooling are out of
scope unless promoted to a customer-facing deliverable, at which point this
procedure applies retroactively from the next Bundle.

## 2. Definitions
<!-- Maps to Eastbourne SDP §2 -->

The following terms are used throughout this document. Terms inherited verbatim
from the Eastbourne SDP are marked *(global)*; terms introduced by PCAS practice
are marked *(PCAS)*.

| Term | Definition |
|------|------------|
| **NPI** *(global)* | New Product Introduction — Edwards process for a new product entering the market. *Retained from global Eastbourne SDP for compliance reference; PCAS development primarily uses PCP gates mapped to Walking Skeleton milestones (§4.1.9).* |
| **PCP** *(global)* | Product Commercialisation Process — Edwards stage-gate governance (Q71-101). *Authoritative gating model for PCAS; mapped to Walking Skeleton M1–M4 in §4.1.9.* |
| **PRR** *(global)* | Production Readiness Review — gate confirming a product is ready for serial production. *Retained from global Eastbourne SDP for compliance reference; not invoked locally in this document.* |
| **Software** *(global)* | Any executable artifact (firmware, application, script) delivered to an External Customer. |
| **External Customer** *(global)* | An end-user of an Edwards product, distinct from internal Edwards users. |
| **External Agents** *(global)* | Third-party organisations contributing software under a contractual agreement. |
| **One SW** *(PCAS)* | The PCAS principle, defined in NSST 895680517, that the entire site shares one development process with two execution tracks (Scrum and Lean Kanban) selected per work-item. |
| **Bundle** *(PCAS)* | A coordinated multi-component release covering EUV / ASP / OQC under a single version banner. See §4.1.6. |
| **Bundle Generation** *(PCAS)* | The hardware-platform generation a Bundle targets. **Gen2** corresponds to the legacy IS-Legacy stack (active range `Gen2-3.x.y`); **Gen3** corresponds to the current platform (active range `Gen3-4.x.y`). |
| **Sprint** *(PCAS)* | A 2-week time-boxed iteration in the Scrum track (§4.1.4.A). |
| **InStaging** *(PCAS)* | The fourth column of the Lean Kanban board (NSST 603062275); items idle here >5 working days trigger Lead Engineer review. |
| **Service Portal** *(PCAS)* | The Jira Service-Portal intake channel for Lean Kanban work (maintenance, IS-Legacy, customer escalations). |
| **Walking Skeleton** *(PCAS)* | The PCAS implementation pattern of the North Star Agile Roadmap (ISP 985563137); see milestones M1–M4 in §4.1.9. |
| **Scrum** *(PCAS)* | The Scrum-track execution mode (§4.1.4.A) — 2-week sprints, EUV/ASP/OQC roadmap items. |
| **Lean Kanban** *(PCAS)* | The Lean-Kanban-track execution mode (§4.1.4.B) — pull-based, WIP-limited, NSST 603062275. |
| **Lead Engineer** *(PCAS)* | The senior engineer who partners with the Product Owner during weekly Grooming on the Lean Kanban track (NSST 603062275). |

## 3. Responsibilities
<!-- Maps to Eastbourne SDP §3 -->

Roles inherited from the global Eastbourne SDP are retained and supplemented
with two PCAS-specific roles introduced by the dual-track agile model.

| Role | Responsibility | Source |
|------|----------------|--------|
| **Software Project Leader** | End-to-end accountability for delivery of the project's software scope: planning, risk, resourcing, gate sign-off. Owns the relationship with PCP. | global |
| **Software Engineer** | Designs, implements, tests, and documents software. Performs peer review on Bitbucket Pull Requests. Logs work in Jira. | global |
| **Software Manager** | Owns line management of the engineering team, training, and InStaging escalation triage on the Lean Kanban board. | global |
| **Scrum Master** | Facilitates Scrum-track ceremonies (Planning, Daily, Review, Retrospective, Refinement). Removes blockers; protects the Sprint Goal. Does not own delivery accountability — that remains with the Software Project Leader. | PCAS |
| **Product Owner** | Owns and orders the backlog (Scrum) and the Lean Kanban `Backlog (Hide)` column. Approves Bundle scope and Confluence Release Notes. | PCAS |
| **Lead Engineer** | Senior engineer paired with the Product Owner for weekly Grooming on the Lean Kanban track ([NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban)). Mentors the engineering team, reviews InStaging escalations, signs off on technical refinement. | PCAS |

EOB Team setup, on-boarding, and toolchain provisioning are documented in
[ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609).

## 4. Process
<!-- Maps to Eastbourne SDP §4 -->

PCAS executes one software development process under the **One SW** principle
([NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517)),
realised in two parallel execution tracks: a **Scrum track** (sprint-based,
roadmap-driven) and a **Lean Kanban track** (pull-based, demand-driven). The
two tracks share the lifecycle stages defined in §4.1 — only the implementation
cadence diverges (§4.1.4).

### 4.1 Process Description
<!-- Maps to Eastbourne SDP §4.1 -->

The lifecycle stages below apply to both tracks. The shape of the lifecycle
mirrors the Eastbourne SDP, but the execution mechanics are PCAS-local:

1. **Software Definition** (§4.1.1) — scope and feasibility, parented by PCP.
2. **Software Requirements Capture and Analysis** (§4.1.2) — track-dependent intake.
3. **Software Design** (§4.1.3) — Confluence design pages, Bitbucket PR peer review.
4. **Software Implementation** (§4.1.4) — **diverges by track**: §4.1.4.A Scrum, §4.1.4.B Lean Kanban.
5. **Software Verification & Testing** (§4.1.5) — independent V&T plus CI/CD lint gates.
6. **Software Deployment** (§4.1.6) — PCAS Bundle release model.
7. **Software Evaluation** (§4.1.7) — FRACAS plus Service Portal feedback loop.
8. **Supporting and Related Processes** (§4.1.8) — CM, knowledge, code, team setup.
9. **Mapping to PCP** (§4.1.9) — Walking Skeleton M1–M4 mapped to PCP gates.
10. **Reviews** (§4.1.10) — Scrum reviews and Kanban ceremonies.
11. **Measurement** (§4.1.11) — delegates to `pcas-scm.md` §7.
12. **Review** (§4.1.12) — periodic procedure review.

Per One SW, the process is not "Scrum or Kanban for the site"; it is "one
process, two tracks, chosen per work-item". The decision rule is documented
in §4.1.4.

#### 4.1.1 Software Definition
<!-- Maps to Eastbourne SDP §4.1.1 -->

Software Definition is the upstream activity that produces a Software Project
Charter or equivalent: the high-level scope, the customer/stakeholder list, the
expected delivery generation (Gen2 / Gen3), and the parent PCP project. This
stage is **largely unchanged from Eastbourne**: the Software Project Leader
prepares the definition document and submits it through PCP.

PCAS records the definition as a Confluence page parented under the relevant
project space (EUV, ASP, OQC, or IS-Legacy) and links it to the parent PCP
project file. For Lean-Kanban work the "definition" is implicit in the Service
Portal ticket plus its grooming notes; a separate definition page is required
only when the work is escalated to a Bundle scope item.

#### 4.1.2 Software Requirements Capture and Analysis
<!-- Maps to Eastbourne SDP §4.1.2 -->

Requirements capture is **track-dependent**:

- **Scrum track** — requirements flow down the roadmap hierarchy
  **Vision → Milestone → Stream → Epic → Story → Sub-task**, defined in
  [NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517)
  and visualised in
  [NSST 895746050](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895746050).
  Each Stream is owned by a Product Owner; each Epic produces a Software
  Requirements Specification (SRS) page in Confluence and a Jira Epic with
  child Stories. The Eastbourne deliverables — SRS, Software Project Plan, and
  Interface Specification (IFS) — remain valid for the Scrum track and continue
  to be authored as Confluence pages.

- **Lean Kanban track** — requirements arrive as **Jira Service Portal**
  tickets ([NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban)).
  Each ticket carries the customer description, severity, and target Bundle.
  Weekly Grooming (Lead Engineer + Product Owner) refines tickets at the top of
  `Backlog` into ready-to-pull cards; the SRS-equivalent content lives inline
  on the ticket plus any linked Confluence pages.

Cross-track linkage uses Jira `is part of` and `relates to` links so that a
roadmap Epic can spawn Service Portal maintenance items without losing
traceability.

#### 4.1.3 Software Design
<!-- Maps to Eastbourne SDP §4.1.3 -->

The PCAS design repository is **Confluence**. Each Stream/Epic (Scrum) or
significant Service Portal feature (Kanban) has a design page that captures
architecture, interfaces, data models, and decision rationale. Design pages are
linked from the parent SRS and from the related Jira issues.

Peer review is performed via **Bitbucket Pull Requests** for design that lives
in code (READMEs, ADRs, schemas) and via Confluence inline comments for design
documents. The traceability chain — Vision → Milestone → Stream → Epic → Story
→ Commit/PR → Bundle — is mandatory and is documented in
[NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517);
the chain is what enables a deployed Bundle to be traced back to its parent
Vision and forward to its Confluence Release Note.

The Eastbourne Software Design Specification (SDS) and Software Architecture
Specification (SAS) document templates remain available in §5.4 and continue
to apply where a regulated context (e.g. customer audit) requires a formal
deliverable.

#### 4.1.4 Software Implementation
<!-- Maps to Eastbourne SDP §4.1.4 -->

Software Implementation is the only stage where the two tracks diverge in
cadence. The track for a given work-item is selected at intake using the
decision rule below; the rest of this section is split into §4.1.4.A (Scrum)
and §4.1.4.B (Lean Kanban) so the two governance regimes stay visually
separate.

> **Decision rule (issue → track):**
> - If the work originates from a strategic Vision/Milestone roadmap item or
>   an Epic on EUV / ASP / OQC → **Scrum track** (§4.1.4.A).
> - If the work originates from a Service Portal ticket, an InStaging
>   escalation, or an IS-Legacy maintenance request → **Lean Kanban track**
>   (§4.1.4.B).
> - A single feature may produce issues on both tracks (e.g. a roadmap Epic
>   may spawn maintenance Service Portal items). Cross-track linkage is via
>   the Jira `is part of` link.

**Commit conventions (both tracks).** Implementation commits in either track
follow the Conventional Commits format per
[ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609);
the enumerated `type(scope)` values and the PR review policy are owned by
[`pcas-scm.md`](./pcas-scm.md) §6.1 (BitBucket).

##### 4.1.4.A Scrum Track

Source-of-record:
[NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517)
plus
[ISP 985563137](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/985563137).

- **Cadence.** 2-week sprints. Sprint Planning on Monday morning of week 1;
  Sprint Review and Retrospective on Friday afternoon of week 2.
- **Projects.** EUV, ASP, OQC.
- **Roadmap hierarchy.** Vision → Milestone → Stream → Epic → Story → Sub-task,
  per the North Star Agile Roadmap.
- **Ceremonies.**
  - Daily Standup — 15 min, every working day, the team plus Scrum Master.
  - Sprint Planning — 2 h, week 1 Monday, the team plus Product Owner.
  - Backlog Refinement — 1 h, mid-sprint (Wednesday week 1), Product Owner +
    senior engineers.
  - Sprint Review — 1 h, week 2 Friday, the team plus stakeholders.
  - Sprint Retrospective — 45 min, immediately after Sprint Review.
- **Artifacts.** Sprint Goal, Sprint Backlog, Definition of Done, Sprint Review
  Record (template in §5.5).
- **Roles.** Product Owner orders the backlog; Scrum Master facilitates
  ceremonies; the Software Project Leader retains overall delivery
  accountability and represents the team at PCP gates.

##### 4.1.4.B Lean Kanban Track

Source-of-record:
[NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban).

- **Board.** Six-column Lean Kanban (per NSST 603062275):
  `Backlog (Hide) → Ready To Dev → In Progress ↔ InStaging → Ready to Signoff
  → Done`. The bidirectional notation (`↔`) between `In Progress` and
  `InStaging` reflects that an item discovered to need code rework during
  staging returns to `In Progress` rather than escalating. Full column
  semantics live in [`pcas-scm.md`](./pcas-scm.md) §5.2.4.
- **WIP limit.** **2 cards per engineer** in `In Progress`. The board is
  **pull-based**: only the engineer who finished a card may pull the next from
  `Ready To Dev`.
- **InStaging.** The escalation column. Items idle in `InStaging` for more
  than **5 working days** trigger a Lead Engineer review and, if unresolved, a
  Software Manager escalation.
- **Ceremonies.**
  - **Sync** — **twice a week, 15 min each** (Monday in Teams; Thursday in
    Team Meeting). Full Lean Kanban team. Alignment on flow / blockers /
    Bundle scope.
  - **Grooming** — **once a week, 30 min** (Tech Lead + Lead Engineer per
    [`pcas-scm.md`](./pcas-scm.md) §3.4). Refines top of `Backlog (Hide)` and
    promotes cards to `Ready To Dev`.
- **Estimation.** None. Throughput is measured in *cards per week*; metrics
  are collected per [`pcas-scm.md`](./pcas-scm.md) §7.
- **Roles.** Tech Lead + Lead Engineer own Grooming refinement of
  `Backlog (Hide)` and promotion to `Ready To Dev` (NSST 603062275 explicit);
  Software Manager owns InStaging escalations; Product Owner authorises
  Bundle scope and approves Release Notes.

#### 4.1.5 Software Verification & Testing
<!-- Maps to Eastbourne SDP §4.1.5 -->

Verification & Testing follows the Eastbourne intent — *independent* test
authorship, separate from implementation — and adds the CI/CD lint gates
introduced under
[ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122).

- **Independent test authorship.** A Software Engineer other than the author of
  the change writes (or reviews) the test plan and test cases. The Software
  Verification Specification (SVS) is mandatory for Scrum-track Stream-level
  features and for any Lean-Kanban card flagged `requires-svs` during Grooming.
- **CI/CD lint gates.** Every Bitbucket Pull Request runs the Bitbucket
  Pipeline configured per ISP 1039237122 with:
  - **Ruff** for Python — must pass `ruff check`.
  - **ESLint** for TypeScript / JavaScript — must pass project-level config.
  - Unit tests — must pass on the project's self-hosted runner.
  Failures block merge regardless of track.
- **Self-hosted runner / pull-based build.** ISP 1039237122 specifies a
  self-hosted runner architecture and a pull-based build trigger. Both apply
  to all PCAS repositories without exception.
- **Bundle-level testing.** Before a Bundle moves from *Active* to *Completed*
  (§4.1.6), an independent V&T pass against the Bundle scope is required and
  recorded in the Confluence Release Note.

Configuration management of test artifacts (test data, golden files, fixtures)
is governed by [`pcas-scm.md`](./pcas-scm.md) §6.1 (BitBucket).

#### 4.1.6 Software Deployment
<!-- Maps to Eastbourne SDP §4.1.6 -->

PCAS deploys software using the **Bundle** model. The Eastbourne three-tier
Alpha/Beta/Production wording is replaced; that wording is preserved here only
for *historical* and *comparative* context to clarify the migration:

> **Historical note.** The legacy Eastbourne SDP described an Alpha → Beta →
> Production three-tier release. PCAS supersedes that model with the Bundle
> lifecycle below.

##### Bundle definition

A **Bundle** is a coordinated multi-component release that may span the
EUV, ASP, and OQC product lines under a single version banner. A Bundle is the
unit of release governance: scope, version, lifecycle state, and Confluence
Release Note are all attributes of the Bundle, not of any one component.

##### Version format

`Gen<N>-<X>.<Y>.<Z>`

- `Gen<N>` — the hardware-platform generation. **Gen2** for the legacy
  IS-Legacy stack; **Gen3** for the current platform.
- `<X>.<Y>.<Z>` — semantic version: `X` major / `Y` minor / `Z` patch.

| Generation | Active range | Example |
|------------|--------------|---------|
| Gen2 | `Gen2-3.0.0` … `Gen2-3.x.y` (legacy maintenance) | `Gen2-3.12.1` |
| Gen3 | `Gen3-4.0.0` … `Gen3-4.x.y` (current development) | `Gen3-4.3.5` |

The leading `Gen<N>` makes the platform constraint visible at a glance; the
SemVer suffix carries the usual breaking/feature/patch semantics.

##### Bundle lifecycle

`Planning → Active → Completed`

| State | Entry criterion | Activity | Exit criterion |
|-------|-----------------|----------|----------------|
| Planning | Bundle scope opened by Product Owner | Confluence Release Note draft created; Jira filter for in-scope issues defined | Scope frozen; CI builds green |
| Active | Scope frozen; CI green | Nightly builds via Bitbucket Pipeline (ISP 1039237122); independent V&T running | All in-scope issues closed; V&T sign-off |
| Completed | V&T sign-off; Release Note finalised | EC raised for production introduction; binary published to Bitbucket release artifact registry | EC approved; production roll-out |

##### Confluence Release Note

Every Bundle is documented by exactly one Confluence Release Note page,
parented under the project's Release Notes index. Required sections:

- **Scope** — what changed at customer-visible level.
- **Issue list** — link to a Jira filter scoped to the Bundle's `fixVersion`.
- **Risk / Known Issues** — open defects accepted into the Bundle, with
  mitigation.
- **Compatibility** — the Gen2 / Gen3 hardware matrix the Bundle supports.
- **Approvers** — Software Project Leader and Software Manager, captured by
  Confluence approval workflow.

Cross-reference: baseline submission and approval mechanics are governed by
[`pcas-scm.md`](./pcas-scm.md) §4.3 Baseline Control Procedure.

##### EC integration (preserved verbatim)

For *production* Bundles (Active → Completed), an Engineering Change is raised
per Edwards reference 5.1.7 (unchanged from Eastbourne global procedure). The
EC implementation table from the Eastbourne §4.1.6 is **preserved verbatim**
because it remains a global Edwards requirement:

| Item | Action |
|------|--------|
| MAPICS | Software part number and revision recorded against the BOM. |
| SIB (Software Item Build) | Build record created and approved. |
| ATE (Automated Test Equipment) | Test programs updated to match the new revision. |
| Production location | Software loaded onto the production system per Edwards reference 5.1.7. |
| Serial number record | Serial-number-to-revision link stored for traceability. |

The binary artifact is sourced from the **Bitbucket release artifact registry**
in place of the legacy `soft_rel$` release folder; no other field of the table
changes.

##### Blue/Green deployment

For any Bundle that ships a service-portal-hosted component, deployment uses the
Blue/Green pattern defined in
[ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122).
Operational details (cut-over windows, roll-back) are delegated to that page.

#### 4.1.7 Software Evaluation
<!-- Maps to Eastbourne SDP §4.1.7 -->

Software Evaluation is the post-launch loop. PCAS retains the Eastbourne
**FRACAS** reference (Failure Reporting, Analysis, and Corrective Action
System) for fielded defects and adds a **Service Portal feedback loop** as the
PCAS-local intake:

- Customer-reported issues land on the Jira Service Portal and are triaged into
  the Lean Kanban `Backlog` (§4.1.4.B).
- Severe defects raise a FRACAS record per the global procedure
  (Edwards reference 5.1.4) and are tracked to closure.
- Trends from the Service Portal feed weekly Grooming and biweekly Sync
  (§4.1.4.B), informing Bundle scope decisions.

#### 4.1.8 Supporting and Related Processes
<!-- Maps to Eastbourne SDP §4.1.8 -->

Supporting processes referenced from this SDP:

- **Configuration Management.** Authoritative source:
  [`pcas-scm.md`](./pcas-scm.md) (full body Phase 3). Covers change control,
  baseline control, Jira lifecycle, and tooling.
- **Knowledge management.** Confluence is the PCAS knowledge base. Design
  pages (§4.1.3), Release Notes (§4.1.6), and Sprint Review records (§5.5) all
  live in Confluence.
- **Source code management.** Bitbucket is the PCAS code host. Branching,
  merging, and release artifact policy are owned by
  [`pcas-scm.md`](./pcas-scm.md) §6.1 (BitBucket).
- **CI/CD.** Bitbucket Pipelines, self-hosted runner, lint and test gates per
  [ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122).
- **Team setup and onboarding.** EOB Team Guidance —
  [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609).
- **Process descriptions.** SW process & deliverables per stage —
  [NSST 895746050](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895746050).

#### 4.1.9 Mapping to Edwards Product Commercialisation Process
<!-- Maps to Eastbourne SDP §4.1.9 -->

PCP remains the governance backbone. PCAS uses the **Walking Skeleton** pattern
from the North Star Agile Roadmap
([ISP 985563137](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/985563137))
to deliver iteratively while still passing through PCP gates. The mapping
below acknowledges that M1 spans two early gates (Concept and Definition are
both pre-design from PCP's point of view) and that subsequent milestones each
align to a single gate:

| Walking Skeleton Milestone | PCP Stage Gate | Software Activity |
|---|---|---|
| **M1** Skeleton bring-up | Gate 1 – 2 (Concept → Definition) | Software Definition (§4.1.1) and initial Requirements (§4.1.2). |
| **M2** First end-to-end | Gate 3 (Design) | Architecture / Design (§4.1.3); first Bundle in *Planning* (e.g. `Gen3-4.0.x`). |
| **M3** Customer-trial-ready | Gate 4 (Pre-beta / Verification) | Bundle *Active*; independent V&T (§4.1.5); customer trial — the PCAS equivalent of the legacy "Beta" step. |
| **M4** Production | Gate 5 (Launch) | Bundle *Completed*; EC raised (§4.1.6); production Bundle release. |

This mapping is the contract between PCAS' iterative agile delivery and the
Edwards stage-gate governance: every Walking Skeleton milestone has a
corresponding PCP gate review, and every Bundle lifecycle transition has a
mapped milestone.

#### 4.1.10 Project and Design Reviews
<!-- Maps to Eastbourne SDP §4.1.10 -->

Reviews fall into two governance regimes — formal stage-gate reviews (Scrum
track) and continuous flow ceremonies (Lean Kanban track). The split mirrors
§4.1.4.A / §4.1.4.B so that the document stays internally consistent.

##### 4.1.10.A Scrum Track Reviews

The formal review set from the Eastbourne SDP is preserved for Scrum-track
work, with explicit owners and exit criteria:

> **Note.** Sprint Review and Sprint Retrospective are *sprint-level*
> ceremonies; they do **not** substitute for the formal SRR / SDR / SVR
> stage-gate reviews, which remain mandatory for Stream-level deliverables
> and continue to be triggered at PCP gates per §4.1.9.

| Review | Trigger | Output | Owner |
|--------|---------|--------|-------|
| **SRR** Software Requirements Review | SRS draft complete | Approved SRS, baselined in Confluence | Product Owner |
| **SDR** Software Design Review | SDS / SAS draft complete | Approved design pages | Software Project Leader |
| **SVR** Software Verification Review | SVS execution complete | V&T sign-off recorded against Bundle | Software Project Leader |
| **Sprint Review** | End of every Sprint | Sprint Review Record (template in §5.5) | Scrum Master |
| **Sprint Retrospective** | Immediately after Sprint Review | Action items in Confluence | Scrum Master |

##### 4.1.10.B Lean Kanban Track Reviews

The Lean Kanban track substitutes continuous-flow ceremonies for stage-gate
reviews; SRR/SDR/SVR are not run unless a Service Portal item is escalated
into the Scrum track:

| Ceremony | Trigger | Output | Owner |
|----------|---------|--------|-------|
| **Grooming** | Once a week, 30 min | Top of `Backlog (Hide)` refined and promoted to `Ready To Dev` | Tech Lead + Lead Engineer |
| **Sync** | Twice a week, 15 min (Mon Teams + Thu Team Meeting) | Flow / blockers / Bundle scope alignment notes | Lead Engineer |
| **InStaging Escalation Review** | Item idle >5 working days | Resolution plan or Software Manager escalation | Software Manager |
| **Bundle Release Review** | Bundle Active → Completed | Confluence Release Note approval | Software Project Leader + Software Manager |

#### 4.1.11 Measurement
<!-- Maps to Eastbourne SDP §4.1.11 -->

PCAS retains the Eastbourne measurement *goals*:

1. Goal 1 — measure software process effectiveness against plan.
2. Goal 2 — drive corrective action where measurements indicate drift.

The concrete metrics list and the data-collection mechanics are owned by
[`pcas-scm.md`](./pcas-scm.md) §7 *Software Process Metrics Measurement* (to
be authored in Phase 3) so that there is a single source-of-truth across both
the SDP and the SCM. PCAS-specific metrics expected to live there include
Lean Kanban throughput (cards/week), Scrum velocity, lint-gate pass-rate, and
Bundle on-time-delivery.

#### 4.1.12 Review
<!-- Maps to Eastbourne SDP §4.1.12 -->

This procedure is reviewed:

- **Quarterly** — Software Manager-led review of the procedure against actual
  practice, with corrective updates raised as a documentation Bundle.
- **Per-Sprint** — Sprint Retrospectives surface procedure issues from the
  Scrum track; recurring issues are escalated to the quarterly review.
- **Per-Bundle** — Bundle Release Review (§4.1.10.B) surfaces procedure issues
  from either track tied to release execution.

## 5. Support Documentation
<!-- Maps to Eastbourne SDP §5 -->

This section enumerates the documents this procedure relies on, grouped into
global Edwards procedures (§5.1), local PCAS procedures (§5.2), non-Edwards
references (§5.3), document templates (§5.4), and form templates (§5.5).

### 5.1 Global Procedures
<!-- Maps to Eastbourne SDP §5 (Global Procedures group) -->

The global Edwards procedure references inherited from the Eastbourne SDP are
preserved verbatim — they describe global Edwards processes (EQE024, FRACAS,
EC, PCP, Coding Standards) that are unchanged at PCAS:

| Ref | Title |
|-----|-------|
| 5.1.1 | Software Quality Development Procedure (replaces 1A070-030) |
| 5.1.2 | Software Quality Agile Process |
| 5.1.3 | Q73-701, Engineering Change Process |
| 5.1.4 | 016-005, Global Corrective Action Process — FRACAS |
| 5.1.5 | Q71-101, Product Commercialisation Process (PCP) Issue 5, Project Files & TCFs |
| 5.1.6 | Edwards Software Development Procedure (global) |
| 5.1.7 | Release of Firmware and Test Software to Production |
| 5.1.8 | 01A06-010, Security for Data and Applications |
| 5.1.9 | EQE024 Software Quality Engineering reference |
| 5.1.10 | Edwards Coding Standards (C, C++, C#, Python) |
| 5.1.11 | Edwards Branching and Merging policy |
| 5.1.12 | Edwards Documentation Standard |
| 5.1.13 | Edwards Risk Management |
| 5.1.14 | Edwards Configuration Management Standard |

### 5.2 Local PCAS Procedures
<!-- Maps to Eastbourne SDP §5 (Local Eastbourne Procedures group) -->

Local PCAS procedures replace the Eastbourne local references. The core list
points at the Confluence pages that define the One SW process, the Lean Kanban
practice, the CI/CD architecture, the North Star roadmap, and the EOB team
guidance:

| Ref | Title | URL |
|-----|-------|-----|
| 5.2.1 | One SW Software Development Process | https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517 |
| 5.2.2 | SW 개발 프로세스 및 산출물 (process & deliverables per stage) | https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895746050 |
| 5.2.3 | IS Legacy Product Lean Kanban | https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban |
| 5.2.4 | Bitbucket CI/CD | https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122 |
| 5.2.5 | North Star Agile Roadmap | https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/985563137 |
| 5.2.6 | EOB Team Guidance | https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609 |

### 5.3 Non-Edwards Documents
<!-- Maps to Eastbourne SDP §5 (Non-Edwards Documents group) -->

External references retained from Eastbourne and supplemented for the dual-track
model:

- OMG Unified Modeling Language (UML) — design notation reference (Eastbourne).
- The Scrum Guide — the canonical reference for the Scrum track (§4.1.4.A).
- Lean Kanban References — Anderson *Kanban: Successful Evolutionary Change*
  and Reinertsen *The Principles of Product Development Flow* — referenced for
  the Lean Kanban track (§4.1.4.B).

### 5.4 Document Templates
<!-- Maps to Eastbourne SDP §5 (Document Templates group) -->

The Eastbourne document templates are retained — they continue to apply to
Scrum-track Stream-level deliverables and to any Lean-Kanban item escalated
into the Scrum track:

- **SRS** — Software Requirements Specification.
- **IFS** — Interface Specification.
- **SAS** — Software Architecture Specification.
- **SDS** — Software Design Specification.
- **SVS** — Software Verification Specification.

### 5.5 Form Templates
<!-- Maps to Eastbourne SDP §5 (Form Templates group) -->

The Eastbourne formal review forms are retained, supplemented with PCAS forms
for the agile cadence:

- **SIR** — Software Initiation Record (Eastbourne).
- **SRR** — Software Requirements Review form (Eastbourne).
- **SDR** — Software Design Review form (Eastbourne).
- **SVR** — Software Verification Review form (Eastbourne).
- **Sprint Review Record** — PCAS, captured in Confluence per Sprint.
- **Bundle Release Note** — PCAS, the Confluence Release Note template
  prescribed in §4.1.6.

## 6. Change \\ Review History
<!-- Maps to Eastbourne SDP §6 -->

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| v1.0 | 2026-05-04 | PCAS Software Manager | Initial PCAS revision derived from Eastbourne *Site Software Development Procedure* (3) issue 9, 2025-03-26. Restructures §4.1.4 into Scrum / Lean Kanban dual track; replaces §4.1.6 Alpha/Beta/Production with the Bundle model; rewrites §4.1.9 PCP mapping against Walking Skeleton M1 – M4. |

## 7. Record Retention
<!-- Maps to Eastbourne SDP §7 -->

Records produced under this procedure are retained for **10 years post end-of-
life** of the parent Edwards product, consistent with the global retention
policy. PCAS-local storage locations:

- **Confluence** — design pages, Release Notes, Sprint Review records, SRR /
  SDR / SVR forms.
- **Bitbucket** — source code, build artifacts, the Bitbucket release artifact
  registry (replacement for `soft_rel$/Released`). Retention and back-up of
  Bitbucket repositories are governed by [`pcas-scm.md`](./pcas-scm.md) §6.1
  (BitBucket) and §6.7 (Backing up of Systems).
- **Atlassian backup** — Confluence and Jira data is included in the standard
  Atlassian backup regime. Restoration testing is owned by the platform team.
