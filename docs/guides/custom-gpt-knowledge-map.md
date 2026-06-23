# AC AVI Work Assistant — Reference Map

> **GPT Knowledge 파일.** 이 GPT가 Jira·Bitbucket·Kanban을 다룰 때 참조하는 지도(map)입니다.
> ⚠️ 이 파일은 대화로 노출될 수 있으므로 **자격증명/토큰은 일절 포함하지 않습니다.** 구조 정보만 담겨 있습니다.
> ⚠️ repo·프로젝트 이름은 회사 내부 정보이므로 이 GPT는 **비공개로 유지**하세요(공개 공유 금지).
> 최종 갱신: 2026-06-22 (scripts/gen_gpt_knowledge_map.py 자동 생성)

---

## 1. 시스템 개요 (어디로 라우팅?)

| 시스템 | 무엇 | 범위(잠김) | 권한 |
|---|---|---|---|
| **Jira** `ac-avi.atlassian.net` | 이슈/에픽/스토리/스프린트/보드 | **EUV, PSSM 만** | 읽기+쓰기 |
| **Bitbucket** `ac-avi` | repo/브랜치/커밋/PR/소스 | **ac-avi 워크스페이스만** | 읽기 전용 |
| **Kanban** `cyanlunakanban.vercel.app` | 개인 칸반 카드/보드 | **회사(edwards) 프로젝트만** | 읽기+카드생성 |
| **Confluence** `ac-avi.atlassian.net/wiki` | 위키 페이지 읽기/작성/정리 | **ISP 스페이스만** | 읽기+생성/수정 |

라우팅 단서: 이슈·에픽·스토리·스프린트·`EUV-####` → Jira / repo·브랜치·커밋·PR·diff → Bitbucket / 카드·todo·칸반 → Kanban / 위키·문서·페이지·회의록·정리 → Confluence.

---

## 2. API 오퍼레이션 맵

### Jira (operationId)
- **읽기**: `getProject`, `getProjectComponents`, `getProjectVersions`, `getCreateMetaIssueTypes`, `getCreateMetaFields`, `listPriorities`, `searchIssues`(JQL), `getIssue`, `getIssueTransitions`, `getIssueComments`, `listBoards`, `getBoardConfiguration`, `getBoardEpics`, `listBoardSprints`, `getSprint`, `getCurrentUser`
- **쓰기**: `createIssue`, `updateIssue`, `transitionIssue`, `addComment`, `createIssueLink`, `createSprint`, `updateSprint`, `moveIssuesToSprint`, `moveIssuesToBacklog`
- 규칙: JQL은 **반드시 EUV/PSSM 스코프**, description·코멘트는 **ADF 객체**, 상태변경은 `getIssueTransitions`→`transitionIssue`. 보드/스프린트/백로그 이슈는 `searchIssues`로(전용 list 엔드포인트는 deprecated).

### Bitbucket (operationId, 모두 읽기)
- `listRepositories`, `getRepository`, `listBranches`, `getBranch`, `listTags`, `listCommits`, `listCommitsForRevision`, `getCommit`, `getDiff`, `getDiffStat`, `listPullRequests`, `getPullRequest`, `getPullRequestCommits`, `getPullRequestDiff`, `getSource`, `getFileHistory`, `getCurrentUser`
- 규칙: 워크스페이스는 ac-avi 고정. repo slug만 주면 됨. 쓰기 불가.

### Kanban (operationId)
- `getCompanyBoard`(보드 현황), `getCompanyTask`(카드 상세), `createCompanyTask`(카드 생성)
- 카드 상태 컬럼: `todo` `plan` `plan_review` `impl` `impl_review` `test` `done`. 수정·삭제·이동 불가.

### Confluence (operationId)
- `searchPages`(CQL, space=ISP), `listIspPages`, `getPage`, `getChildPages`, `createPage`, `updatePage`, `getConfluenceUser`
- 규칙: **ISP 스페이스만**. 본문은 **storage 포맷(XHTML-like HTML)**. 수정은 `getPage`로 version 확인 후 +1.

