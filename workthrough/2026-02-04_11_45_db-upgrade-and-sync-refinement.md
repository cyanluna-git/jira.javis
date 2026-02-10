# DB 버전 업그레이드(PG 17) 및 동기화 스크립트 개선

## 개요
기존 PostgreSQL 16 환경에서 생성된 DB 덤프 파일(버전 1.16)이 복원되지 않는 문제를 해결하기 위해, 로컬 및 원격(VM) DB 버전을 PostgreSQL 17로 업그레이드하고 배포 스크립트를 안정화했다.

## 작업 내용

### 1. DB 버전 업그레이드 (PG 16 → PG 17)
- **배경**: Personal PC에서 생성된 덤프 파일이 `pg_restore` 버전 불일치로 인해 로컬/원격 환경에서 복원 실패.
- **로컬 변경**: `config/javis-db-compose.yml`의 이미지를 `pgvector/pgvector:pg17`로 변경.
- **원격(VM) 업그레이드**:
    - VM의 아웃바운드 차단으로 인한 `docker pull` 불가 문제 해결.
    - 로컬에서 `pgvector:pg17` 이미지를 `docker save`로 추출하여 전송 후 `docker load` 수행.
    - 원격 `docker-compose.yml` 수정 및 컨테이너 재구성.

### 2. `scripts/deploy_to_vm.ps1` 개선
- **Docker 기반 복원**: 원격 서버의 호스트가 아닌 `javis-db` 컨테이너 내부에서 `pg_restore`가 실행되도록 로직 변경.
- **실행 안정성**: PowerShell에서 SSH를 통해 복잡한 쉘 명령을 직접 전달할 때 발생하는 문법 오류(이스케이프 문제 등)를 해결하기 위해, 임시 쉘 스크립트(`.sh`)를 생성하여 전송/실행하는 방식으로 리팩토링.
- **연결 관리**: 복원 전 기존 DB 연결을 강제 종료(`pg_terminate_backend`)하는 로직 추가.

### 3. 동기화 확인
- 로컬 DB 복원 완료 (이슈 2,842개).
- Azure VM DB 복원 완료 (성공 로그 확인).

## 향후 과제
- DB 버전이 17로 고정됨에 따라, 향후 모든 환경(Personal, Company, VM)의 이미지를 동일하게 유지 관리 필요.
