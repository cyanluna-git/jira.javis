// Team Member Stats Types

export type MemberRole = 'developer' | 'lead' | 'tester' | 'designer' | 'pm';

export interface TeamMember {
  id: string;
  account_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: MemberRole;
  team: string | null;
  skills: string[] | null;
  is_active: boolean;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberStats {
  id: string;
  member_id: string;
  period_type: 'sprint' | 'month' | 'quarter' | 'year' | null;
  period_id: string | null;

  // Development stats
  stories_completed: number;
  story_points_earned: number;
  bugs_fixed: number;
  tasks_completed: number;

  // Contribution stats
  reviews_given: number;
  reviews_received: number;
  tests_written: number;
  docs_written: number;

  // Quality stats
  bugs_introduced: number;
  rework_count: number;
  on_time_delivery: number;
  late_delivery: number;

  // Ratings (0-100 scale)
  development_score: number;
  review_score: number;
  testing_score: number;
  collaboration_score: number;

  // Overall stats
  maturity_level: number;
  contribution_score: number;
  velocity_avg: number;

  calculated_at: string;
}

export type TriggerType = 'story_completed' | 'bug_fixed' | 'review_done' | 'manual' | 'recalculate';

export interface MemberStatHistory {
  id: string;
  member_id: string;
  trigger_type: TriggerType;
  trigger_ref: string | null;
  stat_name: string;
  old_value: number | null;
  new_value: number | null;
  delta: number | null;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface ScoreAdjustments {
  development_score?: number;
  review_score?: number;
  testing_score?: number;
  collaboration_score?: number;
  [key: string]: number | undefined;
}

export interface ManagerEvaluation {
  id: string;
  member_id: string;
  evaluation_period: string;
  period_start: string | null;
  period_end: string | null;

  // Evaluation items (1-5 scale)
  technical_skill: number | null;
  communication: number | null;
  problem_solving: number | null;
  initiative: number | null;
  teamwork: number | null;

  // Comments
  strengths: string | null;
  improvements: string | null;
  notes: string | null;

  // Score adjustments
  score_adjustments: ScoreAdjustments | null;

  evaluated_by: string;
  evaluated_at: string;
}

// API Response types
export interface MemberWithStats extends TeamMember {
  stats: MemberStats | null;
}

export interface MemberRanking {
  id: string;
  account_id: string;
  display_name: string;
  role: MemberRole;
  team: string | null;
  skills: string[] | null;
  avatar_url: string | null;
  is_active: boolean;
  total_stories: number;
  total_points: number;
  total_bugs_fixed: number;
  contribution_score: number;
  maturity_level: number;
  rank_contribution: number;
  rank_points: number;
  last_activity_at: string | null;
}

export interface MemberDetail {
  member: TeamMember;
  cumulative_stats: MemberStats | null;
  sprint_stats: MemberStats[];
  recent_history: MemberStatHistory[];
  evaluations: ManagerEvaluation[];
}

// Form types for creating/updating
export interface CreateMemberInput {
  account_id: string;
  display_name: string;
  email?: string;
  avatar_url?: string;
  role?: MemberRole;
  team?: string;
  skills?: string[];
  joined_at?: string;
}

export interface UpdateMemberInput {
  display_name?: string;
  email?: string;
  role?: MemberRole;
  team?: string;
  skills?: string[];
  is_active?: boolean;
}

export interface UpdateStatsInput {
  reviews_given?: number;
  reviews_received?: number;
  tests_written?: number;
  docs_written?: number;
  bugs_introduced?: number;
  rework_count?: number;
}

export interface CreateEvaluationInput {
  evaluation_period: string;
  period_start?: string;
  period_end?: string;
  technical_skill?: number;
  communication?: number;
  problem_solving?: number;
  initiative?: number;
  teamwork?: number;
  strengths?: string;
  improvements?: string;
  notes?: string;
  score_adjustments?: ScoreAdjustments;
}

// Dashboard stat summary
export interface TeamStatsSummary {
  total_members: number;
  active_members: number;
  total_points_this_sprint: number;
  total_stories_this_sprint: number;
  avg_contribution_score: number;
  top_contributors: MemberRanking[];
}
