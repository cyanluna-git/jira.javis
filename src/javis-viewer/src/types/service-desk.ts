// Service Desk Types - PSSM Ticket Queue

export type BusinessUnit = 'all' | 'integrated-systems' | 'abatement';

// Business Unit Component Mapping
export const BUSINESS_UNIT_COMPONENTS: Record<Exclude<BusinessUnit, 'all'>, string[]> = {
  'integrated-systems': [
    'EUV Gen3/Gen3+',
    'EUV Gen2/Gen2+',
    'H2D',
    'EUVGen4 Tumalo',
    'Proteus',
    'EUVHalo Mk1',
    'HRS',
    'Havasu Etch',
  ],
  'abatement': [
    'Abatement-Wet',
    'Abatement-Plasma',
    'Abatement-Burn',
  ],
};

export const BUSINESS_UNIT_LABELS: Record<BusinessUnit, string> = {
  'all': 'All',
  'integrated-systems': 'Integrated Systems',
  'abatement': 'Abatement',
};

// Comment interface
export interface ServiceDeskComment {
  id: string;
  author: string;
  author_display_name: string;
  body: string;
  created: string;
}

// Ticket interface
export interface ServiceDeskTicket {
  key: string;
  summary: string;
  status: string;
  priority: string | null;
  reporter: string | null;
  reporter_display_name: string | null;
  assignee: string | null;
  assignee_display_name: string | null;
  components: string[];
  description: string | null;
  comments: ServiceDeskComment[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

// Statistics
export interface ServiceDeskStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  resolvedPercent: number;
  byStatus: { status: string; count: number }[];
  byComponent: { component: string; count: number }[];
}

// Filter options
export interface ServiceDeskFilterOptions {
  statuses: string[];
  assignees: { accountId: string; displayName: string }[];
  priorities: string[];
}

// Pagination
export interface ServiceDeskPagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

// API Response
export interface ServiceDeskResponse {
  tickets: ServiceDeskTicket[];
  stats: ServiceDeskStats;
  filterOptions: ServiceDeskFilterOptions;
  pagination?: ServiceDeskPagination;
  tabCounts?: Record<BusinessUnit, number>;
}

// Helper to get status color (case-insensitive)
export function getStatusColor(status: string): string {
  const normalized = status.toUpperCase();
  return STATUS_COLOR_MAP[normalized] || '#6B7280';
}

// Helper to get priority color (case-insensitive)
export function getPriorityColor(priority: string): string {
  const normalized = priority.toLowerCase();
  const map: Record<string, string> = {
    'highest': '#DC2626',
    'high': '#F97316',
    'medium': '#F59E0B',
    'low': '#3B82F6',
    'lowest': '#6B7280',
  };
  return map[normalized] || '#6B7280';
}

// Status color mappings (normalized to uppercase for lookup)
const STATUS_COLOR_MAP: Record<string, string> = {
  'BACKLOG': '#6B7280',
  'TO DO': '#6B7280',
  'OPEN': '#6B7280',
  'IN PROGRESS': '#3B82F6',
  'IN STAGING': '#8B5CF6',
  'IN REVIEW': '#F59E0B',
  'TESTING': '#F59E0B',
  'DONE': '#10B981',
  'CLOSED': '#10B981',
  'RESOLVED': '#10B981',
  'COMPLETE': '#10B981',
  'COMPLETED': '#10B981',
};

// Chart colors
export const CHART_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280', // gray
  '#EF4444', // red
  '#14B8A6', // teal
];
