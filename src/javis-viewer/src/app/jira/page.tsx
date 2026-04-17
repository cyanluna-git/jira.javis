import JiraContent from "./JiraContent";
import { NavigationButtons } from "@/components/NavigationButtons";
import {
  getJiraIssueFilterOptions,
  getJiraIssuePage,
  normalizeJiraIssueQueryState,
} from "@/lib/jira-issues";
import {
  DEFAULT_JIRA_ISSUE_PAGE_SIZE,
  parseCsvQueryParam,
  type JiraIssueQueryState,
} from "@/types/jira-list";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    page?: string | string[];
    limit?: string | string[];
    search?: string | string[];
    project?: string | string[];
    component?: string | string[];
    assignee?: string | string[];
    reporter?: string | string[];
  }>;
}

function parseInitialQueryState(params: Awaited<PageProps["searchParams"]>): JiraIssueQueryState {
  return normalizeJiraIssueQueryState({
    page: Number(Array.isArray(params.page) ? params.page[0] ?? "1" : params.page ?? "1"),
    limit: Number(Array.isArray(params.limit) ? params.limit[0] ?? String(DEFAULT_JIRA_ISSUE_PAGE_SIZE) : params.limit ?? String(DEFAULT_JIRA_ISSUE_PAGE_SIZE)),
    search: Array.isArray(params.search) ? params.search[0] ?? "" : params.search ?? "",
    projects: parseCsvQueryParam(params.project),
    components: parseCsvQueryParam(params.component),
    assignees: parseCsvQueryParam(params.assignee),
    reporters: parseCsvQueryParam(params.reporter),
  });
}

export default async function JiraPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialQuery = parseInitialQueryState(params);
  const [initialData, filterOptions] = await Promise.all([
    getJiraIssuePage(initialQuery),
    getJiraIssueFilterOptions(),
  ]);
  const resolvedInitialQuery: JiraIssueQueryState = {
    ...initialQuery,
    page: initialData.page,
    limit: initialData.limit,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="mx-auto px-4">
        <div className="mb-8 flex items-center gap-4">
            <NavigationButtons />
            <h1 className="text-3xl font-bold text-gray-900">Jira Issues</h1>
        </div>

        <JiraContent
          initialData={initialData}
          filterOptions={filterOptions}
          initialQuery={resolvedInitialQuery}
        />
      </div>
    </div>
  );
}
