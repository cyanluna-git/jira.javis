# 🦊 GitLab API Cheatsheet

GitLab을 "Jarvis"처럼 활용하기 위한 핵심 API 가이드입니다.
모든 API 호출에는 인증 헤더가 필요합니다.

**Base URL:** `http://<YOUR_GITLAB_IP>/api/v4`
**Headers:**
```json
{
  "PRIVATE-TOKEN": "glab-admin-token-12345",
  "Content-Type": "application/json"
}
```

---

## 👥 1. 그룹 & 프로젝트 관리 (Structure)

### 그룹 목록 조회
*   **Method:** `GET /groups`
*   **Query Params:** `search=<name>`, `per_page=100`
*   **Example:** `GET /groups?search=Integrated System`

### 그룹 멤버 추가
*   **Method:** `POST /groups/:id/members`
*   **Body:**
    ```json
    {
      "user_id": 3,
      "access_level": 30  // 10:Guest, 20:Reporter, 30:Dev, 40:Maintainer, 50:Owner
    }
    ```

### 프로젝트 생성
*   **Method:** `POST /projects`
*   **Body:**
    ```json
    {
      "name": "New Project",
      "namespace_id": <group_id>,
      "visibility": "private"
    }
    ```

---

## 📝 2. 이슈 & 워크플로우 (Work Management)

### 이슈 생성 (가장 많이 씀)
*   **Method:** `POST /projects/:id/issues`
*   **Body:**
    ```json
    {
      "title": "Bug in login flow",
      "description": "Log details...",
      "labels": "bug,critical",
      "assignee_ids": [3],
      "milestone_id": 5
    }
    ```

### 이슈 목록 조회 (필터링)
*   **Method:** `GET /projects/:id/issues` (또는 `/groups/:id/issues`)
*   **Query Params:**
    *   `state=opened`
    *   `labels=bug`
    *   `assignee_id=3`
    *   `scope=all` (그룹 내 전체 조회 시)

### 댓글 달기 (AI 피드백용)
*   **Method:** `POST /projects/:id/issues/:issue_iid/notes`
*   **Body:**
    ```json
    {
      "body": "🤖 [AI Bot] 로그 분석 결과, 504 Timeout이 원인입니다."
    }
    ```

---

## 🧑‍💻 3. 사용자 관리 (User Management)

### 사용자 생성 (Admin Only)
*   **Method:** `POST /users`
*   **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123",
      "username": "new.user",
      "name": "New User",
      "skip_confirmation": true
    }
    ```

### 현재 사용자 정보 확인
*   **Method:** `GET /user` (내 토큰 정보)
*   **Method:** `GET /users?username=dave.kim` (특정 사용자 검색)

---

## 📊 4. 코드 & 활동 내역 (Data for AI)

### 커밋 내역 조회 (Skill Profiling용)
*   **Method:** `GET /projects/:id/repository/commits`
*   **Query Params:** `author=Dave Kim`, `since=2026-01-01`

### 파일 내용 읽기 (코드 리뷰용)
*   **Method:** `GET /projects/:id/repository/files/:file_path/raw`
*   **Query Params:** `ref=main`

---

## 💡 팁 (Tips)
*   **Pagination:** 기본 20개씩 나옵니다. `?per_page=100&page=1`을 습관화하세요.
*   **Sudo:** Admin 토큰을 쓰면 `?sudo=username` 파라미터로 다른 사람 흉내를 낼 수 있습니다. (예: 봇이 Dave 이름으로 글 쓰기)
*   **ID vs IID:**
    *   `id`: 전역 고유 ID (DB Primary Key)
    *   `iid`: 프로젝트 내 번호 (이슈 #1, #2 할 때 그 번호) - API 호출 시 헷갈리지 마세요!
