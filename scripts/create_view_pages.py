#!/usr/bin/env python3
"""
Create view pages for Sprint-Tumalo with Content by Label macros.

Creates:
- 📋 All Sprint Reviews
- 📋 All Story Notes
- 📋 All Sprint Boards
"""

import os
import sys

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)

from lib.confluence_write import api_request, ConfluenceAPIError

# Sprint-Tumalo page ID
PARENT_ID = "164462762"
SPACE_ID = "67043441"  # EUV Gen4 space


def create_page(title: str, body: str):
    """Create a new Confluence page."""
    payload = {
        "spaceId": SPACE_ID,
        "status": "current",
        "title": title,
        "parentId": PARENT_ID,
        "body": {
            "representation": "storage",
            "value": body
        }
    }

    try:
        result = api_request('POST', '/api/v2/pages', payload)
        if result:
            print(f"Created: {title} (ID: {result.get('id')})")
            return result
    except ConfluenceAPIError as e:
        if "already exists" in str(e).lower() or e.status_code == 400:
            print(f"Page already exists: {title}")
        else:
            print(f"Error creating {title}: {e}")
    return None


def main():
    # 1. All Sprint Reviews
    sprint_reviews_body = """
<h1>All Sprint Reviews</h1>
<p>스프린트별 리뷰 문서 모음입니다. <code>sprint-review</code> 라벨이 있는 모든 페이지가 표시됩니다.</p>

<ac:structured-macro ac:name="contentbylabel">
  <ac:parameter ac:name="cql">label = "sprint-review" and ancestor = "164462762"</ac:parameter>
  <ac:parameter ac:name="showLabels">true</ac:parameter>
  <ac:parameter ac:name="showSpace">false</ac:parameter>
  <ac:parameter ac:name="excerpt">true</ac:parameter>
  <ac:parameter ac:name="excerptType">simple</ac:parameter>
  <ac:parameter ac:name="sort">title</ac:parameter>
  <ac:parameter ac:name="max">100</ac:parameter>
</ac:structured-macro>

<hr/>
<p><em>이 페이지는 자동으로 업데이트됩니다. 새 Sprint Review에 <code>sprint-review</code> 라벨을 추가하면 여기에 표시됩니다.</em></p>
"""
    create_page("📋 All Sprint Reviews", sprint_reviews_body)

    # 2. All Story Notes
    story_notes_body = """
<h1>All Story Notes</h1>
<p>JIRA 스토리별 노트 모음입니다. <code>story-note</code> 라벨이 있는 모든 페이지가 표시됩니다.</p>

<h2>스프린트별 필터</h2>
<p>특정 스프린트만 보려면 Confluence 검색에서 다음과 같이 검색하세요:</p>
<ul>
  <li><code>label:story-note AND label:sprint-27</code> - Sprint 27 스토리</li>
  <li><code>label:story-note AND label:sprint-33</code> - Sprint 33 스토리</li>
</ul>

<hr/>

<h2>전체 목록 (최근 100개)</h2>
<ac:structured-macro ac:name="contentbylabel">
  <ac:parameter ac:name="cql">label = "story-note" and ancestor = "164462762"</ac:parameter>
  <ac:parameter ac:name="showLabels">true</ac:parameter>
  <ac:parameter ac:name="showSpace">false</ac:parameter>
  <ac:parameter ac:name="sort">modified</ac:parameter>
  <ac:parameter ac:name="reverse">true</ac:parameter>
  <ac:parameter ac:name="max">100</ac:parameter>
</ac:structured-macro>

<hr/>
<p><em>이 페이지는 자동으로 업데이트됩니다.</em></p>
"""
    create_page("📋 All Story Notes", story_notes_body)

    # 3. All Sprint Boards
    boards_body = """
<h1>All Sprint Boards</h1>
<p>스프린트별 보드/스탠드업 문서 모음입니다.</p>

<ac:structured-macro ac:name="contentbylabel">
  <ac:parameter ac:name="cql">label = "sprint-board" and ancestor = "164462762"</ac:parameter>
  <ac:parameter ac:name="showLabels">true</ac:parameter>
  <ac:parameter ac:name="showSpace">false</ac:parameter>
  <ac:parameter ac:name="sort">title</ac:parameter>
  <ac:parameter ac:name="max">50</ac:parameter>
</ac:structured-macro>
"""
    create_page("📋 All Sprint Boards", boards_body)

    print("\nDone! View pages created.")


if __name__ == '__main__':
    main()
