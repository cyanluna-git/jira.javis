# Epic 동기화 및 AI 기반 Epic 제안

## 개요
Milestone에 Epic을 연결할 때 AI가 관련 Epic을 자동 추천하고, 연결된 Epic의 하위 이슈로 진행률을 자동 계산하는 기능을 구현했습니다.

## 주요 변경사항

### 개발한 것
- **Epic 동기화 API**: Jira API로 Epic 하위 이슈 조회 및 진행률 계산
- **Epic 검색 API**: DB에서 Epic 검색 + 텍스트 유사도 매칭
- **Epic 제안 UI**: 자동완성 드롭다운 + 유사도 배지
- **Python 스크립트**: CLI에서 Epic 동기화 실행

### 파일 구조
```
scripts/sync_roadmap_epics.py           # CLI 동기화 스크립트
src/javis-viewer/src/app/api/roadmap/
├── sync/route.ts                       # POST: Epic 진행률 동기화
└── epics/route.ts                      # GET: Epic 검색/제안
src/javis-viewer/src/components/
└── MilestoneCard.tsx                   # Epic 추가 UI 개선
```

## 핵심 기능

### 1. Epic 검색 + AI 유사도
```typescript
GET /api/roadmap/epics?search=EUV&vision_text=자동화

// Response
[
  { key: "EUV-2983", summary: "Gateway 자동화", similarity: 0.85 },
  { key: "EUV-1375", summary: "Backup Controller", similarity: 0.12 }
]
```

### 2. 진행률 자동 계산
```
Epic EUV-2983
├── Story Done (100%)
├── Story In Progress (50%)
└── Task Todo (0%)

진행률 = (1×100 + 1×50 + 1×0) / 3 = 50%
```

### 3. UI 자동완성
- `EUV-` 입력 시 관련 Epic 드롭다운 표시
- 유사도 높은 Epic에 "XX% 일치" 배지

## 결과
- ✅ 빌드 성공
- ✅ Epic 검색 API 동작
- ✅ 유사도 기반 정렬

## 다음 단계
- [ ] **리스크 자동 감지**: 일정 지연, 병목 이슈 자동 판별
- [ ] **North Star 기여도**: Epic별 목표 기여 분석
- [ ] **진행률 예측**: 완료 예상일 계산
