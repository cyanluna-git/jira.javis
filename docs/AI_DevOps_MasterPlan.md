# 🚀 AI-Driven Engineering Management: The "Jarvis" Master Plan

## 1. Vision & Mission (비전 및 목표)

### 🎯 Core Mission
**"Exodus from Fragmentation, Genesis of Intelligence."**
Jira, Confluence, Bitbucket 등 파편화된 레거시 도구들로부터 탈출하여, **GitLab Self-Managed** 기반의 통합 데이터 레이크를 구축합니다. 이 데이터를 기반으로 **AI(Jarvis)**가 프로젝트 관리, 코드 리뷰, 리소스 배분 등 엔지니어링 매니지먼트의 핵심 기능을 능동적으로 수행하는 **"자율 운영 조직"**을 목표로 합니다.

### 🌟 Key Objectives
1.  **Single Source of Truth:** 모든 개발 데이터(Code, Issue, Wiki)를 GitLab 하나로 통합.
2.  **AI Co-Pilot (Jarvis):** 단순 챗봇이 아닌, 실시간 상황을 모니터링하고 의사결정을 제안하는 AI PM.
3.  **Data Sovereignty:** API 제약 없는 온전한 데이터 소유권 확보 (On-Prem/Private Cloud).
4.  **Security & Efficiency:** MFA 기반 보안과 자동화된 워크플로우를 통한 효율성 극대화.

---

## 2. Migration Status (현재 진행 현황)

### 👥 1. User Management (완료)
- [x] **Jira 사용자 분석:** 활성 사용자 29명 및 전체 76명 식별.
- [x] **GitLab 계정 생성:** 76명 전원 생성 완료 (`populate_gitlab.py`).
- [x] **Mapping:** Jira `accountId` <-> GitLab `user_id` 매핑 파일 생성 완료 (`user_mapping.json`).

### 🎫 2. Jira to GitLab Issues (진행 중)
- [x] **전략 수립:** API v3 활용, 2-Step (Fetch -> Push) 방식 채택.
- [x] **Pilot Test:** `EUV` 프로젝트 이슈 200개 이관 성공 (Label, Status 매핑 검증 완료).
- [🔄] **Full Backup:** `fetch_jira_to_sqlite.py` 가동 중.
    - **Target:** 5개 프로젝트 (`NSS`, `EUV`, `PROT`, `PSSM`, `ASP`)
    - **Progress:** 3,700+개 중 약 1,000개 수집 완료 (첨부파일 포함).
- [ ] **Data Load:** 백업 완료 후 `push_sqlite_to_gitlab.py` 실행 예정.

### 📚 3. Confluence to GitLab Wiki (진행 중)
- [x] **전략 수립:** `Pandoc` 활용 HTML -> Markdown 변환, Git 직접 Push 방식.
- [🔄] **Full Export:** `fetch_wiki_to_local.py` 가동 중.
    - **Target:** `ISP` Space (PCAS Project Knowledge Hub)
    - **Progress:** 1,700+ 페이지 중 약 75개 파일 생성 완료.
- [ ] **Git Push:** 변환 완료된 파일들을 `pcas-software.wiki.git`으로 Push 예정.

### 📦 4. Bitbucket to GitLab Repo (대기 중)
- [ ] **Repository Analysis:** 이관 대상 리포지토리 식별 필요.
- [ ] **Migration:** GitLab Importer 또는 Mirroring 기능을 사용하여 PR/댓글 포함 이관.

---

## 3. System Architecture (시스템 아키텍처)

### 🏗️ Infrastructure
*   **Current (Temp):** On-Premise VM (`10.82.37.79`) - 4GB RAM (Resource Constrained).
*   **Target (Final):** Azure VM (Standard D4s_v5, 16GB RAM) + Public IP + Domain.
*   **Security:** Azure AD 연동 (SAML/SSO) + MFA 강제 적용.

### 🧠 The "Jarvis" Engine
1.  **Collector:** GitLab Webhook & API (실시간 데이터 수집).
2.  **Brain (LLM):** Gemini Pro / GPT-4 (맥락 분석 및 추론).
3.  **Action:**
    *   **Auto-Triage:** 이슈 자동 분류 및 담당자 할당.
    *   **Code Review:** MR 생성 시 1차 코드 리뷰 및 피드백.
    *   **Risk Alert:** 마감일 임박, 진행 지연 등을 Teams 채널로 알림.

---

## 4. Immediate Roadmap (향후 계획)

### 📅 Phase 1: Data Migration Completion (D-Day ~ D+2)
1.  **Jira/Confluence 백업 모니터링:** 스크립트 완료 확인 (`100%`).
2.  **일괄 업로드:** 수집된 데이터를 GitLab으로 Push.
3.  **데이터 검증:** 누락된 첨부파일이나 깨진 링크 확인 및 보정.

### 📅 Phase 2: Workflow Setup (D+3 ~ D+5)
1.  **Board 설정:** 생성된 이슈들을 `Workflow`, `Component` 보드에서 시각화.
2.  **Team Onboarding:** 팀원들에게 접속 정보 배포 및 Teams 연동 테스트.
3.  **Service Desk:** `PSSM` 프로젝트 서비스 데스크 활성화.

### 📅 Phase 3: "Jarvis" Activation (D+6 ~ )
1.  **Python Bot 개발:** 매일 아침 "Daily Standup Summary"를 이슈로 자동 생성하는 봇 가동.
2.  **Skill Profiling:** 이관된 데이터(과거 활동)를 분석하여 팀원별 스킬셋 프로파일링 리포트 생성.

---

## 5. Conclusion
우리는 단순한 "툴 교체"를 하는 것이 아닙니다. **데이터의 주권을 회복**하고, 그 위에 **AI라는 지능**을 얹어, 관리 비용은 최소화하고 개발 효율은 극대화하는 **엔지니어링 혁신**을 진행하고 있습니다. 지금의 마이그레이션 작업은 그 혁신을 위한 가장 중요한 첫걸음(Foundation)입니다.
