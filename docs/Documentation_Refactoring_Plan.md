# Documentation Refactoring Plan (Rev. 3)

## 1. Objective
Refactor the flat, time-based export into a structured Knowledge Management System.
The goal is to separate **Global Assets** (Team Knowledge) from **Project Specifics** (Product Specs) and **Temporary Activities** (TFTs).

## 2. Refactoring Strategy
- **Primary Classification:** Folder Structure (Physical Location).
- **Secondary Classification:** Naming Convention & Frontmatter (Logical Tagging).

## 3. Target Folder Structure (Taxonomy)

```text
📦 Documentation_Refactoring_Target
 ┃
 ┣━━ 📂 00.Knowledge_Base (Asset Library)
 ┃   ┃   📢 Permanent, Reusable knowledge across projects.
 ┃   ┣━━ 📂 Onboarding           (New Joiner Guides, Environment Setup)
 ┃   ┣━━ 📂 Tech_Stack           (Python, PLC/Codesys, Linux Manuals)
 ┃   ┗━━ 📂 Standards            (Coding Conventions, Git Strategy, Jira Guide)
 ┃
 ┣━━ 📂 10.Project_Product (The "System")
 ┃   ┃   📢 "Single Source of Truth" for the current product state.
 ┃   ┣━━ 📂 11.Requirements      (SRS, Backlog definitions)
 ┃   ┣━━ 📂 12.Architecture      (System Overview, Network Diagrams, Interfaces)
 ┃   ┣━━ 📂 13.Module_Design     (★ Consolidated Design Docs)
 ┃   ┃   ┣━━ 📂 H2D_Control
 ┃   ┃   ┣━━ 📂 Pump_System
 ┃   ┃   ┣━━ 📂 Safety
 ┃   ┃   ┗━━ 📂 UI_UX
 ┃   ┗━━ 📂 14.Manuals           (User Manuals, Install Guides for this machine)
 ┃
 ┣━━ 📂 20.Project_Management (The "History")
 ┃   ┃   📢 Chronological records and logs.
 ┃   ┣━━ 📂 Sprints              (Sprint Reviews, Retrospectives)
 ┃   ┃   ┣━━ 📂 Phase_Protron    (Protron Sprints)
 ┃   ┃   ┣━━ 📂 Phase_ScaledScrum
 ┃   ┃   ┣━━ 📂 Phase_Tumalo     (Tumalo Sprints)
 ┃   ┃   ┗━━ 📂 Phase_Unify
 ┃   ┣━━ 📂 Releases             (Release Notes)
 ┃   ┗━━ 📂 Meetings             (Weekly Syncs, Standups)
 ┃
 ┣━━ 📂 30.Activities_&_TFT (Special Tracks)
 ┃   ┃   📢 Task-oriented, finite duration activities.
 ┃   ┣━━ 📂 Cost_Reduction_TFT
 ┃   ┣━━ 📂 Spikes_&_POC         (Tech Feasibility, Experiments)
 ┃   ┗━━ 📂 Workshops
 ┃
 ┗━━ 📂 99.Archives
     ┣━━ 📂 Legacy_Drafts        (Old v1/v2 specs after merging)
     ┗━━ 📂 Deprecated           (Abandoned features)
```

## 4. Execution Steps

### Step 1: Create Skeleton & Taxonomy (Categorization)
- Create the directory structure defined above.
- **Bulk Move:**
    - `*Sprint*` -> `20.Project_Management/Sprints` (Sub-sort into Phases)
    - `*Release-Note*` -> `20.Project_Management/Releases`
    - `*TFT*` -> `30.Activities_&_TFT`
    - `*Guide*`, `*Instruction*` -> `00.Knowledge_Base` (Review needed)

### Step 2: Intelligent sorting of "Design Docs"
- Move `ASP-XXX`, `EUV-XXX` design files to `10.Project_Product/13.Module_Design/_Drafts` initially.
- Categorize them into H2D, Pump, Safety, etc.

### Step 3: Consolidation (The "Merge")
- Merge duplicate/versioned design docs into single authoritative files.
- Archive the originals.
