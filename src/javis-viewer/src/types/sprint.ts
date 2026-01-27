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
}

export interface SprintIssue {
  key: string;
  summary: string;
  status: string;
  project: string;
  raw_data: any;
}

export interface Assignee {
  name: string;
  count: number;
}

export interface IssueStats {
  todo: number;
  inProgress: number;
  done: number;
  totalPoints: number;
  donePoints: number;
}
