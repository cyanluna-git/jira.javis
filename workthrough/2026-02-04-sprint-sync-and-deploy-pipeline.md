# Sprint Sync 스크립트 구현 + DB 배포 파이프라인 자동화

## Overview

Jira 스프린트 메타데이터와 이슈 매핑을 동기화하는 `sync_sprints.py` 스크립트를 구현하고, Personal PC → OneDrive → Company PC → Azure VM 으로 이어지는 DB 배포 파이프라인을 자동화했다.

## Context

- 기존에 `mirror_jira_sprints.py`를 참조하던 CLI가 실제 스크립트가 없어 동작하지 않았음
- Personal PC ↔ Company PC 간 DB 동기화가 수동 클라우드 파일 복사로 이루어져 번거로웠음
- Azure VM은 outbound 차단 상태로, Company PC에서 SCP push만 가능한 환경

## Changes Made

### 1. `scripts/sync_sprints.py` (신규)
- `sync_boards.py`와 동일한 패턴 (config, API request with retry, DB connection)
- DB의 `jira_boards` 테이블에서 보드 목록 조회
- 보드별 `GET /rest/agile/1.0/board/{boardId}/sprint` 호출하여 스프린트 fetch
- `jira_sprints` 테이블에 upsert (confluence_labels 필드 보존)
- active/closed 스프린트의 이슈를 `GET /rest/agile/1.0/sprint/{sprintId}/issue`로 조회
- `jira_issue_sprints` 매핑 테이블 populate (로컬 DB에 존재하는 이슈만)
- CLI 옵션: `--project`, `--active-only`, `--force`, `--list`

### 2. `scripts/cli/sync.py` (수정)
- `SYNC_SCRIPTS['sprints']`: `mirror_jira_sprints.py` → `sync_sprints.py` 변경
- `show_sync_status()`의 `synced_at` → `last_synced_at` 컬럼명 수정

### 3. `scripts/deploy_upload.sh` (신규)
- Personal PC(Mac)에서 실행하는 배포 업로드 스크립트
- 3단계: Jira sync → pg_dump → OneDrive 폴더에 복사
- 타임스탬프 백업 유지 (최근 5개), `latest.json` 메타데이터 생성
- 옵션: `--dump-only`, `--sync-only`

### 4. `scripts/deploy_to_vm.ps1` (신규)
- Company PC(Windows)에서 실행하는 VM 배포 스크립트
- OneDrive 동기화 폴더에서 dump 파일 확인 → SCP → SSH pg_restore
- 파라미터: `-VMHost`, `-VMUser`, `-RestoreOnly`

### 5. `/javis-sync` 스킬 업데이트
- `skill.md`: sprints 명령어 추가, description 업데이트
- `reference.md`: Sprints 동기화 섹션 추가, DB 테이블 매핑 수정
- `examples.md`: 아침/주간 워크플로우에 sprint 단계 추가

## 실행 결과

### Sprint Sync
```
SYNC COMPLETE: 116 sprints (중복 제거 후 50개 unique), 2378 issue mappings
- 7개 보드 스캔 (Kanban 3개는 스프린트 미지원으로 스킵)
- Active: Scaled Sprint15 (32 issues)
- Future: Scaled Sprint16, Sprint17, OQC Sprint01, OQC Sprint2
```

### Deploy Upload
```
[1/3] Sync skipped (--dump-only)
[2/3] Creating DB dump... 12M
[3/3] Uploading to OneDrive... Done
```

OneDrive 폴더에 `javis_brain.dump` (12MB) + 타임스탬프 백업 + `latest.json` 생성 확인.

## 배포 파이프라인

```
Personal PC (Mac)                  OneDrive Cloud              Company PC (Win)              Azure VM
      |                                 |                            |                          |
  deploy_upload.sh                      |                            |                          |
  ├─ sync (Jira API)                    |                            |                          |
  ├─ pg_dump                            |                            |                          |
  └─ cp → OneDrive folder ──────> auto sync ──────> OneDrive folder |                          |
                                        |                     deploy_to_vm.ps1                  |
                                        |                     ├─ scp ─────────────────────────> |
                                        |                     └─ ssh pg_restore ──────────────> |
```

---

## Company PC (Windows) 작업 가이드

> 이 섹션은 Company PC에서 Gemini 또는 다른 AI 에이전트가 이어서 작업할 때 참조하는 introduction입니다.

### 환경

- **OS**: Windows (PowerShell 사용)
- **역할**: OneDrive에서 자동 동기화된 DB dump 파일을 Azure VM에 배포하는 브릿지
- **필요 도구**: `scp`, `ssh` (OpenSSH 클라이언트), PowerShell 5.1+

### 사전 준비

1. **OneDrive 동기화 확인**
   - Personal PC에서 `deploy_upload.sh` 실행 후, OneDrive가 동기화를 완료할 때까지 대기
   - 확인 경로: `%USERPROFILE%\OneDrive\jarvis.backup\javis_brain.dump`
   - `latest.json`의 timestamp로 최신 여부 확인 가능

2. **VM 접속 정보 설정**
   - `deploy_to_vm.ps1` 파일을 열고 기본값 수정:
     ```powershell
     $VMHost = "실제_VM_IP"
     $VMUser = "실제_VM_사용자"
     ```
   - 또는 실행 시 파라미터로 전달

3. **SSH 키 인증 확인**
   - Company PC → Azure VM 간 SSH key 기반 인증이 설정되어 있어야 함
   - 패스워드 인증도 동작하지만 자동화에 불편

### 실행

```powershell
# 프로젝트 루트로 이동
cd C:\path\to\jira.javis

# VM IP와 사용자 지정하여 실행
.\scripts\deploy_to_vm.ps1 -VMHost 10.0.0.4 -VMUser javis
```

### 스크립트 동작

| 단계 | 내용 |
|------|------|
| [1/3] | OneDrive 폴더에서 dump 파일 존재/크기/날짜 확인 |
| [2/3] | `scp`로 dump 파일을 Azure VM의 `/tmp/`에 전송 |
| [3/3] | `ssh`로 VM에 접속하여 `pg_restore --clean --if-exists` 실행 |

### 주의사항

- `pg_restore`의 `--clean` 옵션은 기존 테이블을 drop 후 재생성함 (전체 교체)
- restore 시 일부 warning이 발생할 수 있으나 (sequence owner 등), 데이터에는 영향 없음
- VM에서 restore 완료 후 `/tmp/javis_brain.dump`는 자동 삭제됨

### 트러블슈팅

| 문제 | 해결 |
|------|------|
| dump 파일 없음 | Personal PC에서 `deploy_upload.sh` 재실행 후 OneDrive 동기화 대기 |
| SCP 연결 실패 | VPN 연결 확인, VM IP/포트 확인 |
| pg_restore 오류 | VM에서 PostgreSQL 서비스 상태 확인: `sudo systemctl status postgresql` |
| OneDrive 미동기화 | OneDrive 앱 상태 확인, 수동 동기화 트리거 |
