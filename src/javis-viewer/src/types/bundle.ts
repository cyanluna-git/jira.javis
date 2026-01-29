// Bundle Board Types - EUV Bundle version management

export type BundleGeneration = 'gen2' | 'gen3';
export type BundleStatus = 'planning' | 'active' | 'completed';

// Bundle - Represents a Jira Epic with "Bundle X.X.X" naming
export interface Bundle {
  key: string;           // Epic key (EUV-123)
  version: string;       // Version number (3.10.0, 4.1.0)
  summary: string;       // Full summary (Bundle 3.10.0)
  status: string;        // Epic status from Jira
  generation: BundleGeneration;
  progress: BundleProgress;
  issues: BundleIssue[];
  documents: BundleDocument[];
  created: string;
  updated: string;
}

// Issue linked to bundle via fixVersions
export interface BundleIssue {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  assignee: string | null;
  priority: string | null;
}

// Progress tracking for bundle child issues
export interface BundleProgress {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  percentage: number;
}

// Confluence document linked to bundle via label
export interface BundleDocument {
  id: string;
  title: string;
  url: string;
}

// Statistics summary for bundle board
export interface BundleStats {
  total: number;
  active: number;
  planning: number;
  completed: number;
  byGeneration: {
    gen2: number;
    gen3: number;
  };
}

// API Response type
export interface BundleResponse {
  bundles: Bundle[];
  stats: BundleStats;
}

// Query parameters for API
export interface BundleQueryParams {
  generation?: 'all' | 'gen2' | 'gen3';
  status?: 'all' | 'active' | 'planning' | 'completed';
  search?: string;
}

// Status color mappings for UI
export const BUNDLE_STATUS_COLORS: Record<BundleStatus, string> = {
  planning: '#6B7280',  // gray
  active: '#3B82F6',    // blue
  completed: '#10B981', // green
};

// Generation color mappings
export const GENERATION_COLORS: Record<BundleGeneration, string> = {
  gen2: '#8B5CF6', // purple
  gen3: '#F59E0B', // amber
};

// Generation labels for UI
export const GENERATION_LABELS: Record<BundleGeneration, string> = {
  gen2: 'Gen2/Gen2+ (3.x)',
  gen3: 'Gen3/Gen3+ (4.x)',
};
