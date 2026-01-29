// Roadmap Types - Vision/Milestone/Stream 3-tier hierarchy

export type VisionStatus = 'active' | 'achieved' | 'archived';
export type MilestoneStatus = 'planned' | 'in_progress' | 'completed' | 'delayed' | 'blocked';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type StreamCategory = 'backend' | 'frontend' | 'infra' | 'design' | 'qa';
export type RiskType = 'delay' | 'blocker' | 'resource_conflict' | 'dependency_block' | 'velocity_drop';
export type RiskStatus = 'open' | 'acknowledged' | 'mitigated' | 'resolved' | 'false_positive';

// Vision - Top level strategic goal (Why)
// Vision acts as a "Project" in Javis roadmap system
// project_key = Jira project space (EUV, ASP, PSSM)
// title = Actual project name (OQC Digitalization, Unify, etc.)
// jql_filter = JQL to filter related issues from Jira
export interface Vision {
  id: string;
  project_key: string;
  title: string;
  description: string | null;
  north_star_metric: string | null;
  north_star_target: number | null;
  north_star_current: number | null;
  target_date: string | null;
  status: VisionStatus;
  owner_account_id: string | null;
  jql_filter: string | null;
  created_at: string;
  updated_at: string;
}

// Vision with aggregated milestone data
export interface VisionWithMilestones extends Vision {
  milestones: MilestoneWithStreams[];
  milestone_count: number;
  completed_milestones: number;
  overall_progress: number;
}

// Milestone - Deliverable to achieve vision (What)
export interface Milestone {
  id: string;
  vision_id: string;
  title: string;
  description: string | null;
  quarter: string | null;
  progress_percent: number;
  status: MilestoneStatus;
  risk_level: RiskLevel;
  depends_on: string[] | null;
  target_start: string | null;
  target_end: string | null;
  owner_account_id: string | null;
  created_at: string;
  updated_at: string;
}

// Milestone with streams and epic links
export interface MilestoneWithStreams extends Milestone {
  streams: Stream[];
  epic_links: EpicLink[];
  vision_title?: string;
}

// Stream - Execution track within a milestone (How)
export interface Stream {
  id: string;
  milestone_id: string;
  name: string;
  category: StreamCategory;
  color: string | null;
  progress_percent: number;
  owner_account_id: string | null;
  created_at: string;
}

// Epic link - Connection between milestone/stream and Jira Epic
export interface EpicLink {
  id: string;
  milestone_id: string;
  stream_id: string | null;
  epic_key: string;
  last_synced_at: string | null;
  created_at: string;
}

// API Input types
export interface CreateVisionInput {
  project_key: string;
  title: string;
  description?: string;
  north_star_metric?: string;
  north_star_target?: number;
  north_star_current?: number;
  target_date?: string;
  owner_account_id?: string;
  jql_filter?: string;
}

export interface UpdateVisionInput {
  title?: string;
  description?: string;
  north_star_metric?: string;
  north_star_target?: number;
  north_star_current?: number;
  target_date?: string;
  status?: VisionStatus;
  owner_account_id?: string;
  jql_filter?: string;
}

export interface CreateMilestoneInput {
  vision_id: string;
  title: string;
  description?: string;
  quarter?: string;
  status?: MilestoneStatus;
  risk_level?: RiskLevel;
  depends_on?: string[];
  target_start?: string;
  target_end?: string;
  owner_account_id?: string;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  quarter?: string;
  progress_percent?: number;
  status?: MilestoneStatus;
  risk_level?: RiskLevel;
  depends_on?: string[];
  target_start?: string;
  target_end?: string;
  owner_account_id?: string;
}

export interface CreateStreamInput {
  milestone_id: string;
  name: string;
  category: StreamCategory;
  color?: string;
  owner_account_id?: string;
}

export interface LinkEpicInput {
  epic_key: string;
  stream_id?: string;
}

// Dashboard summary stats
export interface RoadmapSummary {
  total_visions: number;
  active_visions: number;
  total_milestones: number;
  milestones_by_status: Record<MilestoneStatus, number>;
  milestones_at_risk: number;
  overall_progress: number;
}

// Quarterly view grouping
export interface QuarterlyMilestones {
  quarter: string;
  milestones: MilestoneWithStreams[];
}

// Status color mappings for UI
export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  planned: '#6B7280',     // gray
  in_progress: '#3B82F6', // blue
  completed: '#10B981',   // green
  delayed: '#F59E0B',     // amber
  blocked: '#EF4444',     // red
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: '#10B981',      // green
  medium: '#F59E0B',   // amber
  high: '#F97316',     // orange
  critical: '#EF4444', // red
};

