#!/usr/bin/env python3
"""
Bitbucket PR Helper - PR 데이터 수집 및 코멘트 게시

Usage:
    python3 review_pr.py fetch <pr_url>       # PR 메타 + diff + commits → JSON stdout
    python3 review_pr.py comment <pr_url>     # stdin으로 코멘트 내용 읽어서 PR에 게시
    python3 review_pr.py save <pr_url>        # PR 메타 정보만 출력 (파일명 생성용)
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple


def load_env() -> Dict[str, str]:
    """프로젝트 루트의 .env 파일을 로드합니다."""
    env = {}
    possible_roots = [
        Path(__file__).resolve().parents[4],  # .claude/skills/review-pr/scripts -> 프로젝트 루트
        Path.cwd(),
        Path.home() / 'dev' / 'jira.javis',
    ]

    env_file = None
    for root in possible_roots:
        candidate = root / '.env'
        if candidate.exists():
            env_file = candidate
            break

    if not env_file:
        print("Error: .env file not found", file=sys.stderr)
        sys.exit(1)

    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip()

    return env


_env_cache: Optional[Dict[str, str]] = None


def get_env() -> Dict[str, str]:
    global _env_cache
    if _env_cache is None:
        _env_cache = load_env()
    return _env_cache


def get_auth() -> Tuple[str, str]:
    """Bitbucket Basic Auth 자격증명을 반환합니다."""
    env = get_env()
    email = env.get('JIRA_EMAIL', '')
    token = env.get('BITBUCKET_API_TOKEN', '') or env.get('BITBUCKET_APP_PASSWORD', '')
    if not email or not token:
        print("Error: JIRA_EMAIL and BITBUCKET_API_TOKEN must be set in .env", file=sys.stderr)
        sys.exit(1)
    return (email, token)


def parse_pr_url(url: str) -> Dict[str, str]:
    """Bitbucket PR URL을 파싱합니다.

    지원 형식:
        https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}
    """
    pattern = r'bitbucket\.org/([^/]+)/([^/]+)/pull-requests/(\d+)'
    match = re.search(pattern, url)
    if not match:
        print(f"Error: Invalid Bitbucket PR URL: {url}", file=sys.stderr)
        print("Expected format: https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}", file=sys.stderr)
        sys.exit(1)

    return {
        'workspace': match.group(1),
        'repo': match.group(2),
        'pr_id': match.group(3),
    }


def bb_api(method: str, endpoint: str, **kwargs) -> Any:
    """Bitbucket API 요청을 실행합니다."""
    import requests

    url = f"https://api.bitbucket.org/2.0{endpoint}"
    auth = get_auth()

    try:
        response = requests.request(method, url, auth=auth, timeout=30, **kwargs)
        response.raise_for_status()
        return response
    except requests.exceptions.HTTPError as e:
        print(f"API Error ({response.status_code}): {response.text[:500]}", file=sys.stderr)
        raise
    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}", file=sys.stderr)
        raise


def fetch_pr(url: str) -> Dict[str, Any]:
    """PR 메타데이터, 커밋, diff를 수집합니다."""
    info = parse_pr_url(url)
    ws, repo, pr_id = info['workspace'], info['repo'], info['pr_id']
    base = f"/repositories/{ws}/{repo}/pullrequests/{pr_id}"

    # PR 메타데이터
    pr_resp = bb_api("GET", base)
    pr_data = pr_resp.json()

    pr_meta = {
        'id': pr_data.get('id'),
        'title': pr_data.get('title', ''),
        'description': pr_data.get('description', ''),
        'author': pr_data.get('author', {}).get('display_name', ''),
        'source_branch': pr_data.get('source', {}).get('branch', {}).get('name', ''),
        'target_branch': pr_data.get('destination', {}).get('branch', {}).get('name', ''),
        'state': pr_data.get('state', ''),
        'created_on': pr_data.get('created_on', ''),
        'reviewers': [r.get('display_name', '') for r in pr_data.get('reviewers', [])],
    }

    # PR 커밋
    commits_resp = bb_api("GET", f"{base}/commits")
    commits_data = commits_resp.json()
    commits = []
    for c in commits_data.get('values', []):
        commits.append({
            'hash': c.get('hash', '')[:12],
            'message': c.get('message', '').strip(),
            'author': c.get('author', {}).get('raw', ''),
            'date': c.get('date', ''),
        })

    # Diff
    diff_resp = bb_api("GET", f"{base}/diff")
    diff_text = diff_resp.text

    # Target branch 최근 커밋 (컨텍스트용)
    target_branch = pr_meta['target_branch']
    target_commits = []
    try:
        target_resp = bb_api("GET", f"/repositories/{ws}/{repo}/commits/{target_branch}",
                             params={'pagelen': 10})
        target_data = target_resp.json()
        for c in target_data.get('values', []):
            target_commits.append({
                'hash': c.get('hash', '')[:12],
                'message': c.get('message', '').strip(),
                'author': c.get('author', {}).get('raw', ''),
                'date': c.get('date', ''),
            })
    except Exception:
        # target branch 커밋 조회 실패는 무시 (선택적 정보)
        pass

    return {
        'pr': pr_meta,
        'commits': commits,
        'diff': diff_text,
        'target_branch_commits': target_commits,
    }


def post_comment(url: str, content: str) -> Dict[str, Any]:
    """PR에 코멘트를 게시합니다."""
    info = parse_pr_url(url)
    ws, repo, pr_id = info['workspace'], info['repo'], info['pr_id']
    endpoint = f"/repositories/{ws}/{repo}/pullrequests/{pr_id}/comments"

    payload = {
        'content': {
            'raw': content,
        }
    }

    resp = bb_api("POST", endpoint, json=payload)
    result = resp.json()

    return {
        'id': result.get('id'),
        'created_on': result.get('created_on'),
        'url': result.get('links', {}).get('html', {}).get('href', ''),
    }


def save_info(url: str) -> Dict[str, str]:
    """PR 메타 정보를 반환합니다 (파일명 생성용)."""
    info = parse_pr_url(url)
    return {
        'workspace': info['workspace'],
        'repo': info['repo'],
        'pr_id': info['pr_id'],
        'filename': f"PR{info['pr_id']}-{info['repo']}-review.md",
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip())
        sys.exit(1)

    command = sys.argv[1]
    pr_url = sys.argv[2]

    if command == 'fetch':
        result = fetch_pr(pr_url)
        # diff가 매우 클 수 있으므로 파일로 저장 옵션 제공
        diff_text = result['diff']
        if len(diff_text) > 100_000:
            info = parse_pr_url(pr_url)
            diff_path = f"/tmp/pr_{info['pr_id']}_diff.txt"
            with open(diff_path, 'w') as f:
                f.write(diff_text)
            result['diff'] = f"[DIFF_TOO_LARGE: saved to {diff_path}] ({len(diff_text)} chars)"
            result['diff_file'] = diff_path
            print(f"Note: Diff saved to {diff_path} ({len(diff_text)} chars)", file=sys.stderr)

        print(json.dumps(result, indent=2, ensure_ascii=False))

    elif command == 'comment':
        # stdin에서 코멘트 내용 읽기
        if not sys.stdin.isatty():
            content = sys.stdin.read()
        else:
            print("Error: Pipe comment content via stdin", file=sys.stderr)
            print("Usage: cat review.md | python3 review_pr.py comment <pr_url>", file=sys.stderr)
            sys.exit(1)

        if not content.strip():
            print("Error: Empty comment content", file=sys.stderr)
            sys.exit(1)

        result = post_comment(pr_url, content.strip())
        print(json.dumps(result, indent=2, ensure_ascii=False))

    elif command == 'save':
        result = save_info(pr_url)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(__doc__.strip())
        sys.exit(1)


if __name__ == '__main__':
    main()
