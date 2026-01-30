# Jarvis Project Architecture & Roadmap

## 1. 개요 (Overview)
**Goal:** Gerald의 아이디어(음성/텍스트)를 AI(Gemini)가 프로젝트 컨텍스트를 바탕으로 분석하여, 실무 플랫폼(Jira)에 정제된 백로그로 자동 등록하는 시스템 구축.

**Core Value:** 
- 생각의 속도와 구현의 속도 일치
- 팀장의 관리 공수 최소화
- 프로젝트 맥락(Context) 유지

## 2. 아키텍처 (Architecture)

### 2.1. Input Layer (The Ear)
- **Interface:** Telegram Bot or Mobile-friendly Web UI
- **Input Types:** Voice (Speech-to-Text), Text Notes, Images
- **Role:** Capture raw, unstructured ideas immediately.

### 2.2. Brain Layer (The Intelligence)
- **Engine:** Gemini 1.5 Pro / Flash
- **Context Source:** Local SQLite Database (Synced from Jira/Confluence)
- **Functions:**
  - **Context-Aware Analysis:** Classify input into projects (OQC, HRS, Unify, etc.).
  - **Smart Refinement:** Expand simple ideas into full Ticket formats (Summary, Description, AC).

### 2.3. Connector Layer (The Hands)
- **Tech:** Python / FastAPI
- **Role:** Bridge between the Brain and the Target Systems. Handles API authentication and formatting.

### 2.4. Target Layer (The Reality)
- **Systems:** Jira (Issue Tracking), Confluence (Knowledge Base)
- **Action:** Create Tickets, Update Pages, Link Issues.

## 3. 실행 로드맵 (Execution Roadmap)

### Phase 1: Context Synchronization (Current)
- **Goal:** Build the "Long-term Memory" for Jarvis.
- **Action:** 
  - Refactor `scripts/fetch_jira_to_sqlite.py` for stability.
  - Sync Jira issues from target projects (NSS, EUV, PROT, PSSM, ASP) to local SQLite.
  - **Status:** In Progress.

### Phase 2: The Brain Prototype
- **Goal:** Verify AI's ability to refine raw text into tickets using local context.
- **Action:**
  - Create `scripts/brain_prototype.py`.
  - Input: Raw text string.
  - Process: Query SQLite for similar issues -> Prompt Gemini -> Output JSON ticket.

### Phase 3: Interface & Connector
- **Goal:** Connect the real world to the Brain.
- **Action:**
  - Build a simple CLI or Web interface for input.
  - Implement Jira REST API POST logic to create actual tickets.

### Phase 4: Feedback Loop
- **Goal:** Continuous Improvement.
- **Action:** Use the tool in daily workflows (gym, commute) and refine prompts.

## 4. Technical Stack
- **Language:** Python
- **Database:** SQLite (Local Cache)
- **AI:** Google Gemini API
- **Integration:** Jira REST API
