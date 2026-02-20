# Confluence 페이지 모달 추가

## 개요
Bundle Board에서 Confluence 문서를 클릭하면 모달로 내용을 볼 수 있는 기능 추가. 기존 외부 링크 버튼은 유지.

## 주요 변경사항
- **추가한 것**: ConfluencePageModal 컴포넌트 - Confluence 페이지 내용을 모달로 표시
- **개선한 것**: BundleRow의 문서 목록을 클릭 가능하게 변경
- **개선한 것**: 접근성 개선 (role, aria-label, Escape 키 지원)

## 핵심 코드

### ConfluencePageModal 컴포넌트
```typescript
// 모달 구성 요소
- Breadcrumbs: 페이지 계층 구조 표시
- 제목 + "Confluence에서 열기" 버튼
- Labels: 페이지 라벨 태그로 표시
- ConfluenceRenderer: 본문 내용 렌더링
- Footer: 생성일/수정일 메타데이터

// 접근성 기능
role="dialog"
aria-modal="true"
aria-labelledby="confluence-modal-title"
Escape 키로 닫기
```

### BundleRow 문서 클릭 처리
```typescript
const handleDocumentClick = async (docId: string, docUrl: string, e: React.MouseEvent) => {
  setLoadingPageId(docId);
  try {
    const res = await fetch(`/api/confluence/page/${docId}`);
    const data = await res.json();
    setSelectedPage(data.page);
    setPageBreadcrumbs(data.breadcrumbs || []);
  } catch (error) {
    // 실패 시 외부 링크로 fallback
    window.open(docUrl, '_blank', 'noopener,noreferrer');
  }
};
```

## 결과
- 문서 클릭 시 모달로 Confluence 페이지 내용 표시
- 외부 링크 아이콘 클릭 시 Confluence에서 직접 열기
- 로딩 실패 시 자동으로 외부 링크로 이동

## 다음 단계
- 모달 내 페이지 링크 클릭 시 같은 모달에서 해당 페이지 열기 기능
- 모달 키보드 포커스 트랩 추가 (완전한 접근성)