---

## 3. Jira 프로젝트 (2개)

| 키 | 이름 | 유형 |
|---|---|---|
| **EUV** | PCAS Software Team | software |
| **PSSM** | Software Inquery/Request Potal | service_desk |

---

## 4. Kanban 회사 프로젝트 (edwards, 11개)

| 프로젝트 | 목적 | 주요 스택 |
|---|---|---|
| **EUVTumalo** | CODESYS-based EUV Tumalo PLC project with build, deploy, mapfile, and controller assets for Facility and Slice systems. | CODESYS ST, Python, Batch scripts, XML mapfiles |
| **codesys-onboarding** | Education-focused mirror of the UnifyPlasma platform for onboarding: CODESYS PLC project, metadata pipeline, and local backend+frontend+web- | Python 3.12 FastAPI gateway, React 18 + Vite UI/web-sim, CODESYS V3 ST |
| **edwards.euvgen4.v2** | — | — |
| **edwards.operation.board** | EUV Program IS 엔지니어링 자원관리 시스템 — 워크로그, FTE 예측, 마일스톤 관리 (SharePoint/Excel 대체) | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, FastAPI, SQL |
| **edwards.oqc.infra** | 반도체 장비 품질보증 플랫폼 — EUV/Abatement/Vacuum Pump FT&CC 자동화, BDD 시나리오 기반 Modbus/Hostlink 테스트 | React 18, TypeScript, Vite 5, FastAPI, SQLAlchemy, PostgreSQL 14, Cucu |
| **euvgen3plus** | EUV Abatement System HMI/PLC software - Industrial equipment control and monitoring | VB.NET, C#, WinForms, .NET Framework 4.0, WCF, Modbus, CODESYS PLC |
| **outlook.gerald** | Local-only personal Outlook triage service that reuses the Edwards Bookclub Entra/Graph pattern for mailbox organization workflows without a | Ruby on Rails, OmniAuth Entra ID, OAuth2 refresh flow, Microsoft Graph |
| **pcas-portal** | PCAS Portal — standalone Next.js 15 App Router portal replacing earlier Vite frontend and FastAPI service split | Next.js 15, TypeScript, pnpm, Vitest, Docker |
| **point.of.product** | Edwards Point of Product internal tool | — |
| **testrig-dashboard** | Edwards 테스트리그 대시보드 — 장비 테스트 모니터링 | Unknown |
| **unify** | Edwards 진공/플라즈마 장비 산업용 제어 게이트웨이+대시보드 — Modbus TCP PLC 폴링, InfluxDB 시계열, React 시각화 | React 18, TypeScript, Vite 5, Zustand, FastAPI, pymodbus, InfluxDB 2.7 |

> Kanban 카드 생성/조회는 위 프로젝트에 한정됩니다.

---

## 5. Bitbucket 저장소 (ac-avi, 56개 — Bitbucket project별)

### Abatement Legacy
`base.al.repo`

### Abatement Projects
`protrondual` — ProtronDual Abingdon Conversion  - PLC : Abingdon, IDE - CodeSys 3.6.16.19 - HMI · `unifyplasma` — UnifyPlasma Application

### Common Infrastructure
`act.automation` · `common_simulator` · `commontest` · `device_gateway` · `edwards.dataanalyzer.viewer` · `edwards.infrastructure.v2` — edwards.infrastructure v2.0 repository · `edwards.metadata.generator` · `edwards.oqc.infra` — Edwards PCAS OQC DT Infrastrucuture Project · `edwards.web.simulator` · `engineering.management` · `mapfile_manager` · `north.star.moblie.platform` · `northstar.config.manager` · `pcas-portal` · `plc-infrastructure-library` · `point.of.product` · `sw-portal` · `unify.ui.platfom` · `virtual.testrig.dashboard`

