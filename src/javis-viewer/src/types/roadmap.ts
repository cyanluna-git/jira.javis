// Roadmap Types - Vision/Milestone/Stream 3-tier hierarchy

export type VisionStatus = 'active' | 'achieved' | 'archived';
export type MilestoneStatus = 'planned' | 'in_progress' | 'completed' | 'delayed' | 'blocked';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type StreamCategory = 'backend' | 'frontend' | 'infra' | 'design' | 'qa';

// Vision - Top level strategic goal (Why)
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
