import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { Bundle, BundleResponse, BundleStats, BundleProgress, BundleDocument, BundleIssue } from '@/types/bundle';
import {
  extractBundleVersion,
  getGenerationFromVersion,
  determineBundleStatus,
  calculateProgressPercentage,
  compareBundleVersions,
  getBundleLabel,
  mapStatusToCategory,
} from '@/lib/bundle';

// GET /api/bundles - Fetch Bundle Epics with child issue stats and Confluence docs
// Optimized: 3 queries instead of N+1
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const generation = searchParams.get('generation') || 'all';
  const statusFilter = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';

  const client = await pool.connect();

  try {
    // ============================================
    // Query 1: Fetch all Bundle Epics from EUV project
    // ============================================
    const epicResult = await client.query(`
      SELECT
        key,
        summary,
        status,
        raw_data->'fields'->>'created' as created,
        raw_data->'fields'->>'updated' as updated
      FROM jira_issues
      WHERE project = 'EUV'
        AND raw_data->'fields'->'issuetype'->>'name' = 'Epic'
        AND summary LIKE 'Bundle %'
      ORDER BY summary DESC
    `);

    // Extract valid versions and build lookup maps
    const versionMap = new Map<string, typeof epicResult.rows[0]>();
    const allVersions: string[] = [];
    const allLabels: string[] = [];

    for (const row of epicResult.rows) {
      const version = extractBundleVersion(row.summary);
      if (!version) continue;

      const bundleGeneration = getGenerationFromVersion(version);

      // Pre-filter by generation
      if (generation !== 'all') {
        if (generation === 'gen2' && bundleGeneration !== 'gen2') continue;
        if (generation === 'gen3' && bundleGeneration !== 'gen3') continue;
      }

      // Pre-filter by search term
      if (search && !row.summary.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      versionMap.set(version, row);
      allVersions.push(version);
      allLabels.push(getBundleLabel(version));
    }

    // Early return if no versions match filters
    if (allVersions.length === 0) {
      return NextResponse.json({
        bundles: [],
        stats: { total: 0, active: 0, planning: 0, completed: 0, byGeneration: { gen2: 0, gen3: 0 } },
      });
    }

    // ============================================
    // Query 2: Fetch ALL issues for ALL versions in one query
    // ============================================
    const issuesResult = await client.query(`
      SELECT
        key,
        summary,
        status,
        raw_data->'fields'->'issuetype'->>'name' as issue_type,
        raw_data->'fields'->'assignee'->>'displayName' as assignee,
        raw_data->'fields'->'priority'->>'name' as priority,
        raw_data->'fields'->'fixVersions' as fix_versions
      FROM jira_issues
      WHERE project = 'EUV'
        AND raw_data->'fields'->'issuetype'->>'name' != 'Epic'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(raw_data->'fields'->'fixVersions') v
          WHERE v->>'name' = ANY($1)
        )
    `, [allVersions]);

    // Group issues by version
    const issuesByVersion = new Map<string, BundleIssue[]>();
    for (const version of allVersions) {
      issuesByVersion.set(version, []);
    }

    for (const row of issuesResult.rows) {
      // Parse fixVersions to find which bundle(s) this issue belongs to
      const fixVersions = row.fix_versions || [];
      for (const fv of fixVersions) {
        const versionName = fv.name;
        if (issuesByVersion.has(versionName)) {
          issuesByVersion.get(versionName)!.push({
            key: row.key,
            summary: row.summary,
            status: row.status,
            issueType: row.issue_type,
            assignee: row.assignee,
            priority: row.priority,
          });
        }
      }
    }

    // Sort issues within each bundle: In Progress first, then To Do, then others
    for (const [, issues] of issuesByVersion) {
      issues.sort((a, b) => {
        const order = (status: string) => {
          const s = status.toLowerCase();
          if (s === 'in progress') return 1;
          if (s === 'to do') return 2;
          return 3;
        };
        return order(a.status) - order(b.status) || a.key.localeCompare(b.key);
      });
    }

    // ============================================
    // Query 3: Fetch ALL Confluence documents for ALL versions in one query
    // ============================================
    // Build regex pattern that matches any of the versions with word boundaries
    // Using \y for PostgreSQL word boundary (equivalent to \b)
    const versionPatterns = allVersions.map(v => {
      const escaped = v.replace(/\./g, '\\.');
      return `\\y(B|Bundle\\s*)?${escaped}\\y`;
    });
    const combinedTitlePattern = versionPatterns.join('|');

    const docsResult = await client.query(`
      SELECT DISTINCT id, title, web_url, labels
      FROM confluence_v2_content
      WHERE type = 'page'
        AND (
          labels && $1
          OR title ~* $2
        )
      ORDER BY title
    `, [allLabels, combinedTitlePattern]);

    // Pre-compile RegExps for version matching (performance optimization)
    const versionMatchers = allVersions.map(version => ({
      version,
      label: getBundleLabel(version),
      // Use \b for word boundary to prevent partial matches (e.g., 1.0.0 matching 11.0.0)
      regex: new RegExp(`\\b(B|Bundle\\s*)?${version.replace(/\./g, '\\.')}\\b`, 'i'),
    }));

    // Group documents by version
    const docsByVersion = new Map<string, BundleDocument[]>();
    for (const version of allVersions) {
      docsByVersion.set(version, []);
    }

    for (const doc of docsResult.rows) {
      const docLabels: string[] = doc.labels || [];
      const docTitle: string = doc.title || '';

      // Use pre-compiled matchers for efficient matching
      for (const { version, label, regex } of versionMatchers) {
        if (docLabels.includes(label) || regex.test(docTitle)) {
          docsByVersion.get(version)!.push({
            id: doc.id,
            title: doc.title,
            url: doc.web_url || '',
          });
        }
      }
    }

    // ============================================
    // Build final bundle objects with filtering
    // ============================================
    const bundles: Bundle[] = [];
    const statsMap = {
      total: 0,
      active: 0,
      planning: 0,
      completed: 0,
      byGeneration: { gen2: 0, gen3: 0 },
    };

    for (const version of allVersions) {
      const row = versionMap.get(version)!;
      const bundleGeneration = getGenerationFromVersion(version);
      const issues = issuesByVersion.get(version) || [];
      const documents = docsByVersion.get(version) || [];

      // Calculate progress
      const progress: BundleProgress = {
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
        percentage: 0,
      };

      for (const issue of issues) {
        const category = mapStatusToCategory(issue.status);
        progress[category]++;
        progress.total++;
      }
      progress.percentage = calculateProgressPercentage(progress.done, progress.total);

      // Determine bundle status
      const bundleStatus = determineBundleStatus(row.status, progress);

      // Filter by status if specified
      if (statusFilter !== 'all' && bundleStatus !== statusFilter) {
        continue;
      }

      const bundle: Bundle = {
        key: row.key,
        version,
        summary: row.summary,
        status: row.status,
        generation: bundleGeneration,
        progress,
        issues,
        documents,
        created: row.created,
        updated: row.updated,
      };

      bundles.push(bundle);

      // Update stats
      statsMap.total++;
      statsMap.byGeneration[bundleGeneration]++;
      if (bundleStatus === 'active') statsMap.active++;
      else if (bundleStatus === 'planning') statsMap.planning++;
      else if (bundleStatus === 'completed') statsMap.completed++;
    }

    // Sort bundles by version (newest first)
    bundles.sort((a, b) => compareBundleVersions(a.version, b.version));

    const response: BundleResponse = {
      bundles,
      stats: statsMap as BundleStats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