### EUVGen4_Tumalo
`codesys-onboarding` — Educational onboarding repo for UnifyPlasma / CODESYS HMI system · `edwards.euvgen4.v2` — EUVGen4 V2.0 project use Infra v2 · `edwards.product.db` · `edwards.sdgui.designer` · `euv.io.db` · `h2d_config_automator` — h2d_config_automator python script · `hrs.platform` · `modbus-interface-gateway-service` · `modbus-interface-gateway-service-v2` · `sdghelper` · `sdgui_assets` — tooltypes mapfiles layouts · `tumalo_plc`

### EUVZenith
`euv.bundle.manager` — Legacy EUV Gen2,Gen3 Bundle and config Managing Service · `euvgen2` — EUVGen2, Gen2+ PLC and HMI Software Repository · `euvgen3` — EUVGen3, Gen3+ PLC and HMI Software Repository · `euvhalo` — EUVHalo PLC and HMI Software Repository · `h2d-plc` · `hrs-plc` · `oqc_teststudy` · `type1iotest`

### PCAS Services
`andrew.sandbox` · `anjeonkyo6` · `autoreceipt.processor` · `pulse`

### PCC Software
`plclibrary` · `safety` · `sdg_map` · `unify`

### PCQD
`litedatalens` · `trojan` · `trojanconfigtool`

### PDS Product
`base.repo`

### Proteus
`proteus` · `proteusmodbusrelay`

> 워크스페이스는 ac-avi 고정. 커밋/브랜치/PR/diff 조회 시 위 slug를 그대로 사용.

---

## 6. Confluence — ISP 스페이스 (PCAS Project Knowledge Hub, 약 1859 페이지)

대규모 위키이므로 전체 목록은 싣지 않습니다. **검색으로 탐색**하세요: `searchPages` (CQL `space = ISP AND text ~ "키워드"`). 최근 수정된 페이지 예시:

- HRS 9N Integration issue (id `1256882177`)
- EUV Zenith B3.11.0 Kick-Off (id `878411811`)
- EUV Zenith Software Release 3.11.0 (id `878379027`)
- EUV B3.11.0 (id `1269825537`)
- EUV-3680 PSU Controller. (id `1260781572`)
- EUV Software Installer Manual_V1.0.1 (id `1267302429`)
- [Release Note] VIZEON Bundle 1.2.1 (id `1255309313`)
- Software Verification Note(B 1.2.1) (id `1246363656`)
- EUV-3680 PSU Controller (id `1246756865`)
- Release Notes - PCAS Software Team - VIZEON-1.2.1 - Jun 15 01:48 (id `1263829028`)
- Release Notes - VIZEON-1.2.1 (id `1264746499`)
- Monthly Report June.2026 (id `1256194111`)
- Software Verification (id `1256062988`)
- Proteus H2 Injection (id `1256062980`)
- HRS SV - Software Validation (id `1236336654`)

> 읽기·작성·수정 모두 ISP 스페이스에 한정. 본문은 storage 포맷(XHTML).

---

## 7. 시스템 간 연결 힌트

- **EUV 이슈 ↔ 코드**: Jira `EUV-####` 작업의 코드 변경은 Bitbucket에서 해당 키로 커밋 검색(`listCommits`)하거나 관련 repo에서 확인.
- **OQC 작업**: Jira(EUV/PSSM) + Bitbucket(`edwards.oqc.infra`) + Kanban(`edwards.oqc.infra`)이 같은 OQC 디지털화 흐름.
- **문서화/정리**: Jira·Bitbucket·Kanban에서 모은 내용을 Confluence ISP 페이지로 작성(`createPage`). 회의록·회고·설계 정리는 Confluence.
- **이름이 겹쳐도 다른 시스템**: 예) `unify`/`pcas-portal`/`point.of.product`는 Bitbucket repo이자 Kanban 프로젝트일 수 있음 — 사용자의 의도(코드면 Bitbucket, 카드/todo면 Kanban)로 구분.
