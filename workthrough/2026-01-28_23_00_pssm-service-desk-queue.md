# PSSM Service Desk Queue 페이지 구현

## 개요
PSSM 프로젝트의 서비스 티켓을 사업부(Integrated Systems / Abatement)별로 분류하여 관리하는 Service Desk Queue 페이지를 구현했습니다. 티켓 필터링, 통계 차트, 페이지네이션, 상세보기(본문/댓글) 기능을 포함합니다.

## 주요 변경사항

### 개발한 것
- **Service Desk 페이지**: 사업부별 탭, 통계 카드, Status/Component 차트
- **API 엔드포인트**: `/api/service-desk` - 페이지네이션, 필터링, 탭 카운트 한번에 조회
- **공유 비즈니스 로직**: `lib/service-desk.ts` - DB 집계, 상태 정의 중앙화
- **티켓 상세보기**: Description, Comments 표시 (ADF 파싱), Jira 링크

### 수정한 것
- 홈페이지에 Service Desk 카드 추가
- 한 달 이상 된 완료/종료 티켓 자동 숨김 (Done, Closed, Completed, Not Required)

### 개선한 것 (코드 리뷰 반영)
- 초기 로드 API 호출 4회 → 1회로 최적화
- 검색 디바운스 (300ms) 추가
- hover 기반 드롭다운 → state 기반 (접근성 개선)
- 에러 상태 표시 및 Retry 버튼
- 대소문자 무관 색상 매핑 (`getStatusColor`, `getPriorityColor`)

## 핵심 코드

```typescript
// 한 달 이상 된 완료 티켓 숨김 조건
const HIDE_OLD_TICKETS_CONDITION = `
  NOT (
    UPPER(status) IN ('DONE', 'CLOSED', 'COMPLETED', 'NOT REQUIRED')
    AND COALESCE(
      (raw_data->'fields'->>'resolutiondate')::timestamp,
      updated_at
    ) < NOW() - INTERVAL '1 month'
  )
`;

// ADF 파싱으로 본문/댓글 텍스트 변환
const description = adfToText(row.description);
const comments = rawComments.map(c => ({
  body: adfToText(c.body),
  ...
}));
```

## 파일 구조
```
src/javis-viewer/src/
├── types/service-desk.ts          # 타입 정의, 색상 헬퍼
├── lib/service-desk.ts            # DB 쿼리, 비즈니스 로직
├── app/api/service-desk/route.ts  # API 엔드포인트
├── app/service-desk/
│   ├── page.tsx                   # 서버 컴포넌트
│   └── ServiceDeskContent.tsx     # 클라이언트 컴포넌트
└── components/ServiceDeskTicketRow.tsx  # 티켓 행 (확장 가능)
```

## 결과
- ✅ 빌드 성공
- ✅ Lint 통과
- ✅ 사업부별 필터링 동작
- ✅ 페이지네이션 동작
- ✅ 본문/댓글 ADF 파싱 완료

## 다음 단계
- 티켓 정렬 기능 (Created, Updated, Priority 등)
- 담당자 워크로드 차트 추가
- 티켓 상태 변경 기능 (Jira API 연동)
- SLA 위반 티켓 하이라이트
- 실시간 알림 (WebSocket)
