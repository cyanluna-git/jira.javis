# Vision 기본값 (Component/Labels) 자동 적용 기능 추가

## 개요

Jira에 Epic/Story 생성 시 Vision별로 정의된 `default_component`와 `default_labels`가 자동 적용되도록 기능을 추가했습니다. 프로젝트마다 고정된 컴포넌트가 있고, 소규모 과제는 라벨로 구분하여 관리하기 위한 요구사항을 반영했습니다.

## 배경

- **문제**: 스킬로 Story 생성 시 매번 수동으로 component와 labels를 지정해야 함
- **요구사항**:
  - 프로젝트 → Vision → Epic → Story 계층 구조에서 Vision 단위로 기본값 관리
  - 같은 프로젝트라도 Vision별로 다른 컴포넌트/라벨 사용 가능
  - 예: EUV 프로젝트의 "OQC Digitalization" Vision vs "Innovative" Vision

## 변경 사항

### 1. DB 스키마 변경

`roadmap_visions` 테이블에 2개 컬럼 추가:

```sql
ALTER TABLE roadmap_visions
ADD COLUMN IF NOT EXISTS default_component TEXT,
ADD COLUMN IF NOT EXISTS default_labels TEXT[];
```

### 2. 기존 Vision 데이터 설정

| 프로젝트 | Vision | default_component | default_labels |
|----------|--------|-------------------|----------------|
| EUV | OQC Digitalization | OQCDigitalization | oqc-digitalization |
| ASP | Unify Plasma | Unify Plasma | unify-plasma-single |

### 3. db_helper.py - Vision 기본값 조회 함수 추가

```python
# .claude/skills/_shared/db_helper.py
def get_vision_defaults(project_key: str) -> Optional[Dict[str, Any]]:
    """프로젝트의 Vision 기본값 (component, labels)을 반환합니다."""
    return query_one(
        """
        SELECT default_component, default_labels
        FROM roadmap_visions
        WHERE project_key = %s AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        [project_key]
    )
```

### 4. stories.py - Jira Story 생성 함수 추가

```python
# .claude/skills/stories/scripts/stories.py
def create_jira_story(
    project_key: str,
    epic_key: str,
    summary: str,
    description: str,
    labels: list = None,
    story_points: int = None,
    dry_run: bool = False
) -> Optional[dict]:
    """
    Jira에 Story를 생성합니다.
    Vision의 default_component와 default_labels가 자동으로 적용됩니다.
    """
    # Vision 기본값 조회
    vision_defaults = get_vision_defaults(project_key)
    component = vision_defaults.get("default_component") if vision_defaults else None
    default_labels = vision_defaults.get("default_labels") or []

    # 라벨 병합 (Vision 기본값 + 파라미터)
    all_labels = list(set(default_labels + (labels or [])))

    # Jira API payload 구성...
```

### 5. 스킬 문서 업데이트

- `SKILL.md`: Vision 기본값 자동 적용 설명 추가
- `reference.md`: 스키마 및 API 사용법 문서화

### 6. 마이그레이션 SQL 파일 생성

```
scripts/migrations/20260131_add_vision_defaults.sql
```

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `.claude/skills/_shared/db_helper.py` | `get_vision_defaults()` 함수 추가 |
| `.claude/skills/stories/scripts/stories.py` | `create_jira_story()`, `get_epic_project()` 함수 추가 |
| `.claude/skills/stories/SKILL.md` | Vision 기본값 설명 추가 |
| `.claude/skills/stories/reference.md` | 스키마 및 API 문서 업데이트 |
| `scripts/migrations/20260131_add_vision_defaults.sql` | 마이그레이션 SQL 신규 |

## 검증 결과

```bash
$ python3 .claude/skills/stories/scripts/stories.py push EUV-3304 --dry-run

=== Story Push: EUV-3304 ===
Project: EUV
  Component: OQCDigitalization
  Labels: ['oqc-digitalization']

(Dry-run mode - 실제 생성하지 않음)
```

```bash
$ python3 .claude/skills/stories/scripts/stories.py push ASP-123 --dry-run

=== Story Push: ASP-123 ===
Project: ASP
  Component: Unify Plasma
  Labels: ['unify-plasma-single']
```

## 사용법

```bash
# Vision 기본값 확인
python3 .claude/skills/stories/scripts/stories.py push {epic_key} --dry-run

# Vision 기본값 수정 (SQL)
UPDATE roadmap_visions
SET default_component = '새컴포넌트', default_labels = ARRAY['label1', 'label2']
WHERE project_key = 'EUV';
```

## 향후 개선 사항

- Vision 생성 시 UI에서 기본값 설정 가능하도록
- `/javis-stories add` 명령에서 자동 적용 테스트
- Epic 생성 시에도 동일한 기본값 적용

---

*Generated: 2026-01-31*
