# Confluence 문서 관리 & AI 리팩토링 시스템

## 개요
Confluence 문서의 계층적 트리 뷰, 폴더 동기화, 고아 페이지 복구, AI 기반 문서 리팩토링 제안, 자동 라벨링, 그리고 Confluence Write-back 기능을 구현한 전체 시스템입니다.

## 주요 변경사항

### 1. DB 스키마 확장 (`migrate_confluence_tree.sql`)
- `confluence_v2_content`: `materialized_path`, `depth`, `child_count`, `is_orphan`, `orphan_reason`, `sort_order` 컬럼 추가
- `confluence_ai_suggestions`: AI 제안 저장 테이블 (merge, update, restructure, label, archive)
- `confluence_label_taxonomy`: 라벨 분류 체계 (doc-type, product, status, team)
- `confluence_page_similarity`: 유사도 캐시 테이블
- `get_confluence_tree_stats()`: 트리 통계 함수

### 2. Python 스크립트
| 스크립트 | 설명 |
|---------|------|
| `compute_confluence_paths.py` | BFS로 트리 경로/깊이 계산, 고아 페이지 탐지 |
| `mirror_confluence_v2.py` | Confluence V2 API로 페이지/폴더 동기화 |
| `analyze_confluence_ai.py` | 중복/노후화/구조 분석 AI 파이프라인 |
| `auto_label_confluence.py` | 패턴 매칭 + AI 기반 자동 라벨링 |
| `lib/confluence_write.py` | Confluence API 쓰기 래퍼 (update, move, label, archive, merge) |

### 3. Frontend (Next.js)
- `ConfluenceTree.tsx`: 확장/축소 가능한 트리 컴포넌트, 폴더/페이지 아이콘 구분
- `ConfluenceSuggestionPanel.tsx`: AI 제안 승인/거절 패널
- `/api/confluence/tree`: 재귀 CTE로 트리 조회 API (lazy loading 지원)
- `/api/confluence/page/[id]`: 페이지 + 브레드크럼 API
- `/api/confluence/suggestions`: AI 제안 CRUD API

### 4. Operation Handlers 추가 (`execute_operations.py`)
- `ConfluenceUpdateHandler`: 페이지 업데이트
- `ConfluenceMoveHandler`: 페이지 이동
- `ConfluenceLabelHandler`: 라벨 추가/제거
- `ConfluenceArchiveHandler`: 페이지 아카이브

---

## 폴더 동기화 & 고아 페이지 복구

### 문제점
기존 동기화에서 **폴더(Folder)**가 누락되어 대부분의 페이지가 고아로 표시됨.

### 해결 과정

| 단계 | 고아 페이지 | 총 항목 | 폴더 수 |
|------|------------|--------|--------|
| 1. 초기 상태 | 1,681 (98.5%) | 1,707 | 0 |
| 2. 고아 상속 로직 수정 | 397 (23.3%) | 1,707 | 0 |
| 3. 루트 폴더 동기화 | 311 (17.9%) | 1,739 | 28 |
| 4. **전체 재귀 탐색** | **2 (0.1%)** | **1,794** | **83** |

### 핵심 수정사항

#### 1. 고아 상속 로직 제거 (`compute_confluence_paths.py`)
```python
# Before: 자식이 부모의 고아 상태를 상속 (잘못됨)
queue.append((child, current_path, depth + 1, is_orphan, orphan_reason))

# After: 자식은 유효한 부모가 있으므로 고아가 아님
queue.append((child, current_path, depth + 1, False, None))
```

#### 2. 폴더 동기화를 위한 API 엔드포인트
- Confluence V2 API에는 `/spaces/{id}/folders` 없음
- **`/pages/{id}/direct-children`** 사용: 페이지 하위의 폴더 포함
- **`/folders/{id}/direct-children`** 사용: 폴더 하위의 중첩 폴더
- **`/folders/{id}`** 사용: 폴더 상세 정보

#### 3. 재귀 폴더 탐색 로직
```python
# 모든 페이지/폴더를 순회하며 하위 폴더 탐색
queue = list(all_items.keys())
while queue:
    item_id = queue.pop(0)
    endpoint = f"/api/v2/{item_type}s/{item_id}/direct-children"
    for child in data['results']:
        if child.get('type') == 'folder' and child_id not in all_items:
            folder_data = api_get(f"/api/v2/folders/{child_id}")
            save_folder(cur, folder_data)
            queue.append(child_id)  # 중첩 폴더 탐색
```

### 최종 결과
- 총 **83개 폴더** 동기화
- 고아 페이지 **1,681개 → 2개** (99.9% 복구)
- 트리 최대 깊이: **9 레벨**
- 평균 깊이: **5.4 레벨**

### 트리 구조 예시
```
EUV Knowledge Hub
  ├── CommonControl Knowledge (folder, 14)
  ├── EUV Zenith (folder, 3)
  │   ├── EUV Gen4 Tumalo Software Development (page)
  │   │   ├── Technical Deliverables (folder)
  │   │   │   └── Phase2 (folder)
  │   │   │       ├── TR2 (folder)
  │   │   │       └── TR3 (folder)
  │   │   │           └── FABWORKS - Parameter Definition-TR3 (page)
  │   │   └── SW Bundle Release (folder)
  │   └── ...
  ├── Abatement (folder, 5)
  ├── Havasu (folder, 9)
  └── OQC Digitalization (folder, 12)
```

---

## 생성된 파일

### 필수 파일 (유지)
```
scripts/
├── compute_confluence_paths.py    # 트리 경로 계산
├── mirror_confluence_v2.py        # 페이지/폴더 동기화 (수정됨)
├── analyze_confluence_ai.py       # AI 분석 파이프라인
├── auto_label_confluence.py       # 자동 라벨링
├── migrate_confluence_tree.sql    # DB 마이그레이션
└── lib/
    └── confluence_write.py        # Confluence API 쓰기

src/javis-viewer/src/
├── app/api/confluence/
│   ├── tree/route.ts              # 트리 API
│   ├── page/[id]/route.ts         # 페이지 상세 API
│   └── suggestions/route.ts       # AI 제안 API
├── components/
│   ├── ConfluenceTree.tsx         # 트리 UI
│   └── ConfluenceSuggestionPanel.tsx
└── types/
    └── confluence.ts              # TypeScript 타입
```

### 삭제된 파일 (정리됨)
- `*.csv` 임시 분석 파일들
- `scripts/sync_confluence_folders.py` (인라인 Python으로 대체)
- `scripts/recover_confluence_orphans.py` (폴더 동기화로 해결)

---

## 다음 단계
- [ ] `pg_trgm` 확장 설치 후 유사도 탐지 활성화
- [ ] 임베딩 기반 콘텐츠 유사도 분석 추가
- [ ] Write-back 충돌 해결 전략 (3-way merge)
- [ ] 라벨 클라우드 시각화 컴포넌트
- [ ] 일괄 작업 실행 UI (BatchOperationPanel)
- [ ] 폴더 동기화 자동화 (cron job)
