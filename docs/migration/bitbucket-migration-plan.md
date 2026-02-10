# 📦 Bitbucket to GitLab Migration Plan

소스 코드뿐만 아니라 **협업의 역사(Pull Requests, Comments)**까지 완벽하게 이관하여 AI(Jarvis)의 학습 데이터를 확보하는 계획입니다.

---

## 🔑 1. 사전 준비 (Preparation)

### 1.1 Bitbucket 접근 권한
- [ ] **App Password 생성:**
    - Bitbucket Cloud는 계정 비밀번호로 API 접근이 불가능합니다.
    - `Personal settings` > `App passwords` > `Create app password`.
    - **권한:** `Repositories:Read`, `Pull requests:Read`, `Issues:Read` 필수 체크.

### 1.2 GitLab 준비
- [ ] **그룹 확인:** 저장소를 담을 그룹(`Integrated System` 등)이 존재하는지 확인.
- [ ] **사용자 확인:** Bitbucket의 이메일과 일치하는 GitLab 사용자가 생성되어 있어야 PR 작성자가 올바르게 매핑됩니다.

---

## 🚀 2. 마이그레이션 실행 (Execution)

### 2.1 GitLab Importer 사용 (권장)
1.  **메뉴 진입:** GitLab 상단 메뉴 `Create new...` > `New project/repository` > `Import project`.
2.  **Bitbucket Cloud 선택:** 소스 선택 화면에서 `Bitbucket Cloud` 클릭.
3.  **인증:**
    - Bitbucket에 로그인되어 있다면 OAuth로 자동 연결됩니다.
    - 또는 Username과 App Password 입력.
4.  **저장소 선택 & 매핑:**
    - 가져올 Bitbucket 리포지토리 목록이 뜹니다.
    - **Target Namespace:** `Integrated System` 등 그룹 선택.
    - **Target Slug:** GitLab에서 사용할 프로젝트 이름 지정.
5.  **Import 클릭:** 백그라운드에서 작업이 시작됩니다.

### 2.2 대안: Repository Mirroring (과도기용)
개발팀이 아직 Bitbucket을 쓰고 있어서, **실시간 동기화**가 필요한 경우입니다.

1.  GitLab에서 `Create blank project`.
2.  `Settings` > `Repository` > `Mirroring repositories`.
3.  **Git repository URL:** `https://<username>:<app_password>@bitbucket.org/<workspace>/<repo>.git`
4.  **Mirror direction:** `Pull` (Bitbucket -> GitLab).
5.  **동작:** 1시간마다(또는 수동) Bitbucket의 변경사항을 GitLab으로 가져옵니다.
    *   *주의: 이 방식은 PR(Merge Request)이나 이슈는 가져오지 않고 코드(커밋)만 가져옵니다.*

---

## 🧹 3. 사후 점검 (Validation)

### 3.1 데이터 무결성 확인
- [ ] **Branch & Tags:** 모든 브랜치와 릴리즈 태그가 잘 넘어왔는지 `git branch -a`, `git tag`로 확인.
- [ ] **Merge Requests:** Bitbucket의 Pull Request가 GitLab의 Merge Request로 변환되었는지, **댓글(Comments)**이 살아있는지 확인. (AI 학습의 핵심!)
- [ ] **LFS Objects:** 대용량 파일(LFS)이 누락되지 않았는지 체크.

### 3.2 로컬 개발 환경 전환 (개발자 가이드)
팀원들에게 배포할 가이드입니다.

```bash
# 기존 리모트 제거
git remote remove origin

# 새 GitLab 리모트 추가
git remote add origin http://gitlab.my-company.com/integrated-system/unify-platform.git

# 확인
git remote -v
```

---

## 🤖 4. AI (Jarvis) 활용 포인트
이관된 데이터는 이렇게 활용됩니다.

1.  **코드 리뷰 스타일 학습:** 과거 PR의 리뷰 코멘트를 분석하여, "이 팀은 변수 명명 규칙에 엄격하군", "보안 이슈를 중점적으로 보는군" 같은 스타일을 학습합니다.
2.  **버그 패턴 분석:** 코드가 수정된 히스토리(Git Log)와 연동된 이슈를 분석하여 자주 발생하는 버그 패턴을 찾습니다.
