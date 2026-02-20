export interface Board {
  id: number;
  name: string;
  type: string;
  project_key: string;
}

export interface Sprint {
  id: number;
  board_id: number;
  name: string;
  state: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  confluence_labels?: string[];
}

export interface SprintIssue {
  key: string;
  summary: string;
  status: string;
  project: string;
  raw_data: any;
  // Bidirectional sync fields
  local_modified_at?: string | null;
  local_modified_fields?: string[] | null;
  last_synced_at?: string | null;
}

export interface Assignee {
  name: string;
  count: number;
  avatarUrl?: string | null;
}

export interface IssueStats {
  todo: number;
  inProgress: number;
  done: number;
  totalPoints: number;
  donePoints: number;
}
