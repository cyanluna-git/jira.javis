# AI 리스크 자동 감지 시스템

## 개요
로드맵 마일스톤과 Epic의 상태를 분석하여 리스크를 자동 감지하고, AI가 해결 방안을 제안하는 시스템을 구현했습니다.

## 주요 변경사항

### 개발한 것
- **리스크 테이블**: `roadmap_risks`, `roadmap_risk_history` 스키마
- **리스크 분석 API**: 5가지 리스크 유형 자동 감지
- **RiskPanel UI**: 리스크 목록 + AI 제안 표시

### 파일 구조
```
scripts/migrate_roadmap_risks.sql              # DB 스키마
src/javis-viewer/src/types/roadmap.ts          # Risk 타입 추가
src/javis-viewer/src/app/api/roadmap/risks/
└── route.ts                                   # GET/POST/PATCH API
src/javis-viewer/src/components/RiskPanel.tsx  # 리스크 패널
src/javis-viewer/src/app/roadmap/page.tsx      # 패널 통합
```

## 핵심 기능

### 1. 리스크 유형 5가지
| 유형 | 설명 | 감지 조건 |
|------|------|----------|
| `delay` | 일정 지연 | 목표일 초과 |
| `blocker` | 차단 이슈 | 상태가 blocked 또는 Epic 내 차단 이슈 |
| `velocity_drop` | 속도 저하 | 시간진행률 > 실제진행률 + 20% |
| `dependency_block` | 의존성 차단 | 선행 마일스톤 미완료 |
| `resource_conflict` | 리소스 충돌 | (향후 구현) |

### 2. 심각도 자동 판정
```typescript
// 일정 지연 예시
const severity = daysOverdue > 14 ? 'critical'
              : daysOverdue > 7 ? 'high'
              : 'medium';
```

### 3. AI 제안 생성
```json
{
  "risk_type": "velocity_drop",
  "ai_suggestion": "리소스 재배치 또는 작업 우선순위 조정을 검토하세요."
}
```

### 4. 자동 해결
분석 실행 시 더 이상 감지되지 않는 리스크는 자동으로 `resolved` 상태로 변경

## API 사용법

```bash
# 리스크 목록 조회
GET /api/roadmap/risks?status=open

# 분석 실행
POST /api/roadmap/risks
{ "vision_id": "optional-uuid" }

# 상태 변경
PATCH /api/roadmap/risks
{ "id": "risk-uuid", "status": "resolved", "resolution_note": "해결됨" }
```

## 결과
- ✅ 빌드 성공
- ✅ 리스크 API 동작
- ✅ UI 패널 렌더링

## 다음 단계
- [ ] **리스크 알림**: 긴급 리스크 Slack/Email 알림
- [ ] **트렌드 분석**: 리스크 발생 추이 차트
- [ ] **자동 실행**: 매일 정해진 시간에 분석 실행
- [ ] **Content Operations 연동**: AI 제안을 승인 큐로 전달
