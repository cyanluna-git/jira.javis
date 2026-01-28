// Confluence Types - Tree structure and AI suggestions

// ============================================
// Tree Structure Types
// ============================================

export type ContentType = 'page' | 'folder';

export interface ConfluencePage {
  id: string;
  type: ContentType;
  title: string;
  parent_id: string | null;
  space_id: string | null;
  labels: string[];
  body_storage: string;
  version: number;
  web_url: string;
  created_at: string | null;
  last_synced_at: string;
  // Tree optimization fields
  materialized_path: string | null;
  depth: number;
  child_count: number;
  is_orphan: boolean;
  orphan_reason: string | null;
  sort_order: number;
}

export interface ConfluenceTreeNode {
  id: string;
  title: string;
  type: ContentType;
  parent_id: string | null;
  depth: number;
  child_count: number;
  is_orphan: boolean;
  children: ConfluenceTreeNode[];
  // UI state
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface ConfluenceBreadcrumb {
  id: string;
  title: string;
  depth: number;
}

// ============================================
// AI Suggestion Types
// ============================================

export type SuggestionType = 'merge' | 'update' | 'restructure' | 'label' | 'archive' | 'split';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';

export interface AISuggestion {
  id: string;
  suggestion_type: SuggestionType;
  target_page_ids: string[];
  confidence_score: number | null;
  ai_reasoning: string | null;
  suggested_action: SuggestedAction;
  status: SuggestionStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  applied_at: string | null;
  operation_id: string | null;
}

export interface AISuggestionWithPages extends AISuggestion {
  target_pages: Array<{
    id: string;
    title: string;
    web_url: string;
  }>;
}

// Suggested action types for each suggestion type
export interface MergeSuggestion {
  primary_page_id: string;
  secondary_page_ids: string[];
  merged_title: string;
  merge_strategy: 'append' | 'interleave' | 'summarize';
}

export interface UpdateSuggestion {
  page_id: string;
  stale_sections: string[];
  suggested_updates: Array<{
    section: string;
    reason: string;
  }>;
}

export interface RestructureSuggestion {
  page_id: string;
  new_parent_id: string;
  reason: string;
}

export interface LabelSuggestion {
  page_id: string;
  add_labels: string[];
  remove_labels: string[];
  reasoning: string;
}

export interface ArchiveSuggestion {
  page_id: string;
  archive_reason: string;
  last_modified: string;
  no_recent_views: boolean;
}

export interface SplitSuggestion {
  page_id: string;
  proposed_splits: Array<{
    title: string;
    sections: string[];
  }>;
  reason: string;
}

export type SuggestedAction =
  | MergeSuggestion
  | UpdateSuggestion
  | RestructureSuggestion
  | LabelSuggestion
  | ArchiveSuggestion
  | SplitSuggestion;

// ============================================
// Label Taxonomy Types
// ============================================

export type LabelCategory = 'doc-type' | 'product' | 'status' | 'team' | 'priority';

export interface LabelTaxonomy {
  id: string;
  label_name: string;
  category: LabelCategory;
  color: string;
  description: string | null;
  synonyms: string[] | null;
  keyword_patterns: string[] | null;
  is_auto_suggested: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface LabelUsage {
  label: string;
  count: number;
  category?: LabelCategory;
  color?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface TreeQueryParams {
  parent_id?: string | null;
  depth?: number;
  include_orphans?: boolean;
}

export interface TreeResponse {
  nodes: ConfluenceTreeNode[];
  total_count: number;
  orphan_count: number;
}

export interface SuggestionQueryParams {
  type?: SuggestionType;
  status?: SuggestionStatus;
  limit?: number;
  offset?: number;
}

export interface SuggestionResponse {
  suggestions: AISuggestionWithPages[];
  total: number;
  by_type: Record<SuggestionType, number>;
  by_status: Record<SuggestionStatus, number>;
}

export interface SuggestionActionRequest {
  action: 'approve' | 'reject' | 'apply';
  reviewed_by?: string;
}

export interface TreeStats {
  total_pages: number;
  total_orphans: number;
  max_depth: number;
  avg_depth: number;
  pages_with_children: number;
}

// ============================================
// View Mode Types
// ============================================

export type ConfluenceViewMode = 'tree' | 'flat' | 'orphans' | 'suggestions';

// ============================================
// UI Constants
// ============================================

export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  merge: '병합',
  update: '업데이트',
  restructure: '재구조화',
  label: '라벨링',
  archive: '아카이브',
  split: '분할',
};

export const SUGGESTION_TYPE_ICONS: Record<SuggestionType, string> = {
  merge: 'git-merge',
  update: 'refresh-cw',
  restructure: 'move',
  label: 'tag',
  archive: 'archive',
  split: 'scissors',
};

export const SUGGESTION_TYPE_COLORS: Record<SuggestionType, string> = {
  merge: '#8B5CF6',     // purple
  update: '#3B82F6',    // blue
  restructure: '#F59E0B', // amber
  label: '#10B981',     // green
  archive: '#6B7280',   // gray
  split: '#EC4899',     // pink
};

export const SUGGESTION_STATUS_COLORS: Record<SuggestionStatus, string> = {
  pending: '#F59E0B',   // amber
  approved: '#10B981',  // green
  rejected: '#EF4444',  // red
  applied: '#3B82F6',   // blue
  expired: '#6B7280',   // gray
};

export const LABEL_CATEGORY_COLORS: Record<LabelCategory, string> = {
  'doc-type': '#3B82F6',  // blue
  'product': '#10B981',   // green
  'status': '#F59E0B',    // amber
  'team': '#8B5CF6',      // purple
  'priority': '#EF4444',  // red
};

export const LABEL_CATEGORY_LABELS: Record<LabelCategory, string> = {
  'doc-type': '문서 유형',
  'product': '제품',
  'status': '상태',
  'team': '팀',
  'priority': '우선순위',
};
