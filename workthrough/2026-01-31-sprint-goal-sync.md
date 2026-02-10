# Sprint Goal 동기화 및 줄바꿈 표시 수정

## 개요
Jira Sprint goal을 로컬 DB와 동기화하고, 프론트엔드에서 목표가 줄바꿈되어 표시되도록 수정했습니다.

## 변경 사항

### 1. Sprint Goal 동기화
Jira Agile REST API를 통해 스프린트 goal을 가져와 로컬 DB 업데이트:

```python
# Jira에서 스프린트 정보 가져오기
url = f"{config.JIRA_URL}/rest/agile/1.0/sprint/{sprint_id}"
response = requests.get(url, auth=auth)
goal = response.json().get('goal', '')

# 로컬 DB 업데이트
db.execute("UPDATE jira_sprints SET goal = %s WHERE id = %s", [goal, sprint_id])
```

**동기화된 Scaled Sprint14 Goal:**
```
1. Complete Unify Plasma core module integration (Exhaust/H2Injection/Scraper/Safety Monitoring)
2. Write Bundle 1.2.0 Verification Notes & validate Modbus Gateway for TSMC/SAMSUNG
3. Implement EDP dummy functionality and HRS Foundation setup
4. Develop Web-based Simulator Phase2 with inter-module Message Broker connection
```

### 2. Sprint Goal 줄바꿈 표시 수정
**파일**: `src/javis-viewer/src/app/sprints/SprintContent.tsx`

기존에는 goal 텍스트의 줄바꿈(`\n`)이 무시되어 한 줄로 표시되었습니다.
`whitespace-pre-line` CSS 클래스를 추가하여 줄바꿈이 보존되도록 수정:

```tsx
// Before
<p className="text-sm text-gray-600">{selectedSprint.goal}</p>

// After
<p className="text-sm text-gray-600 whitespace-pre-line">{selectedSprint.goal}</p>
```

## 검증 결과
- Sprint goal이 Jira에서 로컬 DB로 정상 동기화됨
- 프론트엔드에서 목표가 번호별로 줄바꿈되어 표시됨

## 참고
- `sync_bidirectional.py`는 이슈만 동기화하고 스프린트 메타데이터(goal 등)는 동기화하지 않음
- 스프린트 goal 동기화는 별도 수동 실행 필요
