# 🌐 Customer Portal Architecture (Blueprint)

## 1. Overview
GitLab 내부 환경과 완전히 분리된 **외부 고객 전용 웹 포털**을 구축하여, 보안성을 유지하면서도 고객 경험(CX)을 극대화하는 지원 시스템을 설계합니다. 개발팀은 GitLab에서 벗어나지 않고, 고객은 전용 포털에서 안전하게 소통합니다.

## 2. Core Features
*   **Secure Access:** MFA가 적용된 안전한 로그인 (Azure AD / MS 계정 연동).
*   **Easy Ticket Submission:** 직관적인 UI의 이슈 접수 폼.
*   **Real-time Status:** 내 문의 처리 현황(접수, 진행 중, 완료) 실시간 조회.
*   **Communication:** 댓글 및 이메일 알림을 통한 양방향 소통.

---

## 3. System Architecture

```mermaid
graph LR
    User((Customer)) -->|MFA Login| Portal[Web Portal (Next.js)]
    Portal -->|API| Backend[API Gateway (Python/Node)]
    Backend -->|GitLab API| GitLab[(GitLab PSSM Project)]
    
    GitLab -->|Webhook| Backend
    Backend -->|Notification| Portal
    Backend -->|Email| User
```

### 3.1 Frontend (Web Portal)
*   **Tech Stack:** Next.js (React), Tailwind CSS
*   **Key Pages:**
    *   `Login`: MFA 통합 로그인 페이지.
    *   `Dashboard`: 나의 문의 목록 (Queue).
    *   `New Request`: 접수 폼 (제목, 설명, 첨부파일, 유형 선택).
    *   `Detail View`: 이슈 상세 및 댓글 대화창.

### 3.2 Backend (Middleware)
*   **Tech Stack:** Python (FastAPI) or Node.js (Express)
*   **Role:**
    *   **Auth Proxy:** 외부 사용자와 GitLab 내부 사용자 매핑.
    *   **API Wrapper:** GitLab API를 호출하여 이슈 생성/수정 (Service Desk User 권한 대행).
    *   **Sync Engine:** GitLab Webhook을 수신하여 포털 DB(캐시) 업데이트 및 알림 발송.

### 3.3 Security & Auth
*   **External Users:** Azure AD B2C 또는 Auth0 등을 활용하여 MFA 강제 적용.
*   **Internal Access:** GitLab 접근 불가. 오직 포털을 통해서만 제한된 정보 접근.

---

## 4. Workflow (User Journey)

### 🟢 Step 1: Issue Submission
1.  고객이 포털 로그인 후 "문의 접수" 클릭.
2.  폼 작성 후 제출 -> Backend가 GitLab `PSSM` 프로젝트에 이슈 생성.
3.  이슈 생성 시 `External` 라벨 자동 부착.

### 🟡 Step 2: Triage & Assignment
1.  **Jarvis (AI):** 이슈 내용을 분석하여 `Category::Software`, `Priority::High` 라벨 자동 분류.
2.  GitLab 개발팀은 내부 보드에서 이슈 확인 및 담당자 할당.

### 🔵 Step 3: Communication
1.  **개발팀:** GitLab 이슈에 댓글 작성. (내부 전용은 `Confidential` 체크)
2.  **동기화:** Backend가 Webhook을 통해 댓글을 감지 -> 포털의 해당 티켓 댓글란에 업데이트 -> 고객에게 이메일 알림.
3.  **고객:** 포털에서 댓글 확인 후 답글 작성 -> GitLab 이슈에 댓글로 추가됨.

### 🔴 Step 4: Resolution
1.  개발팀이 문제 해결 후 이슈 `Close`.
2.  포털 상태가 `Resolved`로 변경되며 고객에게 "만족도 조사" 요청 발송.

---

## 5. Benefits
*   **License Saving:** 외부 고객용 GitLab 라이선스 비용 0원.
*   **Security:** 내부 코드 및 기밀 정보 완벽 격리.
*   **Professionalism:** 기업 브랜딩이 적용된 전용 포털 제공.
