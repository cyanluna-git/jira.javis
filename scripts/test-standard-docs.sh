#!/usr/bin/env bash
# scripts/test-standard-docs.sh
#
# Phase 6 E2E test suite for docs/standard/ — covers T1–T10 + E1–E4.
# Each test prints `--- T<N>: <name> ---` then PASS / FAIL / SKIP.
# Exit code: 0 if no FAIL, 1 if any FAIL. SKIPs do not fail the run.
#
# Run from the repo root:
#   bash scripts/test-standard-docs.sh
#
# Or from docs/standard/:
#   make test

set -u

# ---------- locate repo root + standard dir ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STD_DIR="$REPO_ROOT/docs/standard"
SDP="$STD_DIR/pcas-sdp.md"
SCM="$STD_DIR/pcas-scm.md"
MAP="$STD_DIR/section-mapping.md"
DIST="$STD_DIR/dist"

# ---------- counters ----------
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() { echo "PASS: $*"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "FAIL: $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
skip() { echo "SKIP: $*"; SKIP_COUNT=$((SKIP_COUNT + 1)); }
header() { echo ""; echo "--- $1 ---"; }

# ---------- pre-flight ----------
for f in "$SDP" "$SCM" "$MAP"; do
  if [[ ! -f "$f" ]]; then
    echo "FATAL: missing required file $f"
    exit 2
  fi
done

# ---------- T1: Mapping completeness ----------
header "T1: Mapping completeness"
SDP_ROWS=$(awk '
  /^## SDP Mapping/{in_sdp=1; next}
  /^## SCM Mapping/{in_sdp=0; next}
  in_sdp && /^\| / && !/^\| Eastbourne/ && !/^\| ----/ {n++}
  END {print n+0}' "$MAP")
SCM_ROWS=$(awk '
  /^## SCM Mapping/{in_scm=1; next}
  /^## Glossary/{in_scm=0; next}
  in_scm && /^\| / && !/^\| Eastbourne/ && !/^\| ----/ {n++}
  END {print n+0}' "$MAP")
PLANNED_HITS=$(awk '
  /^## SDP Mapping/{in_t=1; next}
  /^## Glossary/{in_t=0; next}
  /^## SCM Mapping/{in_t=1; next}
  in_t && /^\| / && !/^\| Eastbourne/ && !/^\| ----/ && / planned /{n++}
  END {print n+0}' "$MAP")

T1_FAIL=0
if [[ "$SDP_ROWS" -eq 27 ]]; then
  echo "  SDP rows: $SDP_ROWS (expected 27)"
else
  echo "  SDP rows: $SDP_ROWS (expected 27) -- mismatch"
  T1_FAIL=1
fi
if [[ "$SCM_ROWS" -ge 51 ]]; then
  echo "  SCM rows: $SCM_ROWS (expected >= 51)"
else
  echo "  SCM rows: $SCM_ROWS (expected >= 51) -- mismatch"
  T1_FAIL=1
fi
if [[ "$PLANNED_HITS" -eq 0 ]]; then
  echo "  'planned' status entries in tables: 0"
else
  echo "  'planned' status entries in tables: $PLANNED_HITS (expected 0)"
  T1_FAIL=1
fi
if [[ "$T1_FAIL" -eq 0 ]]; then
  pass "section-mapping.md SDP=$SDP_ROWS, SCM=$SCM_ROWS, no planned rows"
else
  fail "T1 mapping completeness — see details above"
fi

# ---------- T2: Annotation coverage ----------
header "T2: Annotation coverage"
SDP_ANN=$(grep -c '^<!-- Maps to' "$SDP" || true)
SCM_ANN=$(grep -c '^<!-- Maps to' "$SCM" || true)
T2_FAIL=0
if [[ "$SDP_ANN" -ge 27 ]]; then
  echo "  pcas-sdp.md '<!-- Maps to' annotations: $SDP_ANN (>= 27)"
else
  echo "  pcas-sdp.md '<!-- Maps to' annotations: $SDP_ANN (expected >= 27)"
  T2_FAIL=1
fi
if [[ "$SCM_ANN" -ge 51 ]]; then
  echo "  pcas-scm.md '<!-- Maps to' annotations: $SCM_ANN (>= 51)"
else
  echo "  pcas-scm.md '<!-- Maps to' annotations: $SCM_ANN (expected >= 51)"
  T2_FAIL=1
fi
if [[ "$T2_FAIL" -eq 0 ]]; then
  pass "annotation coverage SDP=$SDP_ANN SCM=$SCM_ANN"
else
  fail "T2 annotation coverage — see details above"
fi

# ---------- T3: Dual-track explicitness ----------
header "T3: Dual-track explicitness"
T3_FAIL=0
SDP_414A=$(grep -c '4\.1\.4\.A' "$SDP" || true)
SDP_414B=$(grep -c '4\.1\.4\.B' "$SDP" || true)
SDP_SCRUM=$(grep -c -i 'Scrum' "$SDP" || true)
SDP_LK=$(grep -c -i 'Lean Kanban' "$SDP" || true)
SCM_524=$(grep -c '5\.2\.4' "$SCM" || true)
SCM_SCRUM=$(grep -c -i 'Scrum' "$SCM" || true)
SCM_LK=$(grep -c -i 'Lean Kanban' "$SCM" || true)

[[ "$SDP_414A" -ge 1 ]] || { echo "  pcas-sdp.md missing §4.1.4.A"; T3_FAIL=1; }
[[ "$SDP_414B" -ge 1 ]] || { echo "  pcas-sdp.md missing §4.1.4.B"; T3_FAIL=1; }
[[ "$SDP_SCRUM" -ge 1 ]] || { echo "  pcas-sdp.md missing 'Scrum'"; T3_FAIL=1; }
[[ "$SDP_LK" -ge 1 ]] || { echo "  pcas-sdp.md missing 'Lean Kanban'"; T3_FAIL=1; }
[[ "$SCM_524" -ge 1 ]] || { echo "  pcas-scm.md missing §5.2.4"; T3_FAIL=1; }
[[ "$SCM_SCRUM" -ge 1 ]] || { echo "  pcas-scm.md missing 'Scrum'"; T3_FAIL=1; }
[[ "$SCM_LK" -ge 1 ]] || { echo "  pcas-scm.md missing 'Lean Kanban'"; T3_FAIL=1; }

if [[ "$T3_FAIL" -eq 0 ]]; then
  pass "SDP §4.1.4.A=$SDP_414A §4.1.4.B=$SDP_414B; SCM §5.2.4=$SCM_524; both docs mention Scrum & Lean Kanban"
else
  fail "T3 dual-track explicitness — see details above"
fi

# ---------- T4: Bundle versioning ----------
header "T4: Bundle versioning"
T4_FAIL=0
SDP_GEN=$(grep -cE 'Gen<N>-|Gen2-3\.|Gen3-4\.' "$SDP" || true)
SCM_GEN=$(grep -cE 'Gen<N>-|Gen2-3\.|Gen3-4\.' "$SCM" || true)
SCM_LEGACY=$(grep -cE 'AAAA/BB/XX\.YY' "$SCM" || true)
SDP_LEGACY=$(grep -cE 'AAAA/BB/XX\.YY' "$SDP" || true)

[[ "$SDP_GEN" -ge 1 ]] || { echo "  pcas-sdp.md missing Gen<N>- patterns"; T4_FAIL=1; }
[[ "$SCM_GEN" -ge 1 ]] || { echo "  pcas-scm.md missing Gen<N>- patterns"; T4_FAIL=1; }
if [[ "$SCM_LEGACY" -le 1 ]]; then
  echo "  pcas-scm.md historical 'AAAA/BB/XX.YY' count: $SCM_LEGACY (<=1)"
else
  echo "  pcas-scm.md 'AAAA/BB/XX.YY' count: $SCM_LEGACY (expected <=1)"
  T4_FAIL=1
fi
if [[ "$SDP_LEGACY" -eq 0 ]]; then
  echo "  pcas-sdp.md historical 'AAAA/BB/XX.YY' count: 0"
else
  echo "  pcas-sdp.md 'AAAA/BB/XX.YY' count: $SDP_LEGACY (expected 0)"
  T4_FAIL=1
fi

if [[ "$T4_FAIL" -eq 0 ]]; then
  pass "SDP Gen pattern=$SDP_GEN SCM Gen pattern=$SCM_GEN; legacy SDP=0 SCM=$SCM_LEGACY"
else
  fail "T4 bundle versioning — see details above"
fi

# ---------- T5: Confluence URLs ----------
header "T5: Confluence URLs (HEAD)"
CONFLUENCE_IDS=(895680517 895746050 603062275 1039237122 985563137 1085636609)
if ! command -v curl >/dev/null 2>&1; then
  skip "T5 — curl not installed"
else
  # Probe network
  if ! curl -sI -o /dev/null --max-time 5 https://ac-avi.atlassian.net/ 2>/dev/null; then
    skip "T5 — network/Confluence unreachable (no VPN or DNS)"
  else
    T5_FAIL=0
    for id in "${CONFLUENCE_IDS[@]}"; do
      url="https://ac-avi.atlassian.net/wiki/spaces/NSST/pages/$id"
      # Try multiple spaces — some IDs are NSST, some ISP. Use generic page route.
      url_generic="https://ac-avi.atlassian.net/wiki/pages/viewpage.action?pageId=$id"
      code=$(curl -s -o /dev/null --max-time 10 -w "%{http_code}" -L "$url_generic" 2>/dev/null || echo "000")
      if [[ "$code" =~ ^(200|301|302|401|403)$ ]]; then
        echo "  $id -> HTTP $code (OK)"
      else
        echo "  $id -> HTTP $code (unexpected)"
        T5_FAIL=1
      fi
    done
    if [[ "$T5_FAIL" -eq 0 ]]; then
      pass "all 6 Confluence IDs resolved (200/30x/401/403 — auth-walled is expected for private wiki)"
    else
      fail "T5 — at least one Confluence ID returned an unexpected status; check details above"
    fi
  fi
fi

# ---------- T6: DOCX builds (conditional) ----------
header "T6: DOCX builds via pandoc"
T6_RAN=0
if ! command -v pandoc >/dev/null 2>&1; then
  skip "T6 — pandoc not installed (install: 'sudo apt-get install -y pandoc' / 'brew install pandoc'). Reviewers run 'make -C docs/standard all' separately."
else
  if (cd "$STD_DIR" && make all >/tmp/test-pandoc.log 2>&1); then
    if [[ -s "$DIST/pcas-sdp.docx" && -s "$DIST/pcas-scm.docx" ]]; then
      sz1=$(stat -c%s "$DIST/pcas-sdp.docx" 2>/dev/null || stat -f%z "$DIST/pcas-sdp.docx")
      sz2=$(stat -c%s "$DIST/pcas-scm.docx" 2>/dev/null || stat -f%z "$DIST/pcas-scm.docx")
      pass "dist/pcas-sdp.docx ($sz1 bytes) + dist/pcas-scm.docx ($sz2 bytes) built"
      T6_RAN=1
    else
      fail "T6 — pandoc ran but DOCX outputs missing or empty"
    fi
  else
    fail "T6 — 'make all' failed; see /tmp/test-pandoc.log"
  fi
fi

# ---------- T7: Markdownlint ----------
header "T7: Markdownlint"
LINTER=""
if command -v markdownlint-cli2 >/dev/null 2>&1; then
  LINTER="markdownlint-cli2"
elif command -v markdownlint >/dev/null 2>&1; then
  LINTER="markdownlint"
fi
if [[ -z "$LINTER" ]]; then
  skip "T7 — neither markdownlint nor markdownlint-cli2 installed (npm install -g markdownlint-cli2)"
else
  if "$LINTER" "$SDP" "$SCM" "$MAP" >/tmp/test-mdlint.log 2>&1; then
    pass "$LINTER clean on pcas-sdp.md, pcas-scm.md, section-mapping.md"
  else
    # Markdownlint warnings are common in long docs; report but treat as soft fail.
    fail "T7 — $LINTER reported issues; see /tmp/test-mdlint.log"
  fi
fi

# ---------- T8: NSST 603062275 Lean Kanban rules ----------
header "T8: NSST 603062275 Lean Kanban rules"
T8_FAIL=0

check_rule() {
  local file="$1" label="$2" pattern="$3"
  if grep -qE "$pattern" "$file"; then
    echo "  [$label] $file matches /$pattern/"
  else
    echo "  [$label] $file MISSING /$pattern/"
    T8_FAIL=1
  fi
}

# In SDP §4.1.4.B and SCM §5.2.4:
#   - WIP=2 (or 'WIP limit ... 2' or 'WIP=2' or 'WIP cap')
#   - twice-a-week or 15 min Sync
#   - weekly or 30 min Grooming
#   - 5 working day(s)
#   - Backlog (Hide)
for f in "$SDP" "$SCM"; do
  check_rule "$f" "WIP=2"          'WIP[ =]?2|WIP-?limit.*2|WIP.*=.*2|WIP cap.*2|WIP per engineer.*2|two-?per-?engineer'
  check_rule "$f" "Sync 15 min"    '15[ -]?min.*Sync|Sync.*15[ -]?min|twice[ -]?a[ -]?week|Twice[ -]?a[ -]?week|twice a week|Twice a week'
  check_rule "$f" "Grooming 30 min" '30[ -]?min.*Grooming|Grooming.*30[ -]?min|once[ -]?a[ -]?week|Once[ -]?a[ -]?week|weekly Grooming|Weekly Grooming|Once a week'
  check_rule "$f" "5 working day"   '5 working day'
  check_rule "$f" "Backlog (Hide)"  'Backlog \(Hide\)'
done

if [[ "$T8_FAIL" -eq 0 ]]; then
  pass "SDP §4.1.4.B + SCM §5.2.4 contain WIP=2, twice/15min Sync, weekly/30min Grooming, 5 working day, Backlog (Hide)"
else
  fail "T8 NSST 603062275 Lean Kanban rules — see details above"
fi

# ---------- T9: One SW principle ----------
header "T9: One SW principle"
T9_FAIL=0
for f in "$SDP" "$SCM"; do
  if grep -q 'One SW' "$f" && grep -q '895680517' "$f"; then
    echo "  $f contains 'One SW' and '895680517'"
  else
    echo "  $f MISSING 'One SW' and/or '895680517'"
    T9_FAIL=1
  fi
done
if [[ "$T9_FAIL" -eq 0 ]]; then
  pass "both docs reference 'One SW' and NSST 895680517"
else
  fail "T9 One SW — see details above"
fi

# ---------- T10: Eastbourne refer untouched ----------
header "T10: Eastbourne refer baseline checksums"
SDP_REFER="$STD_DIR/eastbourne.refer/Eastbourne Site Software Development Procedure (3).docx"
SCM_REFER="$STD_DIR/eastbourne.refer/Software Configuration Management Working Practice (2).docx"
# Baseline captured 2026-05-04 from b4c8360 commit.
EXPECTED_SDP_SHA="ec0b4d9a0cf7f1c0ae0f4fdb8feae02fae4be28448926d643b62d4ca210cdd04"
EXPECTED_SCM_SHA="9a8b327ae95b50c5f63f0b8a20e10ac92aef3370b9def1752c51e245266816af"

T10_FAIL=0
if [[ ! -f "$SDP_REFER" || ! -f "$SCM_REFER" ]]; then
  fail "T10 — eastbourne.refer/ DOCX files missing"
else
  ACTUAL_SDP_SHA=$(sha256sum "$SDP_REFER" | awk '{print $1}')
  ACTUAL_SCM_SHA=$(sha256sum "$SCM_REFER" | awk '{print $1}')
  if [[ "$ACTUAL_SDP_SHA" == "$EXPECTED_SDP_SHA" ]]; then
    echo "  SDP DOCX sha256 matches baseline"
  else
    echo "  SDP DOCX sha256 MISMATCH"
    echo "    expected: $EXPECTED_SDP_SHA"
    echo "    actual:   $ACTUAL_SDP_SHA"
    T10_FAIL=1
  fi
  if [[ "$ACTUAL_SCM_SHA" == "$EXPECTED_SCM_SHA" ]]; then
    echo "  SCM DOCX sha256 matches baseline"
  else
    echo "  SCM DOCX sha256 MISMATCH"
    echo "    expected: $EXPECTED_SCM_SHA"
    echo "    actual:   $ACTUAL_SCM_SHA"
    T10_FAIL=1
  fi
  if [[ "$T10_FAIL" -eq 0 ]]; then
    pass "both eastbourne.refer DOCX files match baseline sha256"
  else
    fail "T10 Eastbourne reference baseline — see details above"
  fi
fi

# ---------- E1: Intentionally omitted ----------
header "E1: Intentionally omitted sections"
SDP_OMIT=$(grep -c -i 'intentionally omitted' "$SDP" || true)
SCM_OMIT=$(grep -c -i 'intentionally omitted' "$SCM" || true)
MAP_OMIT=$(grep -c -i 'intentionally omitted' "$MAP" || true)
echo "  pcas-sdp.md: $SDP_OMIT"
echo "  pcas-scm.md: $SCM_OMIT"
echo "  section-mapping.md: $MAP_OMIT (legend row only is acceptable)"
pass "E1 informational — counts recorded (no required threshold)"

# ---------- E2: PCAS additions (§3.4 Lead Engineer) ----------
header "E2: PCAS additions"
E2_FAIL=0
if grep -qE '^### 3\.4 Lead Engineer' "$SCM"; then
  echo "  pcas-scm.md has '### 3.4 Lead Engineer' heading"
else
  echo "  pcas-scm.md MISSING '### 3.4 Lead Engineer' heading"
  E2_FAIL=1
fi
if grep -q 'Lead Engineer' "$MAP"; then
  echo "  section-mapping.md mentions 'Lead Engineer'"
else
  echo "  section-mapping.md MISSING 'Lead Engineer' reference"
  E2_FAIL=1
fi
if [[ "$E2_FAIL" -eq 0 ]]; then
  pass "§3.4 Lead Engineer present in pcas-scm.md and section-mapping.md"
else
  fail "E2 PCAS additions — see details above"
fi

# ---------- E3: Cross-doc references ----------
header "E3: Cross-doc references"
SDP2SCM=$(grep -cE '\]\(\.?/?pcas-scm\.md' "$SDP" || true)
SCM2SDP=$(grep -cE '\]\(\.?/?pcas-sdp\.md' "$SCM" || true)
echo "  pcas-sdp.md -> pcas-scm.md links: $SDP2SCM"
echo "  pcas-scm.md -> pcas-sdp.md links: $SCM2SDP"
# Anchored cross-doc links (#anchor) are not used in this revision — file-level
# links carry section numbers in prose ("§5.2.4"). Verify file-level link target
# resolves (file exists in same dir).
E3_FAIL=0
[[ "$SDP2SCM" -ge 1 ]] || { echo "  pcas-sdp.md has no link to pcas-scm.md"; E3_FAIL=1; }
[[ "$SCM2SDP" -ge 1 ]] || { echo "  pcas-scm.md has no link to pcas-sdp.md"; E3_FAIL=1; }
[[ -f "$SCM" ]] || { echo "  link target pcas-scm.md missing"; E3_FAIL=1; }
[[ -f "$SDP" ]] || { echo "  link target pcas-sdp.md missing"; E3_FAIL=1; }
if [[ "$E3_FAIL" -eq 0 ]]; then
  pass "cross-doc links present (sdp->scm=$SDP2SCM, scm->sdp=$SCM2SDP); link targets resolve"
else
  fail "E3 cross-doc references — see details above"
fi

# ---------- E4: HTML comments stripped from DOCX ----------
header "E4: HTML comments stripped from DOCX"
if [[ "$T6_RAN" -eq 0 ]]; then
  skip "E4 — depends on T6 (DOCX build) which did not run"
else
  if ! command -v unzip >/dev/null 2>&1; then
    skip "E4 — unzip not installed"
  else
    LEAK=$(unzip -p "$DIST/pcas-sdp.docx" word/document.xml 2>/dev/null | grep -c 'Maps to Eastbourne' || true)
    if [[ "$LEAK" -eq 0 ]]; then
      pass "no 'Maps to Eastbourne' annotation leaks into dist/pcas-sdp.docx"
    else
      fail "E4 — $LEAK annotation leaks into dist/pcas-sdp.docx"
    fi
  fi
fi

# ---------- summary ----------
echo ""
echo "============================================================"
echo "Total: $PASS_COUNT PASS, $FAIL_COUNT FAIL, $SKIP_COUNT SKIP"
echo "============================================================"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
exit 0
