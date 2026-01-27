# 프로젝트 로드맵 관리 시스템 (Phase 1)

## 개요
Vision/Milestone/Stream 3계층 구조의 프로젝트 로드맵 관리 시스템 MVP를 구현했습니다. 비전 생성/편집, 마일스톤 관리, Epic 연결 기능을 포함합니다.

## 주요 변경사항

### 개발한 것
- **DB 스키마**: `roadmap_visions`, `roadmap_milestones`, `roadmap_streams`, `roadmap_epic_links` 4개 테이블
- **API 엔드포인트**: 비전/마일스톤/스트림 CRUD + Epic 연결
- **UI 컴포넌트**: VisionCard, MilestoneCard, StreamProgressBar
- **페이지**: `/roadmap` 대시보드, `/roadmap/[visionId]` 상세 페이지

### 파일 구조
```
scripts/migrate_roadmap.sql           # DB 스키마
src/javis-viewer/src/
├── types/roadmap.ts                  # TypeScript 타입
├── app/api/roadmap/
│   ├── visions/route.ts              # 비전 목록/생성
│   ├── visions/[id]/route.ts         # 비전 상세/수정/삭제
│   ├── milestones/route.ts           # 마일스톤 목록/생성
│   ├── milestones/[id]/route.ts      # 마일스톤 상세/수정
│   ├── milestones/[id]/epics/route.ts # Epic 연결
│   └── streams/route.ts              # 스트림 생성
├── components/
│   ├── VisionCard.tsx                # 비전 카드
│   ├── MilestoneCard.tsx             # 마일스톤 카드
│   └── StreamProgressBar.tsx         # 스트림 진행바
└── app/roadmap/
    ├── page.tsx                      # 대시보드
    └── [visionId]/page.tsx           # 비전 상세
```

## 핵심 기능

```typescript
// 3계층 구조
Vision (Why)
  └── Milestone (What)
        └── Stream (How) + Epic Links
```

- **North Star Metric**: 비전별 핵심 지표 및 진행률 시각화
- **분기별 마일스톤**: Quarter 기반 그룹핑
- **리스크 레벨**: low/medium/high/critical 상태 표시

## 결과
- ✅ 빌드 성공
- ✅ 모든 API 라우트 생성 완료
- ✅ TypeScript 타입 완전 정의

## 다음 단계

### Phase 2 (다음 우선)
- [ ] Epic 자동 동기화: `sync_roadmap_epics.py` 스크립트
- [ ] 진행률 자동 계산: Epic 하위 이슈 상태 기반

### Phase 3 (이후)
- [ ] AI 리스크 분석: 일정 지연, 의존성 문제 감지
- [ ] 타임라인 시각화: Gantt 차트 (Recharts BarChart)
- [ ] 스냅샷/히스토리: 로드맵 변경 추적
