# 팀 멤버 스탯 관리 시스템 구현

## 개요
팀 멤버별 스탯/레이팅을 관리하는 시스템을 구현했습니다. Jira 이슈 데이터를 기반으로 자동 가산점 계산, 팀장 수동 평가, 스탯 변경 이력 추적 기능을 포함합니다. 67명의 멤버 데이터가 마이그레이션되었고 초기 스탯이 계산되었습니다.

## 주요 변경사항

### 데이터베이스 스키마 (4개 테이블 + 2개 뷰)
- `team_members`: 멤버 기본 정보 (account_id, role, team, skills)
- `member_stats`: 누적/기간별 스탯 (스토리 완료, 포인트, 레이팅)
- `member_stat_history`: 스탯 변경 이력 추적
- `manager_evaluations`: 팀장 정기 평가 (1-5 스케일)
- `member_ranking`, `member_period_stats`: 집계용 뷰

### Python 동기화 스크립트
- `sync_member_stats.py`: 스토리 완료 시 자동 가산점 계산
- 이슈 타입별 가중치 (Bug 1.2x, Story 1.0x, Task 0.8x)
- 기한 준수 보너스/패널티 (+3/-1)

### API 엔드포인트 (5개)
- `GET/POST /api/members`: 멤버 목록/생성
- `GET/PATCH/DELETE /api/members/[id]`: 멤버 상세/수정/비활성화
- `GET/PATCH /api/members/[id]/stats`: 스탯 조회/수동 조정
- `GET/POST /api/members/[id]/evaluate`: 평가 조회/생성
- `GET /api/members/[id]/history`: 변경 이력 조회

### UI (2개 페이지 + 2개 컴포넌트)
- `MemberStatCard`: 스탯 카드 (랭킹 배지, 레벨, 스킬 표시)
- `EvaluationModal`: 5점 스케일 별점 평가, 스탯 조정
- `/members`: 랭킹/필터 대시보드 (67명 멤버 표시)
- `/members/[id]`: 상세 페이지 (스탯 바, 히스토리, 평가 탭)

## 초기 데이터 결과

| 순위 | 이름 | 완료 스토리 | 점수 | 레벨 |
|------|------|------------|------|------|
| 1 | Rachel Bae | 234 | 111.60 | Lv.10 |
| 2 | Amelia An | 130 | 74.00 | Lv.10 |
| 3 | Ethan Jung | 213 | 34.40 | Lv.10 |
| 4 | Ashley Yun | 103 | 25.90 | Lv.10 |
| 5 | Michal | 40 | 19.00 | Lv.7 |

## 결과
- ✅ 마이그레이션 완료 (67명 멤버)
- ✅ 빌드 성공 (`npm run build`)
- ✅ PostgreSQL NUMERIC→문자열 변환 버그 수정

## 다음 단계
- [ ] `sync_bidirectional.py`와 연동하여 실시간 스탯 갱신
- [ ] 멤버 스킬 기반 업무 추천 알고리즘 (AI 연동)
- [ ] 스프린트별 리더보드 차트 추가
- [ ] 평가자 인증 시스템 연동
- [ ] Story Points 필드 매핑 확인 (현재 0으로 표시)
