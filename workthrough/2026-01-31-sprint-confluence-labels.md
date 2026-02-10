# Sprint Confluence 페이지 자동 라벨링 및 UI 개선

## 개요
Sprint-Tumalo 하위의 모든 스프린트 폴더 페이지에 자동으로 라벨을 붙여 스프린트 페이지에서 관련 Confluence 문서를 쉽게 조회할 수 있도록 했습니다. 또한 Vision 편집 모달의 컴포넌트 입력 방식과 ConfluenceRenderer의 HTML 유효성 문제도 수정했습니다.

## 변경 사항

### 1. Vision 편집 모달 - 컴포넌트 입력 방식 변경
**파일**: `src/javis-viewer/src/components/VisionEditModal.tsx`

기존 드롭다운 선택 방식에서 라벨과 동일한 자유 입력 방식으로 변경:
- 하드코딩된 `COMMON_COMPONENTS` 배열 제거
- 텍스트 입력 + 추가 버튼 방식으로 변경
- 설정된 컴포넌트는 파란색 태그로 표시
- X 버튼으로 삭제 가능, Enter 키로 추가 가능

```tsx
// 새로운 컴포넌트 입력 UI
<div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
  {formData.default_component ? (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
      {formData.default_component}
      <button type="button" onClick={handleRemoveComponent}>
        <X className="w-3 h-3" />
      </button>
    </span>
  ) : (
    <span className="text-sm text-gray-400 italic">No default component</span>
  )}
</div>
```

### 2. Sprint Confluence 페이지 자동 라벨링 스크립트
**파일**: `scripts/label_sprint_pages.py`

Sprint-Tumalo 하위 폴더의 모든 페이지에 스프린트 라벨을 자동으로 부여:

| 폴더 패턴 | 생성 라벨 |
|-----------|-----------|
| `[Scaled-Sprint08]...` | `scaled-sprint08` |
| `[Scaled-sprint14]...` | `scaled-sprint14` |
| `[Sprint27]...` | `sprint27` |
| `[Sprint33]...` | `sprint33` |

```python
def extract_sprint_label(folder_title: str) -> str:
    # [Scaled-SprintXX] → scaled-sprintXX
    match = re.search(r'\[Scaled-[Ss]print\s*(\d+)\]', folder_title)
    if match:
        return f"scaled-sprint{match.group(1)}"

    # [SprintXX] → sprintXX (no 'scaled-' prefix)
    match = re.search(r'\[[Ss]print\s*(\d+)\]', folder_title)
    if match:
        return f"sprint{match.group(1)}"
    return None
```

**실행 결과**:
- 총 118개 페이지에 라벨 적용
- Scaled-Sprint 08~14: `scaled-sprint08` ~ `scaled-sprint14`
- Sprint 27~33: `sprint27` ~ `sprint33`

### 3. ConfluenceRenderer HTML Hydration 오류 수정
**파일**: `src/javis-viewer/src/components/ConfluenceRenderer.tsx`

`<p>` 태그 안에 블록 요소(`<div>`, `<pre>` 등)가 중첩되어 발생하는 hydration 오류 수정:

```tsx
case 'p': {
  // Check if paragraph contains block elements
  const hasBlockChild = Array.from(element.children).some(child => {
    const tag = child.tagName.toLowerCase();
    return ['div', 'pre', 'table', 'ul', 'ol', 'blockquote', 'figure',
            'form', 'section', 'article', 'header', 'footer', 'nav', 'aside'].includes(tag)
      || tag.startsWith('ac:');  // Confluence macros often render as blocks
  });

  if (hasBlockChild) {
    return (
      <div className="mb-3 leading-relaxed">
        {renderChildren(element)}
      </div>
    );
  }

  return (
    <p className="mb-3 leading-relaxed">
      {renderChildren(element)}
    </p>
  );
}
```

## 사용 방법

### 스크립트 실행
```bash
# Preview - 어떤 라벨이 붙을지 확인
python3 scripts/label_sprint_pages.py --preview

# Apply - 실제로 Confluence에 라벨 적용
python3 scripts/label_sprint_pages.py --apply
```

## 검증 결과

### 라벨링 결과
```
=== Apply Labels ===
Total pages: 118
Labeled: 118
Skipped (already had label): 0
```

### Hydration 오류 해결
- `<p>` cannot contain `<pre>` 오류 해결
- `<p>` cannot contain `<div>` 오류 해결

## 향후 개선 사항
- 새로운 스프린트 폴더 생성 시 자동 라벨링 hook 추가 고려
- 라벨 네이밍 규칙 통일 (scaled-sprint vs sprint 구분)
