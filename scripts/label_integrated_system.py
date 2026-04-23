#!/usr/bin/env python3
"""
Add 'IntegratedSystem' label to PSSM tickets that are NOT tagged as EOB or OQC.

Usage:
  python3 scripts/label_integrated_system.py --dry-run   # preview only
  python3 scripts/label_integrated_system.py             # apply changes
"""

import argparse
import os
import sys
import time
from typing import Any

import requests

JIRA_URL: str = os.environ["JIRA_URL"].rstrip("/")
JIRA_EMAIL: str = os.environ["JIRA_EMAIL"]
JIRA_TOKEN: str = os.environ["JIRA_TOKEN"]
PROJECT: str = "PSSM"
LABEL: str = "IntegratedSystem"
EXCLUDED: set[str] = {"eob", "oqc"}

AUTH = (JIRA_EMAIL, JIRA_TOKEN)
HEADERS = {"Accept": "application/json", "Content-Type": "application/json"}


def is_excluded(issue: dict[str, Any]) -> bool:
    fields = issue.get("fields", {})
    components: list[dict] = fields.get("components", []) or []
    labels: list[str] = fields.get("labels", []) or []
    names = {(c.get("name") or "").lower() for c in components}
    label_set = {(l or "").lower() for l in labels}
    return bool((names | label_set) & EXCLUDED)


def fetch_all_issues() -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    next_page_token: str | None = None
    page_size = 100
    jql = f"project = {PROJECT} ORDER BY created DESC"

    print(f"Fetching {PROJECT} tickets from Jira...")
    while True:
        body: dict[str, Any] = {
            "jql": jql,
            "maxResults": page_size,
            "fields": ["summary", "labels", "components"],
        }
        if next_page_token:
            body["nextPageToken"] = next_page_token

        resp = requests.post(
            f"{JIRA_URL}/rest/api/3/search/jql",
            auth=AUTH,
            headers=HEADERS,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("issues", [])
        issues.extend(batch)
        print(f"  fetched {len(issues)} so far...")

        if data.get("isLast", True) or not batch:
            break
        next_page_token = data.get("nextPageToken")

    return issues


def add_label(key: str, existing_labels: list[str], dry_run: bool) -> bool:
    new_labels = [*existing_labels, LABEL]
    if dry_run:
        return True

    resp = requests.put(
        f"{JIRA_URL}/rest/api/3/issue/{key}",
        auth=AUTH,
        headers=HEADERS,
        json={"fields": {"labels": new_labels}},
    )
    if resp.status_code == 204:
        return True
    print(f"  [ERROR] {key}: HTTP {resp.status_code} — {resp.text[:200]}", file=sys.stderr)
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    dry_run: bool = args.dry_run

    issues = fetch_all_issues()
    targets = [i for i in issues if not is_excluded(i)]
    needs_label = [i for i in targets if LABEL not in (i["fields"].get("labels") or [])]

    print(f"\nTotal {PROJECT}: {len(issues)}")
    print(f"EOB/OQC excluded: {len(issues) - len(targets)}")
    print(f"Need '{LABEL}' label: {len(needs_label)}")
    print(f"Already labeled: {len(targets) - len(needs_label)}")
    print(f"Mode: {'DRY-RUN' if dry_run else 'APPLY'}\n")

    if not needs_label:
        print("Nothing to do.")
        return

    updated = 0
    errors = 0

    for i, issue in enumerate(needs_label, 1):
        key: str = issue["key"]
        labels: list[str] = issue["fields"].get("labels") or []
        print(f"[{i}/{len(needs_label)}] {key}", end=" ", flush=True)

        success = add_label(key, labels, dry_run)
        if success:
            updated += 1
            print("✓")
        else:
            errors += 1
            print("✗")

        if not dry_run and i % 20 == 0:
            time.sleep(1.0)

    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Done.")
    print(f"  Updated : {updated}")
    print(f"  Errors  : {errors}")


if __name__ == "__main__":
    main()
