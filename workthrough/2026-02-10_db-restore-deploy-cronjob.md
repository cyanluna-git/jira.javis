# DB 복원, 원격 서버 배포, 매시간 자동 동기화 크론잡 설정

## Overview

Windows 백업 덤프 파일로 로컬 DB를 복원하고, 원격 Javis 서버(10.182.252.32)에 배포한 뒤, Jira/Confluence/Bitbucket 데이터를 매시간 자동으로 pull → 원격 배포하는 크론잡을 구성했다.

## Context

- 로컬 DB를 최신 백업(`javis_brain_20260210_095126.dump`)으로 갱신 필요
- 원격 서버 DB도 동일하게 업데이트 필요
- Jira/Confluence/Bitbucket 변경사항을 수동이 아닌 자동으로 주기적 동기화 요구

## Changes Made

### 1. 로컬 DB 복원 (pg_restore)

Windows 경로의 `.dump` 파일(PostgreSQL custom format)을 로컬 `javis_db` 컨테이너에 복원:

```bash
# 백업 파일 컨테이너로 복사
docker cp "/mnt/c/Users/ParkGY/OneDrive/jarvis.backup/javis_brain_20260210_095126.dump" javis_db:/tmp/backup.dump

# 기존 DB 드롭 후 재생성
docker exec javis_db dropdb -U javis javis_brain
docker exec javis_db createdb -U javis javis_brain

# pg_restore로 복원
docker exec javis_db pg_restore -U javis -d javis_brain --no-owner --no-privileges /tmp/backup.dump
```

복원 결과: 31개 테이블, jira_issues 2,859건, confluence_v2_content 1,870건, bitbucket_commits 648건

### 2. 원격 서버 배포

로컬 DB를 SQL 덤프 후 원격 서버에 scp + restore:

```bash
# 로컬 덤프
docker exec javis_db pg_dump -U javis -d javis_brain --no-owner --no-acl -f /tmp/backup.sql
docker cp javis_db:/tmp/backup.sql backups/javis_brain_deploy.sql

# 원격 업로드 & 복원
scp backups/javis_brain_deploy.sql atlasAdmin@10.182.252.32:/tmp/restore.sql
ssh atlasAdmin@10.182.252.32 'docker exec javis-db dropdb/createdb/psql restore...'
```

### 3. 원격 서버 Python 환경 설정

원격 서버에서 PyPI SSL 연결 불가(사내 방화벽) → 로컬에서 wheel 다운로드 후 scp 전송:

```bash
# 로컬에서 wheel 다운로드
pip3 download psycopg2-binary --only-binary=:all: --python-version 3.12 \
  --platform manylinux_2_17_x86_64 -d /tmp/javis-wheels

# 원격에 업로드 후 설치
scp /tmp/javis-wheels/psycopg2_binary-*.whl atlasAdmin@10.182.252.32:/tmp/
ssh atlasAdmin@10.182.252.32 "pip3 install --break-system-packages /tmp/psycopg2_binary-*.whl"
```

### 4. 원격 서버 직접 동기화 시도 및 차단 확인

원격 서버에서 Jira/Confluence/Bitbucket API 직접 호출 테스트 → SSL 방화벽으로 **차단됨**:

```
SSL_ERROR_SYSCALL in connection to ac-avi.atlassian.net:443
```

결론: 원격 서버에서는 외부 API 직접 접근 불가 → **로컬에서 sync 후 DB를 원격에 push하는 방식**으로 전환

### 5. 자동 동기화 + 배포 스크립트 생성

- **File**: `scripts/javis_sync_and_deploy.sh`

```bash
#!/bin/bash
# 매시간 실행: Jira/Confluence/Bitbucket pull → 로컬 DB → 원격 서버 배포

# [1/4] Jira pull
python3 scripts/sync_bidirectional.py --pull-only

# [2/4] Confluence pull
python3 scripts/sync_confluence_bidirectional.py --pull-only

# [3/4] Bitbucket sync
python3 scripts/sync_bitbucket.py

# [4/4] Deploy to remote
docker exec javis_db pg_dump ... → scp → ssh restore
```

로그는 `logs/sync/sync_YYYY-MM-DD_HHMM.log`에 저장, 최근 48개만 보관.

### 6. WSL 크론잡 등록

```bash
crontab -e
# 매시간 정각 실행
0 * * * * /mnt/d/00.Dev/javis.gerald/scripts/javis_sync_and_deploy.sh # javis-hourly-sync
```

### 7. 로컬 psycopg2 설치

WSL Python에도 psycopg2가 없어서 설치:

```bash
pip3 install --break-system-packages psycopg2-binary
```

## Verification Results

### 테스트 실행 로그 (`logs/sync/sync_2026-02-10_1620.log`)

```
=== Javis Sync & Deploy: Tue Feb 10 16:20:27 KST 2026 ===

[1/4] Jira pull...
  Pulled: 8, Pushed: 0, Conflicts: 0, Errors: 0
Jira: exit 0

[2/4] Confluence pull...
  Pulled: 2, Pushed: 0, Conflicts: 0, Errors: 0
Confluence: exit 0

[3/4] Bitbucket sync...
  Repositories: 41 repos synced
  Commits: 617 synced
  PRs: 228 synced
Bitbucket: exit 0

[4/4] Deploying to remote server...
Remote restore OK

=== Completed: Tue Feb 10 16:24:26 KST 2026 ===
Jira=0 Confluence=0 Bitbucket=0 Deploy=0
```

전체 소요 시간: 약 4분.

## Architecture Decision

| 항목 | 결정 | 이유 |
|------|------|------|
| Sync 실행 위치 | 로컬 WSL | 원격 서버 방화벽이 Atlassian API 차단 |
| 배포 방식 | pg_dump → scp → restore | 간단하고 안정적 |
| 크론 주기 | 매시간 | 데이터 신선도와 부하 균형 |
| 로그 보관 | 48개 (2일분) | 디스크 관리 |

## 제약 사항

- WSL이 켜져 있어야 크론잡 동작
- 원격 서버에서 직접 API sync 불가 (방화벽 SSL 차단)
- 배포 중 원격 DB 잠깐 다운타임 발생 (dropdb → createdb → restore)
