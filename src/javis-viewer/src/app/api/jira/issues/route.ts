import { NextRequest, NextResponse } from "next/server";

import { getJiraIssuePage } from "@/lib/jira-issues";
import { DEFAULT_JIRA_ISSUE_PAGE_SIZE, parseCsvQueryParam } from "@/types/jira-list";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const data = await getJiraIssuePage({
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? String(DEFAULT_JIRA_ISSUE_PAGE_SIZE)),
      search: searchParams.get("search") ?? "",
      projects: parseCsvQueryParam(searchParams.get("project")),
      components: parseCsvQueryParam(searchParams.get("component")),
      assignees: parseCsvQueryParam(searchParams.get("assignee")),
      reporters: parseCsvQueryParam(searchParams.get("reporter")),
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching Jira issues page:", error);
    return NextResponse.json(
      { error: "Failed to fetch Jira issues" },
      { status: 500 }
    );
  }
}
