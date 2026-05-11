# PCAS Software Configuration Management Working Practice (SCM)

This document is the PCAS-equivalent of the *Eastbourne Software Configuration
Management Working Practice*. Each heading below is paired with a
`<!-- Maps to Eastbourne SCM §X.Y -->` comment that records the source-of-record.
The full enumeration table lives in [`section-mapping.md`](./section-mapping.md).

**Source documents**
- `eastbourne.refer/Software Configuration Management Working Practice (2).docx`
- NSST 895680517 — One SW Software Development Process — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517
- NSST 895746050 — SW 개발 프로세스 및 산출물 — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895746050
- NSST 603062275 — IS Legacy Product Lean Kanban — https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban
- ISP 1039237122 — Bitbucket CI/CD — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122
- ISP 1085341713 — EOB Deployment & Server Operations — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085341713
- ISP 1085636609 — EOB Team Guidance — https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609

## Document Control

| Field | Value |
|-------|-------|
| Document Number | TBD |
| Issue | v1.5 |
| Effective Date | TBD |
| Document Owner | Software Manager |
| Next Review Date | TBD |

## Table of Contents

- [1. Objectives & Scope](#1-objectives--scope)
  - [1.1 Objective](#11-objective)
  - [1.2 Scope](#12-scope)
  - [1.3 Overview](#13-overview)
- [2. Definitions](#2-definitions)
- [3. Responsibilities](#3-responsibilities)
  - [3.1 Software Project Leader](#31-software-project-leader)
  - [3.2 Software Engineer](#32-software-engineer)
  - [3.3 Software Manager](#33-software-manager)
  - [3.4 Lead Engineer](#34-lead-engineer)
  - [3.5 Scrum Master](#35-scrum-master)
  - [3.6 Product Owner](#36-product-owner)
- [4. Change Control Process](#4-change-control-process)
  - [4.1 Purpose](#41-purpose)
  - [4.2 Configuration Control Procedure](#42-configuration-control-procedure)
    - [4.2.1 When to Apply Configuration Control Procedure](#421-when-to-apply-configuration-control-procedure)
    - [4.2.2 Checking in Configurable Items](#422-checking-in-configurable-items)
    - [4.2.3 Changing a Current Revision of Configurable Item (Checking Out)](#423-changing-a-current-revision-of-configurable-item-checking-out)
    - [4.2.4 Locking of Configurable Items](#424-locking-of-configurable-items)
    - [4.2.5 Changing Old Revisions of Configurable Items](#425-changing-old-revisions-of-configurable-items)
    - [4.2.6 Documentation Control](#426-documentation-control)
  - [4.3 Baseline Control Procedure](#43-baseline-control-procedure)
    - [4.3.1 Submission of Fixed Baselines](#431-submission-of-fixed-baselines)
      - [4.3.1.1 Version Numbers](#4311-version-numbers)
      - [4.3.1.2 Part Numbers](#4312-part-numbers)
    - [4.3.2 Approval of baselines](#432-approval-of-baselines)
    - [4.3.3 Management and Location of Forms](#433-management-and-location-of-forms)
- [5. JIRA](#5-jira)
  - [5.1 Purpose](#51-purpose)
  - [5.2 Procedure](#52-procedure)
    - [5.2.1 Problem Identification](#521-problem-identification)
    - [5.2.2 Problem Investigation](#522-problem-investigation)
    - [5.2.3 Problem Closure](#523-problem-closure)
    - [5.2.4 Lifecycle of Change Requests](#524-lifecycle-of-change-requests)
    - [5.2.5 Development of features in waterfall or agile methodology](#525-development-of-features-in-waterfall-or-agile-methodology)
- [6. Configuration Management Tools](#6-configuration-management-tools)
  - [6.1 BitBucket](#61-bitbucket)
  - [6.2 Git (on Azure)](#62-git-on-azure)
  - [6.3 SVN](#63-svn)
  - [6.4 Azure DevOps](#64-azure-devops)
  - [6.5 Jenkins](#65-jenkins)
  - [6.6 TeamCity](#66-teamcity)
  - [6.7 Backing up of Systems](#67-backing-up-of-systems)
- [7. Software Process Metrics Measurement](#7-software-process-metrics-measurement)
- [8. References](#8-references)
  - [8.1 References — Global Procedures](#81-references--global-procedures)
    - [8.1.1 Software Quality Development Procedure (replaces 1A070-030)](#811-software-quality-development-procedure-replaces-1a070-030)
    - [8.1.2 Software Quality Agile Process](#812-software-quality-agile-process)
    - [8.1.3 Q73-701, Engineering Change Process](#813-q73-701-engineering-change-process)
    - [8.1.4 016-005, Global Corrective Action Process - FRACAS](#814-016-005-global-corrective-action-process---fracas)
    - [8.1.5 Q71-101, Product Commercialisation Process (PCP) Issue 5, Project Files & TCFs](#815-q71-101-product-commercialisation-process-pcp-issue-5-project-files--tcfs)
  - [8.2 References — Local Eastbourne Procedures](#82-references--local-eastbourne-procedures)
    - [8.2.1 Eastbourne Site Software Development Procedure](#821-eastbourne-site-software-development-procedure)
    - [8.2.2 Release of Firmware and Test Software to Production](#822-release-of-firmware-and-test-software-to-production)
    - [8.2.3 01A06-010, Security for Data and Applications](#823-01a06-010-security-for-data-and-applications)
    - [8.2.4 Technical References](#824-technical-references)

---

## Objectives & Scope
<!-- Maps to Eastbourne SCM §1 -->

This section is the PCAS-equivalent of Eastbourne SCM §1. It establishes the
purpose of this Working Practice, its scope of applicability across PCAS
projects, and a reading map for the rest of the document. The CM mechanics
defined here are the configuration management companion to the Software
Development Procedure in [`pcas-sdp.md`](./pcas-sdp.md) and are parented by
`pcas-sdp.md` §4.1.8 (Supporting and Related Processes).

### Objective
<!-- Maps to Eastbourne SCM §1.1 -->

The objective of this Working Practice is to define a uniform Configuration
Management mechanism across PCAS that supports both execution tracks declared
in `pcas-sdp.md` §4.1.4 — the **Scrum track** for roadmap-driven new
development (EUV / ASP / OQC) and the **Lean Kanban track** for pull-based
maintenance and IS-Legacy work — and that produces an unbroken traceability
chain from Vision → Milestone → Stream → Epic → Bundle → Bitbucket tag →
Confluence Release Note. The procedure is owned by the PCAS Software Manager
and applies retroactively from the next Bundle.

### Scope
<!-- Maps to Eastbourne SCM §1.2 -->

This procedure applies to **all PCAS software** — EUV, ASP, OQC, and
IS-Legacy maintenance — and to **all engineers, technical leads, and
managers** working under the One SW principle defined in
[NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517).
Hardware-only configuration items (ECs, MAPICS part records) remain governed
by Edwards global procedures (Q73-701) and are referenced — not duplicated —
here. Documents that pre-date this procedure remain valid in their original
form until the next significant change forces a re-baseline; from that point
forward the PCAS rules in §4 and §6 apply.

### Overview
<!-- Maps to Eastbourne SCM §1.3 -->

The remainder of this document is organised as follows.
**§2 Definitions** lists the CM vocabulary, including PCAS-specific terms
(Bundle, Sprint, InStaging, Service Portal Request, Pull Request).
**§3 Responsibilities** assigns CM duties to the four PCAS roles (Project
Leader, Engineer, Manager, Lead Engineer).
**§4 Change Control Process** specifies the configuration-control flow
(Bitbucket pull requests in §4.2) and the baseline-control flow (Bundle
versioning in §4.3).
**§5 JIRA** documents the dual-track lifecycle that drives every Change
Request from intake to closure (§5.2.4).
**§6 Configuration Management Tools** prunes the Eastbourne tool list to an
Atlassian-first stack — Bitbucket primary, Bitbucket Pipelines for CI, with
explicit deprecation/not-used banners for SVN, Jenkins, Azure DevOps, and
TeamCity.
**§7 Software Process Metrics Measurement** is the canonical metrics
catalogue (delegated from `pcas-sdp.md` §4.1.11).
**§8 References** lists the global and local source documents.

## Definitions
<!-- Maps to Eastbourne SCM §2 -->

The following terms have the meanings given. Definitions marked *(PCAS)* are
PCAS-local extensions; the rest are preserved verbatim from Eastbourne SCM §2
and from `pcas-sdp.md` §2 (cross-document consistency).

| Term | Definition |
| ---- | ---------- |
| **Baseline** | An approved configuration of a configurable item against which subsequent changes are managed. |
| **CAR** | Corrective Action Request, raised against a non-conformity found in baselined material. |
| **Check-In / Check-Out** | In Git terms, *check-in* = `git commit` + `git push` to a topic branch followed by an approved Pull Request; *check-out* = `git checkout` of a topic branch from `develop`/`main`. The Eastbourne file-level lock semantics do **not** apply to Git — see §4.2.4. |
| **Configurable Item (CI)** | Any artefact whose evolution is controlled under this procedure: source code, build scripts, automated tests, design pages, release notes, infrastructure manifests. |
| **EC** | Engineering Change, raised under Edwards global procedure Q73-701 to authorise a change visible to the customer or to manufacturing. |
| **Functional Baseline** | The set of artefacts that define the agreed *behaviour* of a configurable item (requirements, acceptance criteria). |
| **Physical Baseline** | The set of artefacts that constitute a deliverable build (source tag + binary manifest + release note). |
| **Repository** | A managed store of configurable items. In PCAS, the primary repository is Bitbucket Cloud (§6.1). |
| **Significant Version** | A version released to a customer or to production. Triggers an EC under Q73-701. |
| **Type Test** | A formal verification activity that qualifies a configurable item against its specification. |
| **Version** | A specific identifiable revision of a configurable item. PCAS uses the Bundle versioning scheme `Gen<N>-<X>.<Y>.<Z>` (§4.3.1.1). |
| **Locking** *(legacy)* | File-level exclusive write reservation. Applies only to legacy SVN repositories under migration; **not used** in Git/Bitbucket — see §4.2.4. |
| **Bundle** *(PCAS)* | A coordinated multi-component release covering EUV / ASP / OQC under a single version banner. Defined in `pcas-sdp.md` §4.1.6 and used as the unit of release governance throughout §4.3. |
| **Bundle Generation** *(PCAS)* | The hardware-platform generation a Bundle targets. **Gen2** = legacy IS-Legacy stack (active range `Gen2-3.x.y`); **Gen3** = current platform (active range `Gen3-4.x.y`). See §4.3.1.1. |
| **Sprint** *(PCAS)* | A 2-week time-boxed iteration in the Scrum track. Defined in `pcas-sdp.md` §4.1.4.A. |
| **Service Portal Request** *(PCAS)* | A customer or internal ticket that enters PCAS through the Jira Service Portal (PSSM project) and is routed onto the Lean Kanban board. See §5.2.1. |
| **Pull Request (PR)** *(PCAS)* | A Bitbucket merge proposal. Mandatory peer review and a green Bitbucket Pipeline are pre-conditions for merge (§6.1, ISP 1039237122). |
| **InStaging** *(PCAS)* | The staging column of the Lean Kanban board (NSST 603062275). Items idle here for more than **5 working days** trigger Lead Engineer review. See §5.2.4. |
| **Lean Kanban** *(PCAS)* | The pull-based, WIP-limited execution mode for IS-Legacy maintenance, defined in [NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban). |
| **Scrum** *(PCAS)* | The roadmap-driven, time-boxed execution mode for new development (EUV / ASP / OQC). |
| **One SW** *(PCAS)* | The PCAS principle from [NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517) that the entire site shares one development process with two execution tracks selected per work-item. |
| **Lead Engineer** *(PCAS)* | The senior engineer who partners with the Product Owner during weekly Grooming on the Lean Kanban track ([NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban)). See §3.4. |

The MAPICS-as-CM-tool definition from Eastbourne is **not** carried over;
MAPICS is retained only as the EC part-number registry, defined in-line in
§4.3.1.2.

## Responsibilities
<!-- Maps to Eastbourne SCM §3 -->

CM duties are distributed across four PCAS roles. The first three are
preserved from Eastbourne SCM §3.1–§3.3; **§3.4 Lead Engineer** is a PCAS
extension required by `pcas-sdp.md` §3 and §5.2.4 Lean Kanban Grooming. The
sub-sections below add CM-specific responsibilities on top of the role
definitions in `pcas-sdp.md` §3.

### Software Project Leader
<!-- Maps to Eastbourne SCM §3.1 -->

The Software Project Leader is accountable for the Bundle scope and the
baseline approvals for their project. Specifically, the Project Leader:

- Owns the Bundle scope sign-off (§4.3) — confirms which Stories / Cards land
  in a Bundle and authorises the version-bump rule (§4.3.1.1).
- Approves the Confluence Release Note for every Bundle their project
  contributes to (§4.3.3).
- Co-signs the EC submission (§4.3.2) jointly with the Software Manager.
- Ensures that every Story / Card under their stewardship is recorded in Jira
  with the correct `fixVersion` Bundle Epic.

### Software Engineer
<!-- Maps to Eastbourne SCM §3.2 -->

Software Engineers are accountable for the CM hygiene of every change they
produce. Specifically, every PCAS engineer:

- Follows the Bitbucket commit and branch conventions defined in
  [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609)
  (EOB Team Guidance) — see §6.1 for the canonical branch-naming format.
- Performs PR peer review on at least one teammate's open PR per working day
  when capacity permits.
- Ensures their own PRs pass the Bitbucket Pipeline lint and unit-test gates
  (Ruff for Python, ESLint for TypeScript, per
  [ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122))
  before requesting review.
- Updates the Confluence design page (§4.2.6) when an implementation deviates
  materially from the original design.

### Software Manager
<!-- Maps to Eastbourne SCM §3.3 -->

The Software Manager owns the team-wide CM posture and the platform on which
CM runs. Specifically, the Software Manager:

- Owns InStaging escalations (§5.2.4 Lean Kanban) — when an item is idle in
  `InStaging` for >5 working days and the Lead Engineer's review does not
  resolve it, the escalation comes to the Software Manager.
- Owns Bitbucket backup oversight (§6.7) — confirms that the Edwards IM group
  daily 02:00 cron is running and that the 7-day retention window is honoured.
- Approves new Bitbucket repository creation and any deviation from the
  branch-naming convention.
- Co-signs the EC submission (§4.3.2) jointly with the Software Project Leader.

### Lead Engineer
<!-- Maps to Eastbourne SCM §3.4 -->
<!-- PCAS extension — no Eastbourne §3.4 counterpart -->

> **PCAS extension.** The Lead Engineer role is defined in `pcas-sdp.md` §3
> and is required by §5.2.4 (Lean Kanban Grooming) of this document. The role
> has no Eastbourne SCM counterpart.

The Lead Engineer is the senior technical partner of the Product Owner on the
Lean Kanban track. Specifically, the Lead Engineer:

- Partners with the Product Owner during the **weekly 30-minute Grooming**
  meeting ([NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban))
  to refine the top of the `Backlog` and promote tickets to `Ready To Dev`.
- Reviews InStaging escalations — items idle in `InStaging` >5 working days
  are first triaged here before being escalated to the Software Manager
  (§5.2.4).
- Mentors engineers on CM hygiene (§3.2) and signs off on technical
  refinement during Grooming.
- Reviews Bundle technical content (§4.3) and flags cross-track dependencies
  before the Bundle goes to EC submission.

### Scrum Master
<!-- Maps to Eastbourne SCM §3 (PCAS extension — Scrum Master CM responsibilities) -->
<!-- PCAS extension — no Eastbourne §3 counterpart -->

> **PCAS extension.** The Scrum Master role is defined in `pcas-sdp.md` §3.
> This sub-section adds CM-specific responsibilities required by §5.2.4
> Scrum-track lifecycle.

The Scrum Master facilitates Scrum-track ceremonies and protects the team
from CM-process friction. Specifically, the Scrum Master:

- Ensures every Story committed in Sprint Planning has a Jira `fixVersion`
  (target Bundle) recorded before work begins (§5.2.1).
- Enforces the §5.2.4 Scrum lifecycle — `Sprint Backlog → In Progress → In
  Review → Done` — and flags lifecycle violations to the Software Project
  Leader.
- Surfaces CM-related blockers (PR review backlog, Pipeline failures) at
  Daily Standup; escalates persistent blockers to the Lead Engineer (§3.4)
  or Software Manager (§3.3).
- Records Sprint Review Record (`pcas-sdp.md` §5.5) including the list of
  merged PRs and the Bundle version targeted.

### Product Owner
<!-- Maps to Eastbourne SCM §3 (PCAS extension — Product Owner CM responsibilities) -->
<!-- PCAS extension — no Eastbourne §3 counterpart -->

> **PCAS extension.** The Product Owner role is defined in `pcas-sdp.md` §3.
> This sub-section adds CM-specific responsibilities required by §4.3
> (Baseline Control) and §5.2.4 (lifecycle).

The Product Owner orders the Scrum backlog and the Lean Kanban
`Backlog (Hide)` column, and authorises Bundle scope. Specifically, the
Product Owner:

- Approves the Bundle scope (§4.3.1) — confirms the set of Stories/Cards
  that constitute a Bundle before the Bitbucket tag is cut.
- Approves the Confluence Release Note content (§4.3.3) for customer-facing
  language and Risk / Known Issues entries.
- Sets `fixVersion` (target Bundle) on every backlog item at intake
  (§5.2.1) for both Service Portal and Roadmap channels.
- Partners with the Lead Engineer (§3.4) during weekly Grooming on the Lean
  Kanban track.

## Change Control Process
<!-- Maps to Eastbourne SCM §4 -->

The Change Control Process governs both *configuration-item-level* changes
(individual files via Bitbucket PRs — §4.2) and *baseline-level* changes
(Bundle releases — §4.3). The two flows interlock: every baseline (§4.3) is
the integration of a set of approved configuration changes (§4.2). The
process applies under both execution tracks (Scrum, Lean Kanban) but the
*intake* differs by track — see §5.2 and `pcas-sdp.md` §4.1.4.

### Purpose
<!-- Maps to Eastbourne SCM §4.1 -->

The purpose of the Change Control Process is to ensure that every change to
a PCAS configurable item is **traceable**, **reviewed**, and **integrated**
into a controlled baseline before reaching production. The Bundle is the
PCAS unit of release governance (`pcas-sdp.md` §4.1.6) — the §4.3 procedure
elevates a set of configuration-controlled changes (§4.2) into a Bundle, and
the Bundle is what receives the EC under Q73-701 (§4.3.2). This intent is
preserved verbatim from Eastbourne SCM §4.1; only the mechanics of §4.2
(Git/Bitbucket replacing file-level check-in) and §4.3 (Bundle versioning
replacing the Eastbourne version literal) are PCAS-specific.

### Configuration Control Procedure
<!-- Maps to Eastbourne SCM §4.2 -->

This sub-section specifies how individual configurable items move from a
working revision to an approved revision. PCAS uses the Bitbucket Pull
Request flow throughout; the Eastbourne check-in/check-out/locking
terminology is preserved as section headings (for traceability) but the
mechanics are replaced.

#### When to Apply Configuration Control Procedure
<!-- Maps to Eastbourne SCM §4.2.1 -->

The Configuration Control Procedure applies whenever a configurable item is
**added**, **modified**, or **removed**. In practice this means: every code
change, every infrastructure manifest change, every automated test change,
and every Confluence design page change that affects a baselined item passes
through §4.2.2–§4.2.5. The Bitbucket Pipeline lint + unit-test gate
(ISP 1039237122) enforces the floor; the Pull Request peer review enforces
the ceiling.

#### Checking in Configurable Items
<!-- Maps to Eastbourne SCM §4.2.2 -->

> **Replaced.** The Eastbourne file-level *check-in* is replaced with the
> Git/Bitbucket Pull Request flow.

Checking in a configurable item follows these steps:

1. **Branch from `develop` (or `main` for hotfixes).** Use the canonical
   branch-naming convention `<INITIALS>_<JIRA-KEY>_<short-description>`
   defined in [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609).
   Example: `gp_EUV-3299_add-risk-filter`.
2. **Commit using Conventional Commits.** Format: `<type>(<scope>): <subject>`
   (e.g. `feat(frontend): add risk severity filter`). The full type / scope
   enumeration is defined in
   [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609);
   it is referenced — not duplicated — here so the two documents cannot drift.
3. **Push to Bitbucket.** Triggers the Bitbucket Pipeline (§6.1) which runs
   Ruff (Python) and/or ESLint (TypeScript via pnpm) plus unit tests on the
   self-hosted runner.
4. **Open a Pull Request** against `develop`. Include the Jira key in the PR
   title. Mandatory peer review by **at least one** reviewer.
5. **Merge** only when all of the following are true: pipeline green,
   reviewer approval recorded, and the source branch is up-to-date with
   `develop`.
6. **Delete the source branch** automatically on merge.

The Pull Request is the PCAS-equivalent of the Eastbourne "checking in"
event; the merge commit on `develop` is the controlled-revision boundary.

#### Changing a Current Revision of Configurable Item (Checking Out)
<!-- Maps to Eastbourne SCM §4.2.3 -->

> **Replaced.** Eastbourne *check-out* is replaced with `git checkout` of a
> feature branch from `develop`.

To change a current revision an engineer creates a feature branch from
`develop` (or from the relevant Bundle branch for an in-flight Bundle), edits
locally, rebases as needed, and follows §4.2.2 to land the change. **No
file-level lock is taken** — Git's three-way merge handles concurrent edits.
If two engineers race on the same file, the second PR rebases on top of the
first; conflicts are resolved by the engineer who rebased and re-reviewed by
the original PR's reviewer.

#### Locking of Configurable Items
<!-- Maps to Eastbourne SCM §4.2.4 -->

> **Replaced — N/A for Git.** File-level locking is not a Git concept.

Eastbourne SCM §4.2.4 specifies file-level exclusive write reservation. This
mechanism does **not** apply to PCAS configurable items in Bitbucket — Git's
distributed merge model is the primary concurrency control. The only
remaining context where locking is relevant is **legacy SVN repositories
still under migration** (§6.3); for those, the existing Eastbourne lock
semantics apply until the repo is migrated to Bitbucket. End-state target is
zero SVN repositories — see §6.3 deprecation banner.

#### Changing Old Revisions of Configurable Items
<!-- Maps to Eastbourne SCM §4.2.5 -->

Old revisions are mutated through **Git tags** plus **hotfix branches**.
Specifically: every Bundle release (§4.3) is recorded as an annotated
Bitbucket tag (e.g. `Gen3-4.3.5`); to change a previously-released item, an
engineer branches from the tag (`git checkout -b hotfix/Gen3-4.3.5_EUV-1234
Gen3-4.3.5`), follows the §4.2.2 PR flow, merges to a hotfix integration
branch, and the next Bundle re-release picks up the patch. The Bundle
version increments at the patch level — for example a hotfix on top of
`Gen3-4.3.5` becomes `Gen3-4.3.6`. Cross-references: §4.3 Baseline Control
Procedure, §4.3.1.1 Version Numbers.

#### Documentation Control
<!-- Maps to Eastbourne SCM §4.2.6 -->

> **Replaced.** Confluence is the **primary** documentation platform.

Documentation control follows the One SW directive in
[NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517):

- **Primary:** Confluence Cloud (NSST and ISP spaces, plus per-project
  spaces). All design pages, release notes, and operating procedures live
  here.
- **Legacy fallback:** SharePoint is acceptable only for documents that were
  already published there before this procedure took effect *and* have not
  been superseded by a Confluence equivalent. New SharePoint pages are not
  permitted.
- **Forbidden:** the Edwards File Server is **not permitted** for any new or
  modified document under this procedure (NSST 895680517 is explicit on this).
  Existing File Server documents must be migrated to Confluence on next
  significant change.

Each Confluence page that documents a configurable item carries a "Linked
Bundle" entry (Confluence label `bundle:Gen3-4.x.y`) so the documentation can
be traced to the baseline it describes.

### Baseline Control Procedure
<!-- Maps to Eastbourne SCM §4.3 -->

A **Bundle** is the PCAS baseline unit. One Bundle = one Bitbucket annotated
tag + one Jira `fixVersion` Bundle Epic + one Confluence Release Note page;
all three carry the **identical** version string. This contract matches
`pcas-sdp.md` §4.1.6 and is the spine of the rest of §4.3.

#### Submission of Fixed Baselines
<!-- Maps to Eastbourne SCM §4.3.1 -->

A fixed baseline is submitted by the Software Project Leader once the Bundle
scope is closed and all constituent PRs (§4.2) are merged. Submission means:
the Bitbucket tag is cut, the Jira Bundle Epic is set to `Released`, and the
Confluence Release Note is published. Sub-sections §4.3.1.1 (Version Numbers)
and §4.3.1.2 (Part Numbers) define the two identifiers carried by every
baseline.

##### Version Numbers
<!-- Maps to Eastbourne SCM §4.3.1.1 -->

> **Replaced.** Eastbourne version literal replaced by PCAS Bundle versioning
> `Gen<N>-<X>.<Y>.<Z>`.

**Historical context (Eastbourne).** The Eastbourne SCM specified the version
literal `AAAA/BB/XX.YY[.ZZ][.AA]`, where `AAAA` was the year, `BB` the
project code, and `XX.YY[.ZZ][.AA]` a four-part numeric identifier. This
literal is preserved here purely as the migration anchor — it does **not**
appear anywhere else in the body of this document and must not be used for
new PCAS baselines.

**PCAS Bundle versioning.** Every PCAS baseline carries the version string
`Gen<N>-<X>.<Y>.<Z>`, where:

- **`Gen<N>`** is the hardware-platform generation. Active values are
  `Gen2` (legacy IS-Legacy stack) and `Gen3` (current platform).
- **`<X>.<Y>.<Z>`** is a three-part SemVer-style number, where:
  - `<X>` is the **Major** — incompatible API or behavioural change.
  - `<Y>` is the **Minor** — backward-compatible feature addition.
  - `<Z>` is the **Patch** — backward-compatible bug fix or hotfix.

**Active range table (matches `pcas-sdp.md` §4.1.6 to prevent drift).**

| Generation | Active range  | Scope                                |
| ---------- | ------------- | ------------------------------------ |
| Gen2       | `Gen2-3.x.y`  | IS-Legacy stack (maintenance only)   |
| Gen3       | `Gen3-4.x.y`  | Current PCAS platform (EUV/ASP/OQC)  |

**Three-place identity rule.** For any single Bundle the version string must
appear identically in:

1. The **Bitbucket annotated tag** (`git tag -a Gen3-4.3.5 -m '…'`).
2. The **Jira `fixVersion`** Bundle Epic (e.g. EUV-XXXX with `fixVersion =
   Gen3-4.3.5`).
3. The **Confluence Release Note** page title (`Release Note — Gen3-4.3.5`).

Drift between any of the three is treated as a CM defect and must be fixed
before the Bundle is approved (§4.3.2).

##### Part Numbers
<!-- Maps to Eastbourne SCM §4.3.1.2 -->

> **Preserved verbatim.** MAPICS 9-digit + alpha part-number scheme is a
> global Edwards EC requirement (Q73-701 §5.1.7) and is **not** modified by
> PCAS.

Every Bundle that affects a deliverable item also carries a **MAPICS part
number** of the form `NNNNNNNNN-A` (nine digits + single alpha suffix), where
the digits identify the part record and the alpha suffix identifies the
revision within the part record. The Bundle version (§4.3.1.1) is the
*software identity* and the MAPICS part number is the *EC / manufacturing
identity*; the two are orthogonal and both are required for a production
release.

The mapping between Bundle versions and MAPICS revisions is recorded in the
**EC integration table** maintained in `pcas-sdp.md` §4.1.6. Each row of
that table pairs a Bundle version (e.g. `Gen3-4.3.5`) with the MAPICS part
record(s) it advances and the EC raised under Q73-701. Part-number
allocation, revision-letter advancement, and the EC raising procedure are
**unchanged** from the Eastbourne procedure.

#### Approval of baselines
<!-- Maps to Eastbourne SCM §4.3.2 -->

A baseline is approved through a two-stage workflow:

1. **Confluence Release Note approval.** The Software Project Leader (§3.1)
   and the Software Manager (§3.3) co-sign the Confluence Release Note page
   (Confluence approval workflow). The Lead Engineer (§3.4) reviews the
   technical content for cross-track dependencies before sign-off.
2. **EC raised under Q73-701.** For any baseline that constitutes a
   *significant version* (released to a customer or to production) an
   Engineering Change is raised under Edwards Q73-701 §5.1.7 with the
   Bundle version recorded in the EC's "Affects Version" field and the
   MAPICS part number(s) in the EC's "Part Records" field.

Both signatures plus the EC are required before the Bitbucket tag is treated
as a *Released* baseline. The Software Manager has final authority to halt
release if any approval is missing.

#### Management and Location of Forms
<!-- Maps to Eastbourne SCM §4.3.3 -->

> **Replaced.** Eastbourne form-folder paths are noted as historical only.

PCAS baseline forms are managed in two locations:

- **Confluence Release Note pages** (primary) — one page per Bundle, titled
  `Release Note — Gen<N>-<X>.<Y>.<Z>`, in the relevant project space.
  Contains the change log, the EC reference, the MAPICS part-number table,
  and the link to the Bitbucket tag.
- **Bitbucket `releases/` directory** (secondary) — an immutable artefact
  manifest (YAML or JSON) committed to the repo at the path
  `releases/Gen<N>-<X>.<Y>.<Z>.yaml`. Records the exact commit SHA, the
  build provenance from the Bitbucket Pipeline (ISP 1039237122), and the
  artefact checksums.

The Eastbourne form-folder paths from `\\eastbourne\…\soft_rel$\Released`
are **historical only** — they are not authoritative for any PCAS baseline.

## JIRA
<!-- Maps to Eastbourne SCM §5 -->

Jira is the system of record for every Change Request (CR) and every Story
under PCAS CM control. One Jira instance hosts both tracks: the Lean Kanban
track (Service Portal / PSSM project) and the Scrum track (EUV / ASP / OQC
roadmap projects). The dual-track lifecycle in §5.2.4 is the canonical
specification for state transitions; `pcas-sdp.md` §4.1.4 cross-references
*into* §5.2.4 for the lifecycle detail.

### Purpose
<!-- Maps to Eastbourne SCM §5.1 -->

The purpose of the JIRA section is to define how Change Requests and Stories
are captured, investigated, closed, and tracked through their lifecycle. In
PCAS, Jira tracks *both*:

- **Change Requests** that arrive via the Service Portal (PSSM project) and
  are executed under the Lean Kanban track (`pcas-sdp.md` §4.1.4.B).
- **Stories** that arrive via the roadmap (Vision → Milestone → Stream →
  Epic) and are executed under the Scrum track (`pcas-sdp.md` §4.1.4.A).

Both project schemes share the same workflow contract specified in §5.2.4 so
that cross-track dependencies (Jira link `is part of`) can be traced without
schema friction.

### Procedure
<!-- Maps to Eastbourne SCM §5.2 -->

The procedure has five phases — Identification (§5.2.1), Investigation
(§5.2.2), Closure (§5.2.3), Lifecycle (§5.2.4), and Methodology (§5.2.5).
The Lifecycle sub-section (§5.2.4) is the canonical state machine; the
preceding three sub-sections describe what happens *at* each transition.

#### Problem Identification
<!-- Maps to Eastbourne SCM §5.2.1 -->

> **Replaced.** Service Portal is the canonical inbound channel for Lean
> Kanban; Roadmap is the canonical inbound channel for Scrum.

Change Requests enter PCAS through one of two inbound channels:

- **Jira Service Portal (PSSM project)** — the Lean Kanban inbound channel.
  Customers and internal users submit tickets through the Service Portal.
  The existing AI-assisted classification tool (per
  [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609))
  reads the ticket, suggests the business unit (Integrated Systems
  / Abatement) and the target Bundle, and proposes a severity. The Lead
  Engineer accepts or overrides the classification during weekly Grooming
  (§3.4).
- **Roadmap (EUV / ASP / OQC)** — the Scrum inbound channel. Stories arrive
  pre-classified through the Vision → Milestone → Stream → Epic hierarchy
  defined in `pcas-sdp.md` §4.1.2.

Every Jira ticket — whether from Service Portal or Roadmap — receives a
unique key, a `fixVersion` (target Bundle), and a target track (Scrum or
Lean Kanban) at identification time.

#### Problem Investigation
<!-- Maps to Eastbourne SCM §5.2.2 -->

After identification (§5.2.1) the assigned engineer investigates: reproduces
the issue (for defects), confirms the severity, validates the target Bundle,
and confirms the business-unit routing (Integrated Systems vs Abatement for
Lean Kanban; project assignment for Scrum). Investigation findings are
recorded as Jira comments on the ticket; if scope changes, the
`fixVersion` and the labels are updated and the ticket is re-presented at
the next Grooming (Lean Kanban) or Sprint Planning (Scrum). Investigation
ends with the ticket entering the executable column (`Ready To Dev` for
Lean Kanban, `Sprint Backlog` for Scrum).

#### Problem Closure
<!-- Maps to Eastbourne SCM §5.2.3 -->

A ticket is closed once the **Definition of Done** checklist
([NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban)
workflow checklist) is satisfied:

1. Code merged to `develop` (or to the relevant Bundle integration branch).
2. Bitbucket Pipeline green — Ruff + ESLint + unit tests pass
   ([ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122)).
3. Confluence Release Note entry added (§4.3.3).
4. Verification note completed and reviewed (Lean Kanban InStaging sub-state
   "Verification Note completed / Ready for sign-off"; Scrum `In Review`
   approval).
5. Customer / requestor notified — Service Portal automatic close-out for
   Lean Kanban; Sprint Review demo for Scrum.

The transition to `Done` is the closure event of record.

#### Lifecycle of Change Requests
<!-- Maps to Eastbourne SCM §5.2.4 -->

> **Replaced — canonical dual-track lifecycle.** This is the single
> authoritative specification of state transitions for PCAS CRs. Both tracks
> share Jira as the system of record but have distinct column sets and
> ceremonies. Values below are sourced from
> [NSST 603062275](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban)
> (Lean Kanban) and `pcas-sdp.md` §4.1.4.A (Scrum).

**Lean Kanban (6 columns, NSST 603062275).**

| # | Column            | Meaning |
|---|-------------------|---------|
| 1 | `Backlog (Hide)`  | Service Portal intake, unrefined. Hidden from the active board view. |
| 2 | `Ready To Dev`    | Refined by Grooming, sized, sufficient detail to start. |
| 3 | `In Progress`     | Engineer actively working. WIP-limited to **2 cards per engineer**. |
| 4 | `InStaging`       | Implementation done; waiting for test / verification / sign-off. **5 working day** idle cap before Lead Engineer review. |
| 5 | `Ready to Signoff`| Verification note complete; awaiting reviewer sign-off. |
| 6 | `Done`            | Reviewed → closed. DoD (§5.2.3) satisfied. |

The board flow is `Backlog (Hide) → Ready To Dev → In Progress ↔ InStaging
→ Ready to Signoff → Done`. The bidirectional notation (`↔`) between
`In Progress` and `InStaging` reflects that an item discovered to need code
rework during staging returns to `In Progress` rather than escalating; it
does not loop indefinitely — the **5-working-day idle cap in `InStaging`**
forces resolution.

**InStaging sub-states** (workflow checklist captured inline on the Jira
ticket Description, per NSST 603062275). Sub-state 3 transitions the card
from column 4 (`InStaging`) to column 5 (`Ready to Signoff`); sub-state 4
transitions it from column 5 to column 6 (`Done`):

1. *Software Updated, Ready to Test* — card stays in column 4 (`InStaging`).
2. *Tested / Ready to write verification note* — card stays in column 4.
3. *Verification Note completed / Ready for sign-off* — **card moves: column 4 (`InStaging`) → column 5 (`Ready to Signoff`)**.
4. *Reviewed → Done* — **card moves: column 5 (`Ready to Signoff`) → column 6 (`Done`)**.

**Ceremonies (NSST 603062275 source-of-truth values).**

| Ceremony     | Frequency             | Duration | Participants                         |
| ------------ | --------------------- | -------- | ------------------------------------ |
| **Sync**     | Twice a week          | **15 min** each | Full Lean Kanban team. Monday in Teams; Thursday in Team Meeting. Alignment on flow / blockers / Bundle scope. |
| **Grooming** | Once a week           | **30 min** | Tech Lead + Lead Engineer (§3.4). Refines top of `Backlog`, promotes to `Ready To Dev`. |

**WIP limit:** **2 cards per engineer** in `In Progress`. The board is
considered "full" when WIP is reached and no new cards may move into
`In Progress` until the limit clears.

**Personal WIP rule:** an engineer may not have more than **2 cards** in
`In Progress` at any time. Pulling a third card requires moving one out
first (to `InStaging` or back to `Ready To Dev`).

**Scrum (sprint-state aligned, `pcas-sdp.md` §4.1.4.A).**

| # | State              | Meaning |
|---|--------------------|---------|
| 1 | `Sprint Backlog`   | Committed for the current sprint at Sprint Planning. |
| 2 | `In Progress`      | Engineer actively working. |
| 3 | `In Review`        | Open Bitbucket PR with green Pipeline; awaiting peer review. |
| 4 | `Done`             | PR merged, demoed at Sprint Review, DoD satisfied. |

**Sprint cadence:** 2-week sprints. Sprint Planning Mon W1; Sprint Review +
Retrospective Fri W2.

**Decision rule (issue → track) — restated from `pcas-sdp.md` §4.1.4 so this
section is self-contained:**

- If the work originates from a **roadmap item** (Vision → Milestone →
  Stream → Epic) on EUV / ASP / OQC → **Scrum track**.
- If the work originates from a **Service Portal ticket**, an **InStaging
  escalation**, or an **IS-Legacy maintenance request** → **Lean Kanban
  track**.
- Cross-track linkage uses the Jira `is part of` and `relates to` link
  types.

#### Development of features in waterfall or agile methodology
<!-- Maps to Eastbourne SCM §5.2.5 -->

> **Replaced.** PCAS One SW principle replaces the Eastbourne
> "waterfall or agile/scrum or agile/kanban" stub.

PCAS does **not** offer a methodology choice per project. Under the One SW
principle ([NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517))
the entire site shares **one process with two execution tracks**, and the
track is selected per work-item using the §5.2.4 decision rule. Scrum is
used for new development on the EUV / ASP / OQC roadmap; Lean Kanban is
used for IS-Legacy maintenance and Service Portal work. Waterfall is **not**
a permitted PCAS execution mode.

## Configuration Management Tools
<!-- Maps to Eastbourne SCM §6 -->

PCAS uses an **Atlassian-first** tool stack: Bitbucket as the single
source-of-record for code, Bitbucket Pipelines for CI, Jira for work
tracking, and Confluence for documentation. The Eastbourne tool inventory
is preserved as headings (§6.1–§6.7) but each non-Atlassian tool carries an
explicit status banner — DEPRECATED, LEGACY CI, or NOT USED at PCAS — so
the migration intent is unambiguous.

### BitBucket
<!-- Maps to Eastbourne SCM §6.1 -->

> **PRIMARY — source-of-record. All PCAS code lives here.**

Bitbucket Cloud is the single primary repository platform for PCAS. Every
configuration item under §4.2 control lives in Bitbucket; every baseline
under §4.3 is anchored to a Bitbucket annotated tag.

**Branch naming.** `<INITIALS>_<JIRA-KEY>_<short-description>` per
[ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609).
Examples: `gp_EUV-3299_add-risk-filter`, `dc_PSSM-105_fix-instaging-cron`.
Hotfix branches use the prefix `hotfix/` (e.g.
`hotfix/Gen3-4.3.5_EUV-1234`).

**Commit conventions.** Conventional Commits format:
`<type>(<scope>): <subject>` (one-line summary). The full enumeration of
permitted `<type>` values (`feat | fix | refactor | perf | test | docs |
chore | ci`) and `<scope>` values (`frontend | api | sync | db | cli |
slack | config`) is defined in
[ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609);
linked rather than duplicated to prevent drift.

**Pull Request policy.**

- PR review is **mandatory** — at least one reviewer must approve before merge.
- The Bitbucket Pipeline (Self-Hosted Runner) must be green before merge.
- The Pipeline runs Ruff (Python), ESLint (TypeScript via pnpm), and the
  per-repo unit-test suite. See
  [ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122).
- A failing Pipeline blocks merge; merge cannot be force-overridden.

**Tag-on-release.** Every Bundle (§4.3) is recorded as an annotated tag
matching the version string `Gen<N>-<X>.<Y>.<Z>`. Tags are immutable and
are retained indefinitely; the `releases/` artefact manifests (§4.3.3) are
also retained for the lifetime of the repository.

**Retention link.** Bitbucket repository content (branches, tags, PR
history) is preserved by the Atlassian Cloud infrastructure backup owned
by the Edwards IM group; recovery from accidental loss is described in §6.7
and is also called out in `pcas-sdp.md` §7 (Record Retention).

**Cross-references.** `pcas-sdp.md` §4.1.5 (lint gates), §4.1.6 (Bundle),
§7 (record retention); this document §6.7 (backups) and §7 (metrics
collection from Pipelines).

### Git (on Azure)
<!-- Maps to Eastbourne SCM §6.2 -->

> **LEGACY MIGRATION TARGET — migrate to Bitbucket on next significant
> change. No new Azure-hosted repos.**

Existing Azure-hosted Git repositories must be migrated to Bitbucket on the
next significant change (Bundle re-baseline). No new Git-on-Azure
repositories may be created. The migration uses `git push --mirror` from
the Azure remote to a fresh Bitbucket repo so history is preserved verbatim.

### SVN
<!-- Maps to Eastbourne SCM §6.3 -->

> **DEPRECATED — forbidden for new repos (NSST 895680517). Migrate one
> repo per Sprint.**

Per [NSST 895680517](https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517)
("File Server 금지" + Bitbucket+Confluence 단일화) SVN is forbidden for any
new PCAS repository. Migration plan:

1. Enumerate the remaining SVN repositories in the IS-Legacy estate.
2. Migrate one SVN repository per Sprint into Bitbucket via
   `git svn clone` so revision history is preserved.
3. Decommission the SVN repository on completion of migration.

End-state target: **zero** SVN repositories. Until migration completes, the
file-level lock semantics from the Eastbourne SCM §4.2.4 continue to apply
to the un-migrated SVN repos only.

### Azure DevOps
<!-- Maps to Eastbourne SCM §6.4 -->

> **NOT USED at PCAS — heading retained for global reference only.**

Azure DevOps (Boards / Pipelines / Artifacts) is not part of the PCAS tool
stack. The heading is retained so that engineers reading the global
Edwards procedure can locate the PCAS-specific position; the substantive
answer is "not in scope". For tool equivalents see Bitbucket (§6.1) and
Bitbucket Pipelines (§6.5 / replacement) at PCAS.

### Jenkins
<!-- Maps to Eastbourne SCM §6.5 -->

> **LEGACY CI — replaced by Bitbucket Pipelines (ISP 1039237122).**

Jenkins is the legacy CI platform for PCAS and is being replaced by
**Bitbucket Pipelines** running on a self-hosted runner with the
pull-based architecture described in
[ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122).
The Pipeline runs Ruff (Python) + ESLint (TypeScript via pnpm) + per-repo
unit tests on every PR push and on every merge to `develop` / `main`. The
runner architecture also supports the Blue/Green and Rolling deployment
evolutions described in ISP 1039237122. Existing Jenkins jobs are
decommissioned per repository as part of each repo's first PR after
migration; no new Jenkins jobs may be created.

### TeamCity
<!-- Maps to Eastbourne SCM §6.6 -->

> **NOT USED at PCAS — heading retained for global reference only.**

TeamCity is not part of the PCAS tool stack. The heading is retained for
global reference only; the substantive CI answer at PCAS is Bitbucket
Pipelines (§6.5 replacement / ISP 1039237122).

### Backing up of Systems
<!-- Maps to Eastbourne SCM §6.7 -->

> **PRIMARY — Edwards IM group + automated daily 02:00 cron, 7-day
> retention ([ISP 1085341713](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085341713)).**

System backups have two layers:

- **Atlassian Cloud (Bitbucket / Jira / Confluence) infrastructure backup**
  is owned by the **Edwards IM group** and is governed by Edwards-global
  IT policy. PCAS does not duplicate this layer.
- **Self-hosted-runner / EOB server backup** is automated via a daily
  **02:00 cron** with **7-day rolling retention**, per
  [ISP 1085341713](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085341713)
  (EOB Deployment & Server Operations). Restoration testing is owned by the
  EOB platform team and is also called out in `pcas-sdp.md` §7 (Record
  Retention).

The Software Manager (§3.3) confirms the cron is running and that the
7-day window is honoured.

> **General coding/style guidelines** from
> [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609)
> are folded into §3.2 (Software Engineer responsibilities) and §6.1
> (Bitbucket commit conventions) rather than being given a separate §6.8
> heading — preserving the mirror-and-modernize rule that every PCAS sub-
> heading must map to an Eastbourne sub-heading.

## Software Process Metrics Measurement
<!-- Maps to Eastbourne SCM §7 -->

> **Replaced — canonical PCAS metrics catalogue.** This section is the
> delegation target for `pcas-sdp.md` §4.1.11.

PCAS preserves the four Eastbourne metrics and adds the PCAS-specific
metrics required by [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609)
(EOB Team Guidance) and `pcas-sdp.md` §4.1.11. All metrics are collected from the **Javis viewer** (Postgres
`javis_brain`, populated by `sync_bidirectional.py`) which is the
source-of-truth; Confluence dashboards mirror the same numbers.

| Metric                          | Track       | Source                                | Collection Method |
| ------------------------------- | ----------- | ------------------------------------- | ----------------- |
| **CR by Type / Priority**       | both        | Jira (PSSM, EUV/ASP/OQC)              | `sync_bidirectional.py` → Postgres → viewer chart |
| **External vs Internal CR**     | both        | Jira `reporter` field (Service Portal vs internal) | viewer chart |
| **Backlog Age**                 | both        | Jira ticket `created` field           | viewer chart, weekly |
| **Time to Closure**             | both        | Jira `created` → `Done` transition    | viewer chart, weekly |
| **Sprint Velocity (last 6)**    | Scrum       | Jira sprint-completion data           | viewer dashboard, per sprint |
| **Sprint Burndown**             | Scrum       | Jira daily issue-count snapshot       | viewer chart, per sprint |
| **Lean Kanban Throughput**      | Lean Kanban | Jira `Done` transitions per week      | viewer chart, weekly |
| **Lint-gate pass rate**         | both        | Bitbucket Pipelines API (ISP 1039237122) | viewer chart, weekly |
| **Bundle on-time-delivery**     | both        | Jira Bundle Epic `due` vs `Released`  | viewer dashboard, per Bundle |
| **InStaging aging**             | Lean Kanban | Jira ticket idle time in `InStaging`  | viewer alert at >5 working days (Lead Engineer trigger, NSST 603062275) |
| **Risks tracked: delay**        | both        | `risks` table (`scripts/`)            | AI-assisted risk detection tool ([ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609)) |
| **Risks tracked: blocker**      | both        | `risks` table                         | risk detection |
| **Risks tracked: velocity_drop**| Scrum       | `risks` table                         | risk detection |
| **Risks tracked: dependency_block** | both    | `risks` table                         | risk detection |
| **Risks tracked: resource_conflict** | both   | `risks` table                         | risk detection |

The five risk types (`delay`, `blocker`, `velocity_drop`,
`dependency_block`, `resource_conflict`) are the canonical PCAS risk
taxonomy maintained per [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609)
(EOB Team Guidance); they are owned by the Software Manager.

**Cross-references.** `pcas-sdp.md` §4.1.11 (delegation in), §6.1
(Pipeline pass-rate source), §6.7 (backup retention for the metrics
database).

## References
<!-- Maps to Eastbourne SCM §8 -->

References are split into **§8.1 Global Procedures** (Edwards-wide
documents, preserved verbatim from Eastbourne) and **§8.2 Local PCAS
Procedures** (PCAS-specific Confluence pages that replace the Eastbourne
local references).

### References — Global Procedures
<!-- Maps to Eastbourne SCM §8.1 (Global Procedures group) -->

The five global Edwards procedures below are preserved verbatim from
Eastbourne SCM §8.1.1–§8.1.5 and are the same five rows that appear in
`pcas-sdp.md` §5.1.

#### Software Quality Development Procedure (replaces 1A070-030)
<!-- Maps to Eastbourne SCM §8.1.1 -->

The Edwards global Software Quality Development Procedure (replaces
legacy 1A070-030). Defines the quality-management framework that this
SCM Working Practice operates under.

#### Software Quality Agile Process
<!-- Maps to Eastbourne SCM §8.1.2 -->

The Edwards global Software Quality Agile Process. Provides the Edwards-
wide guard-rails for any agile execution at site level; PCAS implements
agile via the Scrum track defined in `pcas-sdp.md` §4.1.4.A.

#### Q73-701, Engineering Change Process
<!-- Maps to Eastbourne SCM §8.1.3 -->

Q73-701 is the Edwards global Engineering Change Process. §5.1.7 defines
the EC submission for software baselines and is invoked by §4.3.2 of this
document.

#### 016-005, Global Corrective Action Process - FRACAS
<!-- Maps to Eastbourne SCM §8.1.4 -->

016-005 is the Edwards global Corrective Action Process (FRACAS). PCAS
CARs (§2 Definitions) are raised under this procedure.

#### Q71-101, Product Commercialisation Process (PCP) Issue 5, Project Files & TCFs
<!-- Maps to Eastbourne SCM §8.1.5 -->

Q71-101 (PCP Issue 5) is the Edwards global Product Commercialisation
Process. The PCAS Walking-Skeleton mapping to PCP gates is defined in
`pcas-sdp.md` §4.1.9.

### References — Local Eastbourne Procedures
<!-- Maps to Eastbourne SCM §8.1 (Local Eastbourne Procedures group; renumbered to §8.2 in PCAS) -->

> **Replaced.** Eastbourne local references are superseded by the PCAS
> Confluence references below; the original §8.2.1–§8.2.4 headings are
> preserved (per the mirror-and-modernize rule) but each carries a
> "see PCAS local procedures" pointer in the body.

**PCAS Local Procedures (Confluence).**

| Reference        | Title                                                  | URL |
| ---------------- | ------------------------------------------------------ | --- |
| NSST 895680517   | One SW Software Development Process                    | https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895680517 |
| NSST 895746050   | SW 개발 프로세스 및 산출물                              | https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/895746050 |
| NSST 603062275   | IS Legacy Product Lean Kanban                          | https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/603062275/IS+Legacy+Product+Lean+Kanban |
| ISP 1039237122   | Bitbucket CI/CD                                        | https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122 |
| ISP 1085341713   | EOB Deployment & Server Operations (backup cron)       | https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085341713 |
| ISP 1085636609   | EOB Team Guidance (commit conventions, branch naming)  | https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609 |

The same table is mirrored in `pcas-sdp.md` §5.2 — keep the two tables in
sync if either is updated.

#### Eastbourne Site Software Development Procedure
<!-- Maps to Eastbourne SCM §8.1.6 -->

> **Replaced.** See the §8.2 PCAS local procedures table above; the legacy
> Eastbourne *Site Software Development Procedure* is superseded by
> [`pcas-sdp.md`](./pcas-sdp.md).

#### Release of Firmware and Test Software to Production
<!-- Maps to Eastbourne SCM §8.1.7 -->

> **Replaced.** See the §8.2 PCAS local procedures table above; release
> mechanics are defined in §4.3 (Bundle baseline) plus
> [ISP 1039237122](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1039237122)
> (CI/CD) and
> [ISP 1085341713](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085341713)
> (deployment + server operations).

#### 01A06-010, Security for Data and Applications
<!-- Maps to Eastbourne SCM §8.1.8 -->

> **Replaced.** See the §8.2 PCAS local procedures table above; PCAS
> security posture is governed by Edwards global IT policy plus the
> deployment and access safeguards defined in
> [ISP 1085341713](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085341713)
> (EOB Deployment & Server Operations).

#### Technical References
<!-- Maps to Eastbourne SCM §8.1.9 -->

> **Replaced.** See the §8.2 PCAS local procedures table above. PCAS
> technical references include:
>
> - The Conventional Commits specification — referenced in §6.1 and
>   [ISP 1085636609](https://ac-avi.atlassian.net/wiki/spaces/ISP/pages/1085636609).
> - The Scrum Guide — referenced in `pcas-sdp.md` §5.3.
> - The IS Legacy Product Lean Kanban Confluence page — NSST 603062275.
