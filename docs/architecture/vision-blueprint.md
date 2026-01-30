# 🚀 AI-Driven Engineering Management Platform: "My Jarvis"

## 1. Vision & Goals (비전 및 목표)

### 🎯 Core Mission
**"탈출하라 (Exodus from Fragmentation), 그리고 통합하라."**
Jira, Bitbucket, Azure DevOps 등 파편화되고 무겁고 제약이 많은 기존 도구들로부터 탈출하여, **GitLab Self-Managed** 기반의 통합 플랫폼을 구축합니다. 이를 통해 여러 프로젝트와 팀을 **AI(Jarvis)**와 함께 유기적으로 운영하며, 궁극적으로는 **"자율 운영에 가까운 엔지니어링 조직"**을 만드는 것을 목표로 합니다.

### 🌟 Key Objectives
1.  **Single Source of Truth:** 코드, 이슈, 문서, CI/CD를 GitLab 하나로 통합.
2.  **AI Co-Pilot (Jarvis):** 단순 보조가 아닌, 프로젝트 매니징, 리소스 배분, 코드 리뷰를 수행하는 능동적 주체.
3.  **Efficiency & Agility:** 외부 API 제약과 느린 속도에서 벗어나, 데이터에 직접 접근하고 즉각 반응하는 시스템.
4.  **Secure Access:** 어디서든 접근 가능하지만(Public IP), 철저하게 보호되는(MFA) 환경.

---

## 2. Why GitLab Self-Managed? (선택의 이유)

Jira나 Azure DevOps API를 연동하는 것도 가능하지만, **GitLab Self-Managed**를 선택한 이유는 명확합니다:

*   **No API Rate Limits:** 내 서버 내부에서 도는 로직이므로 API 호출 제한이 없어, AI가 수천 개의 커밋을 실시간으로 분석해도 문제가 없습니다.
*   **Direct DB Access (Optional):** 필요하다면 API를 거치지 않고 직접 DB(PostgreSQL)에서 통계 데이터를 쿼리하여 엄청난 속도를 낼 수 있습니다.
*   **Full Customization:** 우리 팀만의 워크플로우(예: Teams 알림 포맷, 커스텀 이슈 필드)를 마음대로 개조할 수 있습니다.
*   **Cost Efficiency:** 라이선스 비용 대비 기능(All-in-One) 효율이 압도적입니다.

---

## 3. Technical Blueprint (기술 청사진)

### 🏗️ Infrastructure
*   **Hosting:** Azure VM (Standard D4s_v5 이상 권장 - 4 vCPU, 16GB RAM)
*   **OS:** Ubuntu LTS
*   **Network:** Public IP 할당 (외부 접속용), NSG(Network Security Group)로 포트 관리.
*   **Domain:** `gitlab.my-company-domain.com` (SSL/TLS 필수)

### 🔐 Security & Auth (Teams & MFA)
1.  **SAML / SSO 연동:** Azure AD(Entra ID)와 GitLab을 연동하여, 기존 회사 계정으로 로그인.
2.  **MFA (Multi-Factor Authentication):** Azure AD 단계에서 MFA를 강제하거나, GitLab 자체 2FA 설정을 통해 외부 접속 시 보안 강화.
3.  **Teams Integration:**
    *   Slack 대신 **Microsoft Teams Webhook**을 활용.
    *   GitLab의 이벤트(이슈 생성, 파이프라인 실패 등)를 Teams 채널로 전송.
    *   Jarvis(AI)의 알림("오늘의 할 일", "코드 리뷰 요청")도 Teams 봇으로 구현.

### 🧠 The "Jarvis" Engine (AI System Architecture)
GitLab API와 LLM을 연결하는 **Middleware (Python/Go)**를 구축합니다.

1.  **Collector (수집기):**
    *   주기적으로 GitLab의 `Commit`, `Merge Request`, `Issue`, `Wiki` 데이터를 수집.
2.  **Vector Store (기억 저장소):**
    *   팀원들의 코드 스타일, 과거 해결한 버그 내역, 프로젝트 문서를 임베딩하여 저장.
3.  **Analyzer (분석기 - LLM):**
    *   **Skill Profiling:** 활동 로그를 기반으로 팀원별 강점/약점/현재 부하(Load) 분석.
    *   **Context Awareness:** 여러 프로젝트(`OQC`, `Unify`, `HRS`) 간의 의존성 및 우선순위 판단.
4.  **Actuator (실행기):**
    *   **Auto-Triage:** 이슈 자동 분류 및 라벨링.
    *   **Smart Assignment:** "이 버그는 A님이 어제 수정한 코드와 관련 있으니 A님에게 할당" 및 Teams 알림 발송.
    *   **Progress Report:** 주간/일간 리포트 자동 생성 및 이슈 등록.

---

## 4. Implementation Roadmap (구현 로드맵)

### ✅ Phase 1: Foundation (완료/진행 중)
- [x] 온프레미 VM에 GitLab 설치 및 기본 설정.
- [x] 그룹/프로젝트 구조 설계 (`Integrated System`, `Abatement` 등).
- [x] API(`glab`, `python-gitlab`) 연동 테스트 및 데이터 생성 자동화.

### 🚧 Phase 2: Migration & Security (Azure 이관)
- [ ] **Azure VM 프로비저닝:** 16GB RAM 이상, SSD 확보.
- [ ] **Data Migration:** 온프레미 데이터(저장소, 이슈)를 Azure VM으로 백업/복원.
- [ ] **Public IP & Domain:** 도메인 연결 및 Let's Encrypt SSL 적용.
- [ ] **MFA & SSO:** Azure AD 연동으로 로그인 보안 체계 확립.

### 🚧 Phase 3: The Intelligence (Jarvis 구축)
- [ ] **Collector 개발:** GitLab 이벤트를 실시간으로 수집하는 Webhook 수신 서버 구축.
- [ ] **Teams Bot 개발:** "Jarvis, 현재 블로커가 뭐야?"라고 Teams에서 물으면 대답하는 봇 연동.
- [ ] **LLM Integration:** 수집된 데이터를 LLM에 던져서 요약/분석하는 파이프라인 개발.

### 🚧 Phase 4: Autonomy (자율 운영)
- [ ] **Auto-Code Review:** AI가 MR에 대해 1차 코드 리뷰 코멘트 작성.
- [ ] **Resource Optimization:** 팀원별 업무 부하를 시각화하고 최적의 업무 배분 제안 시스템 가동.

---

## 5. Conclusion
우리는 단순히 툴을 바꾸는 것이 아닙니다. **"데이터 주권"**을 확보하고, 그 데이터 위에 **"지능(AI)"**을 얹어, 관리 비용은 최소화하고 개발 효율은 극대화하는 **엔지니어링 혁신**을 시작하는 것입니다. JIRA나 Azure DevOps 같은 기성복(Ready-made)으로는 이 속도와 유연성을 따라올 수 없습니다.
