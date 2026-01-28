# 양방향 동기화 및 AI 콘텐츠 관리 시스템

## 개요
Jira/Confluence와 로컬 DB 간 양방향 동기화 기능을 구현했습니다. 로컬 수정 추적, 충돌 감지, AI 주도 콘텐츠 작업 큐 시스템을 포함합니다.

## 주요 변경사항

### 개발한 것
- **양방향 동기화 스크립트** (`sync_bidirectional.py`): Pull/Push/충돌 해결
- **작업 큐 실행기** (`execute_operations.py`): AI 작업 승인/실행/롤백
- **이슈 수정 API** (`/api/issues/[key]`): 로컬 수정 추적
- **작업 관리 API** (`/api/operations`): CRUD + 승인/취소/롤백
- **Operations 관리 UI**: 작업 큐 대시보드
- **IssueEditModal**: 이슈 로컬 편집 모달

### 추가한 DB 스키마
- `jira_issues.local_modified_at` - 로컬 수정 시점
- `jira_issues.local_modified_fields` - 수정된 필드 목록
- `sync_logs` - 동기화 이력
- `sync_conflicts` - 충돌 기록
- `content_operations` - AI 작업 큐
- `content_history` - 롤백용 스냅샷

## 핵심 코드

```python
# 충돌 감지 로직
def detect_conflict(local_issue, remote_issue):
    local_fields = local_issue.get('local_modified_fields') or []
    for field in local_fields:
        if local_raw.get(field) != remote_fields.get(field):
            conflicting.append(field)
    return len(conflicting) > 0, conflicting
```

```typescript
// 로컬 수정 API
await client.query(`
  UPDATE jira_issues
  SET local_modified_at = NOW(),
      local_modified_fields = array_cat(
        COALESCE(local_modified_fields, '{}'),
        $1::text[]
      )
  WHERE key = $2
`, [updates, key]);
```

## 결과
- ✅ Next.js 빌드 성공
- ✅ 12개 파일 생성/수정

## 다음 단계
- [ ] Jira API 쓰기 권한 설정 및 Push 테스트
- [ ] Confluence 페이지 병합 기능 구현
- [ ] AI 요약 생성 기능 연동
- [ ] 실시간 충돌 알림 (WebSocket)
- [ ] 작업 큐 스케줄러 추가 (cron)
