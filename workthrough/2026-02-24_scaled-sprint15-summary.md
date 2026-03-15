# Scaled Sprint 15 Summary — Feb 3–23, 2026

**Subject: Scaled Sprint 15 Summary — Feb 3–23, 2026**

---

Hi [Manager's name],

Please find below a summary of **Scaled Sprint 15** (Feb 3–23, 2026) across the EUV and ASP projects.

---

## Sprint Overview

| | Total | Done | In Staging / QA | In Progress | Remaining |
|---|---|---|---|---|---|
| **EUV** | 28 | 11 | 6 | 6 | 5 |
| **ASP** | 13 | 9 | 1 (Peer Review) | 2 | 1 |
| **Total** | **41** | **20 (49%)** | **7** | **8** | **6** |

---

## EUV Project Highlights

### 1. HRS Transition — Module Design & Logic

The team made solid progress on the HRS (Hydrogen Recovery System) subsystem design and implementation.

**Completed:**
- **EUV-3093 / EUV-3095** — HRS IO parameter description and Modbus Data Definition documented on Mapfile (Michal)
- **EUV-3325** — CWaterSystem design document completed: water tank level control system fully specified (Moonsu)
- **EUV-3327** — CPsaController design document completed: PSA state machine architecture defined (Amelia)
- **EUV-3374** — HRS Enable signal logic updated (Moonsu)
- **EUV-3376** — Analogue inputs implemented in PowerboxIO Template (Tushar)
- **EUV-3381** — EUV Watchdog for HRS implemented (Moonsu)

**In Progress / Near Completion:**
- **EUV-3276** — HRS Module functionality review and revision ongoing (Moonsu)
- **EUV-3320** — HRS 9N Unit screen mockup (Figma) update currently in QA (Tushar)
- **EUV-3382** — Safety sensor alert level classification in progress (Moonsu)

### 2. HRS Blender Box Extensions

- **EUV-3333** — RB pipe line connection updated on Overview HMI — Done (Prakashbhai)
- **EUV-3282** — Recipe default settings update (Extract warning, Pump Type) — in QA (Tushar)
- **EUV-3380** — Water flowmeter data updated with PCW inlet valve — in QA (Ethan)
- **EUV-3371 / EUV-3372** — FV245 valve operation and PT01 sensor additions in progress (Moonsu)

### 3. Virtual TestRig & EUVGen4 Infra

- **EUV-3233** — Virtual TestRig fully containerized and integrated into Unify Docker stack — Done (Gerald)
- **EUV-3283** — EUV Gen4 Infra v2 Phase 2 epic closed — Done (Prakashbhai)
- **EUV-3315** — IO Modules automated tests completed — Done (Gerald)
- **EUV-3237** — Gen2+ Python Simulator currently in staging (Dave)

### 4. TSMC Phase 2 / SDG UI

- **EUV-3321** — TSMC Phase 2 regression test for Dummy type variants — in staging (Amelia)
- **EUV-3330** — Confirmation Dialog for configuration updates — in staging (Amelia)
- **EUV-3275** — Bundle 1.2.0 verification notes ongoing (Dave)

---

## ASP (Unify Plasma) Project Highlights

### 1. Module Implementation — Plasma System

The team completed a significant batch of Unify Plasma control modules this sprint:

**Completed:**
- **ASP-197** — ExhaustMonitoring module (Jayden)
- **ASP-198** — MFCN Control / Atomizing Spray module (Akshay)
- **ASP-200** — H2 Injection Control module (Ganesh)
- **ASP-223** — Safety Monitoring module (Jayden)
- **ASP-234** — Cooling Control module (Wookhee)
- **ASP-237** — Mode Controller module (Ganesh)
- **ASP-239** — Plasma Sequence: Torch Re-ignition Retry (3 attempts) implemented (Wookhee)

**In Progress:**
- **ASP-236** — Connecting all modules via Message Broker (Wookhee) — near completion
- **ASP-235** — Dynamic Physical IO Binding (Ganesh) — stretch goal, in progress
- **ASP-203** — ScraperControl module currently in Peer Review (Wookhee)

### 2. Mobile HMI — Flutter App (Tushar)

- **ASP-238** — Flutter mobile app upgraded to UUID-based Tree API; tree structure visualization and real-time HMI widgets (Numeric, Lamp) implemented and Done.

### 3. Web-based Simulator — Phase 3 (Prakashbhai)

- **ASP-240** — Performance improvements, compact widgets, and JSON-based layout configuration completed and Done.

---

## Rolling Into Next Sprint

The following items did not complete this sprint and will carry over:

- **EUV**: HRS module review (EUV-3276), Blender Box sensor additions (EUV-3371/3372/3373), TSMC PLC update items (EUV-3370), Bundle 1.2.0 verification notes (EUV-3275)
- **ASP**: Message Broker integration (ASP-236), Dynamic IO Binding (ASP-235)

---

## Documentation Produced This Sprint

18 Confluence pages were created or updated with the `scaled-sprint15` label, covering HRS module design specs, Virtual TestRig architecture, EUV Software V2 migration planning, and Unify Plasma module implementation notes.

---

Please let me know if you need any additional detail on specific items.

Best regards,
[Your name]
