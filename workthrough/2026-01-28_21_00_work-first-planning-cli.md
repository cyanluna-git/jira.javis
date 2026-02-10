# Work-First Planning System (Bottom-Up) CLI 구현

## 개요
"다음 뭐하지?" 질문에 AI가 현재 맥락을 분석하여 구체적 작업을 추천하는 Bottom-Up 방식의 CLI 도구를 구현했습니다. Jira, Bitbucket, 로컬 태그 시스템을 통합하여 Context Aggregator가 수집한 데이터를 Claude/OpenAI에 전달하여 추천을 생성합니다.

## 주요 변경사항

### 개발한 것
- **DB 스키마** (`scripts/migrate_work_planning.sql`)
  - Bitbucket 테이블: `bitbucket_repositories`, `bitbucket_commits`, `bitbucket_pullrequests`
  - 태그 시스템: `work_tags`, `issue_tags`
  - AI 추천 이력: `ai_suggestions`

- **Bitbucket 동기화** (`scripts/sync_bitbucket.py`)
  - Repository, Commit, PR 동기화
  - 커밋 메시지에서 Jira Key 자동 추출

- **CLI 라이브러리** (`scripts/lib/`)
  - `config.py`: 환경변수 관리
  - `db.py`: DB 유틸리티
  - `context_aggregator.py`: 맥락 수집
  - `ai_client.py`: Claude/OpenAI API 클라이언트

- **CLI 명령어** (`scripts/cli/`, `scripts/javis_cli.py`)
  - `javis suggest`: AI 작업 추천
  - `javis context`: 맥락 조회
  - `javis tag`: 태그 관리
  - `javis sync`: 동기화 래퍼

## 핵심 코드

```python
# Context Aggregator - 맥락 수집
class ContextAggregator:
    def get_full_context(self) -> Dict[str, Any]:
        return {
            "work_in_progress": self.get_in_progress(),
            "blocked_items": self.get_blocked(),
            "pending_reviews": self.get_pending_reviews(),
            "attention_needed": self.get_attention_items(),
        }

# AI Client - 추천 생성
def suggest_work(context, focus=None, count=3):
    prompt = f"현재 상황: {context}. 다음 작업 {count}개 추천."
    return client.call_api(prompt)
```

## 결과
- CLI 도움말 정상 출력 확인
- 모듈 구조 검증 완료

## 다음 단계
- `.env`에 환경변수 추가 필요:
  ```
  BITBUCKET_WORKSPACE=<workspace>
  BITBUCKET_REPOS=repo1,repo2
  BITBUCKET_USERNAME=<username>
  BITBUCKET_APP_PASSWORD=<app-password>
  AI_PROVIDER=claude
  ANTHROPIC_API_KEY=sk-ant-...
  ```
- DB 마이그레이션 실행: `psql -f scripts/migrate_work_planning.sql`
- Bitbucket 동기화 테스트: `python3 scripts/sync_bitbucket.py --dry-run`
- AI 추천 테스트: `python3 scripts/javis_cli.py suggest`
- `javis` alias 등록: `alias javis='python3 /path/to/scripts/javis_cli.py'`
