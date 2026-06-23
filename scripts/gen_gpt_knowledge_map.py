#!/usr/bin/env python3
"""Generate the Custom GPT knowledge-map markdown from live APIs.

Pulls the volatile lists (Jira projects, Kanban company projects, Bitbucket
repositories) from their APIs and renders docs/guides/custom-gpt-knowledge-map.md.
Curated prose (system overview, operation map, cross-system hints) is kept as
constants so it survives regeneration.

NO credentials are ever written to the output — only structural reference data.

Usage:
    python3 scripts/gen_gpt_knowledge_map.py [--out PATH] [--date YYYY-MM-DD]

Credentials:
    .env (project root): JIRA_URL, JIRA_EMAIL, JIRA_TOKEN,
                         BITBUCKET_API_TOKEN, BITBUCKET_WORKSPACE
    Kanban auth: resolved from <dev-root>/.config/kanban/auth (or $KANBAN_AUTH_FILE
                 / $KANBAN_AUTH_TOKEN / ~/.claude/kanban-auth fallbacks).
"""
from __future__ import annotations

import argparse
import base64
import datetime
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

ALLOWED_JIRA_PROJECTS: list[str] = ["EUV", "PSSM"]
KANBAN_COMPANY_CATEGORY: str = "edwards"
CONFLUENCE_SPACE_KEY: str = "ISP"
CONFLUENCE_SPACE_ID: str = "67043441"
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_OUT = PROJECT_ROOT / "docs" / "guides" / "custom-gpt-knowledge-map.md"


# ── Credential loading ────────────────────────────────────────────────────────
def load_env(path: pathlib.Path) -> dict[str, str]:
    """Parse a KEY=VALUE .env file into a dict (no export, no quotes handling)."""
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def resolve_kanban_auth() -> dict[str, str]:
    """Resolve shared kanban auth cross-platform (env > file walk-up > fallbacks)."""
    if os.environ.get("KANBAN_AUTH_TOKEN"):
        return {
            "KANBAN_AUTH_TOKEN": os.environ["KANBAN_AUTH_TOKEN"],
            "KANBAN_BASE_URL": os.environ.get(
                "KANBAN_BASE_URL", "https://cyanlunakanban.vercel.app"
            ),
        }
    candidates: list[pathlib.Path] = []
    if os.environ.get("KANBAN_AUTH_FILE"):
        candidates.append(pathlib.Path(os.environ["KANBAN_AUTH_FILE"]))
    cwd = pathlib.Path.cwd()
    for parent in [cwd, *cwd.parents]:
        candidates.append(parent / ".config" / "kanban" / "auth")
    xdg = os.environ.get("XDG_CONFIG_HOME") or str(pathlib.Path.home() / ".config")
    candidates += [
        pathlib.Path(xdg) / "kanban" / "auth",
        pathlib.Path.home() / ".claude" / "kanban-auth",
        pathlib.Path.home() / ".codex" / "kanban-auth",
    ]
    for f in candidates:
        if f.is_file():
            return load_env(f)
    return {}


