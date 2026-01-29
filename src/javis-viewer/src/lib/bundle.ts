// Bundle utility functions

import { BundleGeneration, BundleStatus, BundleProgress } from '@/types/bundle';

/**
 * Extract version number from bundle summary
 * @param summary - Full summary like "Bundle 3.10.0" or "Bundle 4.1.0"
 * @returns Version string like "3.10.0" or null if not found
 */
export function extractBundleVersion(summary: string): string | null {
  const match = summary.match(/Bundle\s+(\d+\.\d+\.\d+)/i);
  return match ? match[1] : null;
}

/**
 * Determine generation from version number
 * Gen2/Gen2+ uses 3.x.x versions
 * Gen3/Gen3+ uses 4.x.x versions
 * @param version - Version string like "3.10.0" or "4.1.0"
 * @returns Generation type
 */
export function getGenerationFromVersion(version: string): BundleGeneration {
  const majorVersion = parseInt(version.split('.')[0], 10);
  return majorVersion >= 4 ? 'gen3' : 'gen2';
}

/**
 * Determine bundle status based on progress and epic status
 * @param epicStatus - Status from Jira Epic
 * @param progress - Progress object with issue counts
 * @returns Bundle status
 */
export function determineBundleStatus(
  epicStatus: string,
  progress: BundleProgress
): BundleStatus {
  const normalizedStatus = epicStatus.toLowerCase();

  // If epic is marked as done/closed, it's completed
  if (normalizedStatus === 'done' || normalizedStatus === 'closed') {
    return 'completed';
  }

  // If all issues are done, it's completed
  if (progress.total > 0 && progress.done === progress.total) {
    return 'completed';
  }

  // If there are any in-progress issues, it's active
  if (progress.inProgress > 0 || progress.done > 0) {
    return 'active';
  }

  // Otherwise it's in planning
  return 'planning';
}

/**
 * Calculate progress percentage
 * @param done - Number of done issues
 * @param total - Total number of issues
 * @returns Percentage (0-100)
 */
export function calculateProgressPercentage(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

/**
 * Generate Confluence label from bundle version
 * Confluence doesn't allow periods in labels, so we use hyphens
 * @param version - Version string like "3.10.0"
 * @returns Label string like "bundle-3-10-0"
 */
export function getBundleLabel(version: string): string {
  return `bundle-${version.replace(/\./g, '-')}`;
}

/**
 * Parse Confluence URL from content ID
 * @param contentId - Confluence content ID
 * @param baseUrl - Base Confluence URL
 * @returns Full page URL
 */
export function getConfluencePageUrl(contentId: string, baseUrl: string): string {
  return `${baseUrl}/wiki/spaces/viewpage.action?pageId=${contentId}`;
}

/**
 * Sort bundles by version (descending - newest first)
 * @param a - First bundle version
 * @param b - Second bundle version
 * @returns Sort order
 */
export function compareBundleVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) {
      return numB - numA; // Descending order
    }
  }
  return 0;
}

/**
 * Map Jira issue status to progress category
 * @param status - Jira issue status
 * @returns Category: 'done', 'inProgress', or 'todo'
 */
export function mapStatusToCategory(status: string): 'done' | 'inProgress' | 'todo' {
  const normalizedStatus = status.toLowerCase();

  // Done statuses
  if (['done', 'closed', 'resolved', 'complete', 'completed'].includes(normalizedStatus)) {
    return 'done';
  }

  // In Progress statuses
  if (['in progress', 'in review', 'review', 'testing', 'qa', 'in development'].includes(normalizedStatus)) {
    return 'inProgress';
  }

  // Everything else is todo
  return 'todo';
}
