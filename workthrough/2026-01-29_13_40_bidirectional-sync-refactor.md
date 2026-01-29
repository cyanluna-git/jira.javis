# 양방향 동기화 리팩토링

## 개요
위험한 전체 스캔(full scan) 단방향 동기화 스크립트를 제거하고, 안전한 증분(diff) 양방향 동기화로 전환.

## 주요 변경사항

### 삭제된 스크립트 (전체 스캔 - 위험)
- `mirror_jira.py` - Jira 전체 스캔 → DB 덮어쓰기
- `mirror_jira_sprints.py` - Sprint 전체 스캔
- `mirror_confluence_v2.py` - Confluence 전체 스캔
- `mirror_confluence_cloud.py` - Confluence Cloud 전체 스캔
- `sync_jira.py` - 레거시 SQLite 전체 스캔

### 유지/신규 스크립트 (증분 양방향 - 안전)
- `sync_bidirectional.py` - Jira ↔ DB 양방향 증분 동기화
- `sync_confluence_bidirectional.py` - Confluence ↔ DB 양방향 증분 동기화 (신규)

## 핵심 구현

### 증분 동기화 메커니즘
```
[PULL] Jira → DB
  1. SELECT MAX(last_synced_at) FROM jira_issues
  2. JQL: "updated >= '{last_sync}'" → 변경분만 조회
  3. 충돌 감지 후 UPSERT

[PUSH] DB → Jira
  1. SELECT * WHERE local_modified_at > last_synced_at
  2. PUT /rest/api/3/issue/{key} → Jira 업데이트
  3. 성공 시 local_modified_at = NULL
```

### PostgreSQL 트리거 (자동 변경 추적)
```sql
CREATE TRIGGER trg_track_jira_changes
    BEFORE UPDATE ON jira_issues
    FOR EACH ROW
    EXECUTE FUNCTION track_jira_issue_changes();
```
- API 또는 직접 DB 수정 시 자동으로 `local_modified_at`, `local_modified_fields` 기록
- `last_synced_at`이 함께 변경되면 싱크 작업으로 인식하여 무시

### 충돌 관리 테이블
- `sync_conflicts` - Jira 충돌 저장
- `sync_logs` - Jira 싱크 로그
- `confluence_sync_conflicts` - Confluence 충돌 저장
- `confluence_sync_logs` - Confluence 싱크 로그

## API 수정
`PATCH /api/issues/[key]`에서 `last_synced_at = NOW()` 제거
→ 트리거가 로컬 수정으로 인식하여 자동 추적

## 사용법

```bash
# Jira 양방향 싱크
python3 scripts/sync_bidirectional.py
python3 scripts/sync_bidirectional.py --dry-run      # 시뮬레이션
python3 scripts/sync_bidirectional.py --force-local  # 충돌 시 로컬 우선

# Confluence 양방향 싱크
python3 scripts/sync_confluence_bidirectional.py
python3 scripts/sync_confluence_bidirectional.py --show-conflicts  # 충돌 확인
```

## 결과
- 전체 스캔으로 인한 데이터 손실 위험 제거
- 변경분만 동기화하여 API 호출 최소화
- 충돌 발생 시 수동 해결 가능
- 모든 로컬 수정이 자동 추적됨

## 다음 단계
- Confluence 양방향 싱크 테스트 및 검증
- 정기 싱크 스케줄링 (cron) 설정
- 충돌 해결 UI 구현 고려
