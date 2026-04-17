export const DEFAULT_JIRA_ISSUE_PAGE_SIZE = 50;

export interface JiraIssueComponent {
  name?: string | null;
}

export interface JiraIssueListItem {
  key: string;
  summary: string;
  status: string;
  project: string;
  created_at: string;
  components: JiraIssueComponent[];
  assignee: string | null;
  reporter: string | null;
}

export interface FilterOption {
  label: string;
  count: number;
}

export interface JiraIssueFilterOptions {
  projects: FilterOption[];
  components: FilterOption[];
  assignees: FilterOption[];
  reporters: FilterOption[];
}

export interface JiraIssueQueryState {
  page: number;
  limit: number;
  search: string;
  projects: string[];
  components: string[];
  assignees: string[];
  reporters: string[];
}

export interface JiraIssueListResponse {
  items: JiraIssueListItem[];
  total: number;
  page: number;
  limit: number;
}

export function parseCsvQueryParam(value?: string | string[] | null): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => item.split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
