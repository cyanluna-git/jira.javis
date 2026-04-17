import { NextResponse } from "next/server";

import { getJiraIssueFilterOptions } from "@/lib/jira-issues";

export async function GET() {
  try {
    const data = await getJiraIssueFilterOptions();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error fetching Jira filter options:", error);
    return NextResponse.json(
      { error: "Failed to fetch Jira filter options" },
      { status: 500 }
    );
  }
}
