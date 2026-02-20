# ✈️ Jira Cloud to GitLab Migration Plan

Jira Cloud의 데이터를 GitLab으로 안전하게 이관하고, AI(Jarvis)가 학습하기 최적화된 상태로 만드는 상세 계획입니다.

---

## 📅 1. 사전 준비 (Preparation)

### 1.1 계정 및 권한 확보
- [ ] **Jira Cloud:**
    - URL: `https://<your-company>.atlassian.net`
    - 계정: 관리자(Admin) 권한이 있는 계정
    - **API Token 발급:** [Atlassian Account](https://id.atlassian.net/manage/api-tokens) 에서 생성.
- [ ] **GitLab:**
    - 계정: `root` 또는 Owner 권한 계정 (`dave.kim`)
    - 그룹 생성: 이관받을 타겟 그룹 생성 (예: `Integrated System`, `Abatement`)

### 1.2 사용자 매핑 (User Mapping) - **가장 중요**
Jira의 작성자/담당자 정보를 유실하지 않으려면 GitLab에 동일한 이메일을 가진 사용자가 미리 존재해야 합니다.

1.  **Jira 사용자 목록 추출:** Jira의 `Settings > User management`에서 CSV 내보내기.
2.  **GitLab 계정 생성:**
    - `populate_gitlab.py` 스크립트를 변형하여 대량 생성 (`skip_confirmation: true` 필수).
    - 예: Jira `bob@example.com` -> GitLab `bob@example.com`

---

## 🚀 2. 마이그레이션 실행 (Execution)

GitLab의 내장 **Jira Importer**를 사용합니다.

### 2.1 파일럿 테스트 (Pilot Run)
- [ ] **대상:** 이슈가 50개 미만인 중요도가 낮은 Jira 프로젝트 선정.
- [ ] **실행:**
    1. GitLab 그룹으로 이동 (`Innovative Sandbox`).
    2. `New project` > `Import project` > `Jira`.
    3. URL/Email/API Token 입력.
    4. 매핑: `JIRA-TEST` -> `gitlab-test-import`.
    5. `Import` 클릭.
- [ ] **검증:**
    - 이슈 제목, 설명, 댓글이 잘 넘어왔는가?
    - 작성자가 `Jira User`가 아닌 실제 GitLab 사용자로 매핑되었는가?
    - 첨부파일 이미지가 잘 보이는가?

### 2.2 본 마이그레이션 (Full Migration)
- [ ] **일정:** 업무 영향이 적은 주말 또는 평일 야간.
- [ ] **대상:** `Integrated System`, `Abatement` 등 핵심 프로젝트.
- [ ] **주의사항:** 임포트 도중에는 Jira 이슈 생성을 잠시 중단(Read-only) 공지.

---

## 🧹 3. 사후 처리 및 AI 최적화 (Post-Processing)

단순 이관만으로는 부족합니다. "자비스"가 데이터를 잘 이해하도록 정제해야 합니다.

### 3.1 마크다운 변환 (Markdown Cleanup)
Jira의 독자 문법(`{code}`, `h1.`)을 GitLab 마크다운으로 변환하는 스크립트 실행.

```python
# 예시 로직 (clean_jira_issues.py)
import re
def convert_jira_to_markdown(text):
    text = re.sub(r'\{code:?(.*?)\}
(.*?)\n\{code\}', r'```\1\n\2\n```', text, flags=re.DOTALL) # 코드 블록
    text = re.sub(r'h(\d)\. ', r'\1# ', text) # 헤더
    return text
# 이 함수를 API를 통해 모든 이슈 Description/Note에 적용
```

### 3.2 불필요한 데이터 정리 (Archive)
- [ ] **오래된 이슈:** "3년 이상 된 `Closed` 이슈"는 `archive` 라벨을 붙이거나 `Close` 상태 유지.
- [ ] **Jira 링크 치환:** 본문에 있는 `JIRA-123` 같은 텍스트를 GitLab 이슈 링크(`#123`)로 치환 (정규식 활용).

---

## 🛡️ 4. Teams & MFA 연동 (Finalize)

### 4.1 알림 설정
- [ ] 각 GitLab 프로젝트의 `Settings > Integrations > Microsoft Teams` 설정.
- [ ] 마이그레이션 완료 알림을 Teams 채널에 전송.

### 4.2 보안 강화
- [ ] 모든 팀원에게 비밀번호 재설정 및 **MFA(OTP) 설정** 가이드 배포.
- [ ] (Azure AD 연동 시) SSO 로그인 테스트.

---

## 💡 Tip: "자비스" 학습 포인트
마이그레이션이 끝나면 AI에게 **"지난 1년간 우리 팀이 가장 많이 겪은 버그 유형이 뭐야?"**라고 물어볼 수 있게 됩니다. 이를 위해선 **이슈의 `Description`과 `Comments`가 깨지지 않고 잘 넘어오는 것이 핵심**입니다. 파일럿 테스트 때 이 부분을 집중적으로 보세요.

```