# ── HTTP ──────────────────────────────────────────────────────────────────────
def http_get_json(url: str, headers: dict[str, str]) -> dict:
    """GET a URL and parse JSON, raising a clear error on failure."""
    req = urllib.request.Request(url, headers={"Accept": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} for {url}: {exc.read()[:200]!r}") from exc


def basic_auth_header(email: str, token: str) -> dict[str, str]:
    """Build an HTTP Basic auth header from email:token."""
    raw = f"{email}:{token}".encode("utf-8")
    return {"Authorization": "Basic " + base64.b64encode(raw).decode("ascii")}


# ── Fetchers ──────────────────────────────────────────────────────────────────
def fetch_jira_projects(env: dict[str, str]) -> list[dict[str, str]]:
    """Fetch name/type for the allowed Jira projects."""
    base = env["JIRA_URL"].rstrip("/")
    hdr = basic_auth_header(env["JIRA_EMAIL"], env["JIRA_TOKEN"])
    out: list[dict[str, str]] = []
    for key in ALLOWED_JIRA_PROJECTS:
        d = http_get_json(f"{base}/rest/api/3/project/{key}", hdr)
        out.append(
            {"key": d.get("key", key), "name": d.get("name", ""),
             "type": d.get("projectTypeKey", "")}
        )
    return out


def fetch_kanban_company_projects(auth: dict[str, str]) -> list[dict[str, str]]:
    """Fetch company (edwards) kanban projects with purpose/stack."""
    base = auth.get("KANBAN_BASE_URL", "https://cyanlunakanban.vercel.app").rstrip("/")
    hdr = {"X-Kanban-Auth": auth.get("KANBAN_AUTH_TOKEN", "")}
    data = http_get_json(f"{base}/api/projects", hdr)
    items = data if isinstance(data, list) else data.get("projects") or data.get("data") or []
    company = [p for p in items if p.get("category") == KANBAN_COMPANY_CATEGORY]
    out: list[dict[str, str]] = []
    for p in sorted(company, key=lambda x: x.get("id", "")):
        purpose = (p.get("purpose") or p.get("brief") or "").replace("\n", " ").strip()
        stack = (p.get("stack") or "").replace("\n", " ").strip()
        out.append({"id": p.get("id", ""), "purpose": purpose[:140], "stack": stack[:70]})
    return out


def fetch_confluence_pages(env: dict[str, str]) -> dict[str, object]:
    """Fetch ISP total page count + a few recently-modified pages (overview only).

    The ISP space is large (~thousands of pages), so the map shows only the total
    and recent examples; the GPT discovers the rest via searchPages (CQL).
    """
    base = env["JIRA_URL"].rstrip("/")
    hdr = basic_auth_header(env["JIRA_EMAIL"], env["JIRA_TOKEN"])
    cql = urllib.parse.quote(f"space = {CONFLUENCE_SPACE_KEY} AND type = page ORDER BY lastmodified DESC")
    data = http_get_json(f"{base}/wiki/rest/api/search?cql={cql}&limit=15", hdr)
    recent: list[dict[str, str]] = []
    for r in data.get("results", []):
        c = r.get("content") or {}
        recent.append({"id": str(c.get("id", "")), "title": c.get("title", r.get("title", ""))})
    total = data.get("totalSize") or data.get("size") or len(recent)
    return {"recent": recent, "total": total}


def fetch_bitbucket_repos(env: dict[str, str]) -> dict[str, list[dict[str, str]]]:
    """Fetch ac-avi repos grouped by their Bitbucket project name."""
    ws = env.get("BITBUCKET_WORKSPACE", "ac-avi")
    hdr = basic_auth_header(env["JIRA_EMAIL"], env["BITBUCKET_API_TOKEN"])
    fields = "next,values.slug,values.name,values.description,values.project.name"
    url = (
        f"https://api.bitbucket.org/2.0/repositories/{ws}"
        f"?pagelen=100&sort=-updated_on&fields={urllib.parse.quote(fields, safe=',.')}"
    )
    groups: dict[str, list[dict[str, str]]] = {}
    while url:
        data = http_get_json(url, hdr)
        for r in data.get("values", []):
            proj = (r.get("project") or {}).get("name") or "(ungrouped)"
            desc = (r.get("description") or "").replace("\n", " ").strip()
            groups.setdefault(proj, []).append(
                {"slug": r.get("slug", ""), "name": r.get("name", ""), "desc": desc[:80]}
            )
        url = data.get("next", "")
    for repos in groups.values():
        repos.sort(key=lambda x: x["slug"])
    return groups


# ── Rendering ─────────────────────────────────────────────────────────────────
HEADER = """# AC AVI Work Assistant — Reference Map

> **GPT Knowledge 파일.** 이 GPT가 Jira·Bitbucket·Kanban을 다룰 때 참조하는 지도(map)입니다.
> ⚠️ 이 파일은 대화로 노출될 수 있으므로 **자격증명/토큰은 일절 포함하지 않습니다.** 구조 정보만 담겨 있습니다.
> ⚠️ repo·프로젝트 이름은 회사 내부 정보이므로 이 GPT는 **비공개로 유지**하세요(공개 공유 금지).
> 최종 갱신: {date} (scripts/gen_gpt_knowledge_map.py 자동 생성)
"""

OVERVIEW = """## 1. 시스템 개요 (어디로 라우팅?)

| 시스템 | 무엇 | 범위(잠김) | 권한 |
|---|---|---|---|
| **Jira** `ac-avi.atlassian.net` | 이슈/에픽/스토리/스프린트/보드 | **EUV, PSSM 만** | 읽기+쓰기 |
| **Bitbucket** `ac-avi` | repo/브랜치/커밋/PR/소스 | **ac-avi 워크스페이스만** | 읽기 전용 |
| **Kanban** `cyanlunakanban.vercel.app` | 개인 칸반 카드/보드 | **회사(edwards) 프로젝트만** | 읽기+카드생성 |
| **Confluence** `ac-avi.atlassian.net/wiki` | 위키 페이지 읽기/작성/정리 | **ISP 스페이스만** | 읽기+생성/수정 |

라우팅 단서: 이슈·에픽·스토리·스프린트·`EUV-####` → Jira / repo·브랜치·커밋·PR·diff → Bitbucket / 카드·todo·칸반 → Kanban / 위키·문서·페이지·회의록·정리 → Confluence.
"""

OPERATION_MAP = """## 2. API 오퍼레이션 맵

### Jira (operationId)
- **읽기**: `getProject`, `getProjectComponents`, `getProjectVersions`, `getCreateMetaIssueTypes`, `getCreateMetaFields`, `listPriorities`, `searchIssues`(JQL), `getIssue`, `getIssueTransitions`, `getIssueComments`, `listBoards`, `getBoardConfiguration`, `getBoardEpics`, `listBoardSprints`, `getSprint`, `getCurrentUser`
- **쓰기**: `createIssue`, `updateIssue`, `transitionIssue`, `addComment`, `createIssueLink`, `createSprint`, `updateSprint`, `moveIssuesToSprint`, `moveIssuesToBacklog`
- 규칙: JQL은 **반드시 EUV/PSSM 스코프**, description·코멘트는 **ADF 객체**, 상태변경은 `getIssueTransitions`→`transitionIssue`. 보드/스프린트/백로그 이슈는 `searchIssues`로(전용 list 엔드포인트는 deprecated).

### Bitbucket (operationId, 모두 읽기)
- `listRepositories`, `getRepository`, `listBranches`, `getBranch`, `listTags`, `listCommits`, `listCommitsForRevision`, `getCommit`, `getDiff`, `getDiffStat`, `listPullRequests`, `getPullRequest`, `getPullRequestCommits`, `getPullRequestDiff`, `getSource`, `getFileHistory`, `getCurrentUser`
- 규칙: 워크스페이스는 ac-avi 고정. repo slug만 주면 됨. 쓰기 불가.

### Kanban (operationId)
- `getCompanyBoard`(보드 현황), `getCompanyTask`(카드 상세), `createCompanyTask`(카드 생성)
- 카드 상태 컬럼: `todo` `plan` `plan_review` `impl` `impl_review` `test` `done`. 수정·삭제·이동 불가.

### Confluence (operationId)
- `searchPages`(CQL, space=ISP), `listIspPages`, `getPage`, `getChildPages`, `createPage`, `updatePage`, `getConfluenceUser`
- 규칙: **ISP 스페이스만**. 본문은 **storage 포맷(XHTML-like HTML)**. 수정은 `getPage`로 version 확인 후 +1.
"""

CROSS_HINTS = """## 7. 시스템 간 연결 힌트

- **EUV 이슈 ↔ 코드**: Jira `EUV-####` 작업의 코드 변경은 Bitbucket에서 해당 키로 커밋 검색(`listCommits`)하거나 관련 repo에서 확인.
- **OQC 작업**: Jira(EUV/PSSM) + Bitbucket(`edwards.oqc.infra`) + Kanban(`edwards.oqc.infra`)이 같은 OQC 디지털화 흐름.
- **문서화/정리**: Jira·Bitbucket·Kanban에서 모은 내용을 Confluence ISP 페이지로 작성(`createPage`). 회의록·회고·설계 정리는 Confluence.
- **이름이 겹쳐도 다른 시스템**: 예) `unify`/`pcas-portal`/`point.of.product`는 Bitbucket repo이자 Kanban 프로젝트일 수 있음 — 사용자의 의도(코드면 Bitbucket, 카드/todo면 Kanban)로 구분.
"""


def render(
    jira: list[dict[str, str]],
    kanban: list[dict[str, str]],
    bitbucket: dict[str, list[dict[str, str]]],
    confluence: dict[str, object],
    date: str,
) -> str:
    """Render the full knowledge-map markdown."""
    parts: list[str] = [HEADER.format(date=date), "---\n", OVERVIEW, "---\n", OPERATION_MAP, "---\n"]

    # 3. Jira projects
    parts.append("## 3. Jira 프로젝트 (%d개)\n" % len(jira))
    parts.append("| 키 | 이름 | 유형 |")
    parts.append("|---|---|---|")
    for p in jira:
        parts.append(f"| **{p['key']}** | {p['name']} | {p['type']} |")
    parts.append("\n---\n")

    # 4. Kanban company projects
    parts.append("## 4. Kanban 회사 프로젝트 (%s, %d개)\n" % (KANBAN_COMPANY_CATEGORY, len(kanban)))
    parts.append("| 프로젝트 | 목적 | 주요 스택 |")
    parts.append("|---|---|---|")
    for p in kanban:
        parts.append(f"| **{p['id']}** | {p['purpose'] or '—'} | {p['stack'] or '—'} |")
    parts.append("\n> Kanban 카드 생성/조회는 위 프로젝트에 한정됩니다.\n\n---\n")

    # 5. Bitbucket repos grouped
    total = sum(len(v) for v in bitbucket.values())
    parts.append("## 5. Bitbucket 저장소 (ac-avi, %d개 — Bitbucket project별)\n" % total)
    for proj in sorted(bitbucket):
        parts.append(f"### {proj}")
        cells = []
        for r in bitbucket[proj]:
            label = f"`{r['slug']}`"
            if r["desc"]:
                label += f" — {r['desc']}"
            cells.append(label)
        parts.append(" · ".join(cells))
        parts.append("")
    parts.append("> 워크스페이스는 ac-avi 고정. 커밋/브랜치/PR/diff 조회 시 위 slug를 그대로 사용.\n\n---\n")

    # 6. Confluence (ISP)
    recent = confluence.get("recent", [])  # type: ignore[assignment]
    total = confluence.get("total", 0)
    parts.append(
        "## 6. Confluence — %s 스페이스 (PCAS Project Knowledge Hub, 약 %s 페이지)\n"
        % (CONFLUENCE_SPACE_KEY, total)
    )
    parts.append(
        "대규모 위키이므로 전체 목록은 싣지 않습니다. **검색으로 탐색**하세요: "
        "`searchPages` (CQL `space = ISP AND text ~ \"키워드\"`). 최근 수정된 페이지 예시:\n"
    )
    for p in recent:  # type: ignore[union-attr]
        parts.append(f"- {p['title']} (id `{p['id']}`)")
    parts.append("\n> 읽기·작성·수정 모두 ISP 스페이스에 한정. 본문은 storage 포맷(XHTML).\n\n---\n")

    parts.append(CROSS_HINTS)
    return "\n".join(parts).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the GPT knowledge-map markdown.")
    parser.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    parser.add_argument("--date", type=str, default=datetime.date.today().isoformat())
    args = parser.parse_args()

    env = load_env(PROJECT_ROOT / ".env")
    missing = [k for k in ("JIRA_URL", "JIRA_EMAIL", "JIRA_TOKEN", "BITBUCKET_API_TOKEN") if k not in env]
    if missing:
        print(f"ERROR: missing in .env: {', '.join(missing)}", file=sys.stderr)
        return 1
    kauth = resolve_kanban_auth()
    if not kauth.get("KANBAN_AUTH_TOKEN"):
        print("ERROR: kanban auth not found (see resolver order in docstring)", file=sys.stderr)
        return 1

    print("Fetching Jira projects...", file=sys.stderr)
    jira = fetch_jira_projects(env)
    print("Fetching Kanban company projects...", file=sys.stderr)
    kanban = fetch_kanban_company_projects(kauth)
    print("Fetching Bitbucket repositories...", file=sys.stderr)
    bitbucket = fetch_bitbucket_repos(env)
    print("Fetching Confluence ISP pages...", file=sys.stderr)
    confluence = fetch_confluence_pages(env)

    md = render(jira, kanban, bitbucket, confluence, args.date)
    args.out.write_text(md)
    total_repos = sum(len(v) for v in bitbucket.values())
    print(
        f"Wrote {args.out} — Jira {len(jira)}, Kanban {len(kanban)}, "
        f"Bitbucket {total_repos} repos in {len(bitbucket)} groups.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