export const STREAM_CATEGORY_COLORS: Record<StreamCategory, string> = {
  backend: '#8B5CF6',  // purple
  frontend: '#3B82F6', // blue
  infra: '#6B7280',    // gray
  design: '#EC4899',   // pink
  qa: '#10B981',       // green
};

// Risk Types for AI Risk Detection
export interface Risk {
  id: string;
  milestone_id: string;
  stream_id: string | null;
  epic_key: string | null;
  risk_type: RiskType;
  severity: RiskLevel;
  title: string;
  description: string | null;
  detected_at: string;
  status: RiskStatus;
  resolved_at: string | null;
  resolution_note: string | null;
  ai_suggestion: string | null;
  confidence_score: number | null;
  trigger_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RiskWithContext extends Risk {
  milestone_title?: string;
  stream_name?: string;
  vision_title?: string;
}

export interface RiskSummary {
  total_risks: number;
  open_risks: number;
  by_severity: Record<RiskLevel, number>;
  by_type: Record<RiskType, number>;
}

export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  delay: '일정 지연',
  blocker: '차단 이슈',
  resource_conflict: '리소스 충돌',
  dependency_block: '의존성 차단',
  velocity_drop: '속도 저하',
};

export const RISK_TYPE_ICONS: Record<RiskType, string> = {
  delay: 'clock',
  blocker: 'x-circle',
  resource_conflict: 'users',
  dependency_block: 'git-branch',
  velocity_drop: 'trending-down',
};

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  open: '열림',
  acknowledged: '인지됨',
  mitigated: '완화됨',
  resolved: '해결됨',
  false_positive: '오탐',
};

// Issue hierarchy types for Vision -> Milestone -> Epic -> Issue view
export interface IssueBasic {
  key: string;
  summary: string;
  status: string;
  type: string;
  assignee?: string;
}

export interface EpicStats {
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  progress_percent: number;
}

export interface EpicWithIssues {
  key: string;
  summary: string;
  status: string;
  milestone_id?: string;
  milestone_title?: string;
  issues: IssueBasic[];
  stats: EpicStats;
}

export interface VisionIssuesResponse {
  linked_epics: EpicWithIssues[];
  unlinked_epics: EpicWithIssues[];
  jql_filter: string | null;
}

// Local Epic types (Draft epics before Jira sync)
export type LocalEpicStatus = 'draft' | 'ready' | 'synced';

export interface LocalEpic {
  id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  priority: string;
  status: LocalEpicStatus;
  jira_key: string | null;
  story_points: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  milestone_title?: string;
  vision_title?: string;
  project_key?: string;
}

export interface CreateLocalEpicInput {
  milestone_id: string;
  title: string;
  description?: string;
  assignee?: string;
  priority?: string;
  story_points?: number;
  sort_order?: number;
}

export interface UpdateLocalEpicInput {
  title?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  status?: LocalEpicStatus;
  story_points?: number;
  sort_order?: number;
  jira_key?: string;
}

// Vision Member Types (Project-level role assignments)
export type RoleCategory = 'pm' | 'backend' | 'frontend' | 'plc' | 'qa' | 'scenario' | 'devops' | 'fullstack';

export interface VisionMember {
  id: string;
  vision_id: string;
  member_account_id: string;
  role_title: string;
  role_category: RoleCategory | null;
  role_description: string | null;
  mm_allocation: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from team_members
  display_name?: string;
  avatar_url?: string;
  email?: string;
  company_role?: string;
  team?: string;
  skills?: string[];
}

export interface CreateVisionMemberInput {
  member_account_id: string;
  role_title: string;
  role_category?: RoleCategory;
  role_description?: string;
  mm_allocation?: number;
  start_date?: string;
  end_date?: string;
}

export interface UpdateVisionMemberInput {
  role_title?: string;
  role_category?: RoleCategory | null;
  role_description?: string | null;
  mm_allocation?: number | null;
  start_date?: string | null;
  end_date?: string | null;
}

export const ROLE_CATEGORY_LABELS: Record<RoleCategory, string> = {
  pm: '프로젝트 관리',
  backend: '백엔드',
  frontend: '프론트엔드',
  plc: 'PLC/제어',
  qa: 'QA/테스트',
  scenario: '시나리오',
  devops: 'DevOps',
  fullstack: '풀스택',
};

export const ROLE_CATEGORY_COLORS: Record<RoleCategory, string> = {
  pm: '#8B5CF6',       // purple
  backend: '#3B82F6',  // blue
  frontend: '#10B981', // green
  plc: '#F59E0B',      // amber
  qa: '#EC4899',       // pink
  scenario: '#6366F1', // indigo
  devops: '#6B7280',   // gray
  fullstack: '#14B8A6',// teal
};
