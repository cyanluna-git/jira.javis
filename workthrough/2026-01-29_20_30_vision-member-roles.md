# Vision Member Roles 시스템 구현

## 개요
프로젝트(Vision)별로 멤버의 역할과 투입 공수(M/M)를 관리하는 기능을 추가했다. 기존 `team_members` 테이블과 연결하여 특정 인원이 각 프로젝트에서 어떤 역할을 수행하는지 추적할 수 있다.

## 주요 변경사항

### 1. DB 마이그레이션
- `roadmap_vision_members` 테이블 생성 (vision_id, member_account_id 복합 유니크)
- 역할 카테고리: pm, backend, frontend, plc, qa, scenario, devops, fullstack
- 투입 공수(mm_allocation), 참여 기간(start_date, end_date) 지원
- 2개 뷰 생성: `vision_members_with_details`, `member_project_roles`

### 2. API 엔드포인트
- `GET/POST/PUT/DELETE /api/roadmap/visions/[id]/members` - Vision별 멤버 CRUD
- `GET /api/members/[id]/projects` - 멤버별 프로젝트 역할 조회

### 3. TypeScript 타입
- `VisionMember`, `RoleCategory` 타입 추가
- `ROLE_CATEGORY_LABELS`, `ROLE_CATEGORY_COLORS` 상수

### 4. UI 컴포넌트
- `VisionMemberSection.tsx` - 멤버 목록/추가/수정/삭제 UI
- 카테고리별 그룹핑, M/M 합계 표시
- Vision 상세 페이지에 통합

## 핵심 쿼리

```sql
-- 프로젝트 멤버 목록 (카테고리 정렬)
SELECT vm.*, tm.display_name, tm.avatar_url
FROM roadmap_vision_members vm
JOIN team_members tm ON tm.account_id = vm.member_account_id
WHERE vm.vision_id = $1
ORDER BY CASE vm.role_category
  WHEN 'pm' THEN 1 WHEN 'fullstack' THEN 2 ...
END;
```

## 결과
- ✅ 빌드 성공
- ✅ 마이그레이션 완료
- ✅ Vision 상세 페이지에 Team Members 섹션 표시

## 수정된 파일
| 파일 | 변경 |
|------|------|
| `scripts/migrate_vision_members.sql` | 기존 - 테이블/뷰 생성 |
| `src/types/roadmap.ts` | VisionMember 타입 추가 |
| `src/app/api/roadmap/visions/[id]/members/route.ts` | 신규 |
| `src/app/api/members/[id]/projects/route.ts` | 신규 |
| `src/components/VisionMemberSection.tsx` | 신규 |
| `src/app/roadmap/[visionId]/page.tsx` | 멤버 섹션 통합 |

## 다음 단계
- 멤버가 프로젝트에서 수행한 스토리 조회 API 구현
- 멤버별 프로젝트 역할 페이지 UI
- 프로젝트 투입 공수 대시보드 (M/M 현황 시각화)
