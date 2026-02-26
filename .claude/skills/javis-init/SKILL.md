---
name: javis-init
description: Initialize per-project Javis config. Auto-detects Bitbucket repo from git remote and looks up Vision defaults from DB. Creates .claude/javis.json and .claude/.javis-env symlink. Usage: /javis-init
argument-hint: ""
allowed-tools: Bash(python3 *), Bash(git *), Bash(mkdir *), Bash(ln *), Bash(cat *), Bash(ls *), Read, Write
---

# /javis-init - Project Initialization (Auto-Detect)

Sets up a project directory to use Javis skills (`/javis-review-pr`, `/javis-story`) from any repository.
Automatically detects the Bitbucket repo and looks up matching Vision defaults from the Javis DB.

## What It Does

1. **Auto-detects** `bitbucket_repos` from `git remote -v`
2. **Looks up** matching Vision defaults (`project_key`, `component`, `labels`) from DB
3. **Shows detected config** and asks user to confirm
4. Creates `.claude/javis.json` + `.claude/.javis-env` symlink

## Required Execution Steps

### Step 0: Check Existing Config

```bash
cat .claude/javis.json 2>/dev/null
```

If it exists, show the current config and ask the user if they want to update it.

### Step 1: Auto-Detect Bitbucket Repo

```bash
git remote -v 2>/dev/null | head -5
```

Parse the output to extract Bitbucket workspace/repo slug. Expected patterns:
- `git@bitbucket.org:ac-avi/edwards.oqc.infra.git`  → `ac-avi/edwards.oqc.infra`
- `https://bitbucket.org/ac-avi/edwards.oqc.infra.git` → `ac-avi/edwards.oqc.infra`

If no Bitbucket remote found, ask the user manually.

### Step 2: Look Up Vision Defaults from DB

Create the `.claude/.javis-env` symlink first (needed for DB access):

```bash
mkdir -p .claude
ln -sf ~/Dev/jarvis.gerald/.env .claude/.javis-env
```

Then query the DB for all active Visions:

```bash
python3 -c "
import sys
sys.path.insert(0, '$(echo ~/.claude/skills/_shared)')
from db_helper import query

visions = query('''
    SELECT project_key, title, default_component, default_labels
    FROM roadmap_visions
    WHERE status = 'active'
    ORDER BY project_key
''')

import json
for v in visions:
    if v.get('default_labels'):
        v['default_labels'] = list(v['default_labels'])
    print(json.dumps(v, default=str))
"
```

**Matching logic** — try to find the best Vision match:
1. Check if the repo slug contains a known project keyword (e.g., `edwards.oqc.infra` → `oqc` → project `EUV`)
2. Check if any Vision's `title` appears in the repo slug
3. If multiple matches or no match, show all available Visions and let the user pick

### Step 3: Present Detected Config for Confirmation

Show the auto-detected values:

```
Detected config:

  Bitbucket Repo : ac-avi/edwards.oqc.infra  (from git remote)
  Jira Project   : EUV                        (from Vision "OQC")
  Component      : OQCDigitalization           (from Vision defaults)
  Labels         : oqc-digitalization          (from Vision defaults)
  Vision         : OQC                         (matched from repo)

Is this correct? (or specify what to change)
```

If the user confirms, proceed. If they want changes, apply them.

### Step 4: Write `.claude/javis.json`

```json
{
  "jira_project": "EUV",
  "default_component": "OQCDigitalization",
  "default_labels": ["oqc-digitalization"],
  "bitbucket_repos": ["ac-avi/edwards.oqc.infra"],
  "vision": "OQC"
}
```

### Step 5: Verify Symlink

```bash
ls -la .claude/.javis-env
```

### Step 6: Confirmation

```
Javis initialized for this project.

Config: .claude/javis.json
  - Jira Project: EUV
  - Component: OQCDigitalization
  - Labels: oqc-digitalization
  - Bitbucket Repos: ac-avi/edwards.oqc.infra
  - Vision: OQC

Credentials: .claude/.javis-env → ~/Dev/jarvis.gerald/.env

Available skills:
  /javis-review-pr <PR_URL>    — Code review (auto-detects domain)
  /javis-review-pr 42          — Review PR #42 (uses bitbucket_repos)
  /javis-story context         — Project context (uses vision)
  /javis-story add <desc>      — Create story (uses component/labels)

Tip: Add `.claude/.javis-env` to .gitignore (it's a symlink to secrets)
```

## javis.json Schema

```json
{
  "jira_project": "string — Jira project key (required)",
  "default_component": "string — Default component for new Jira issues",
  "default_labels": ["array — Default labels for new Jira issues"],
  "bitbucket_repos": ["array — Bitbucket workspace/repo slugs"],
  "vision": "string — Vision title for context lookups"
}
```

## Notes

- The `.javis-env` symlink shares credentials from the central jarvis.gerald installation
- Add `.claude/.javis-env` to your project's `.gitignore` (it's a symlink to secrets)
- The `javis.json` file can be committed — it contains no secrets
- Re-run `/javis-init` anytime to update the config
