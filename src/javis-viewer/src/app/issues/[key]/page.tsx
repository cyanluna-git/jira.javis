import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import IssueFullPage from './IssueFullPage';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ key: string }>;
}

export default async function IssuePage({ params }: PageProps) {
  const { key } = await params;

  const client = await pool.connect();
  let issue: { key: string; summary: string; status: string; project: string; raw_data: unknown } | null = null;

  try {
    const result = await client.query(
      `SELECT key, project, summary, status, raw_data
       FROM jira_issues
       WHERE key = $1`,
      [key]
    );
    if (result.rows.length > 0) {
      issue = result.rows[0];
    }
  } catch (error) {
    console.error('Error fetching issue:', error);
  } finally {
    client.release();
  }

  if (!issue) {
    notFound();
  }

  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_URL ?? null;

  return <IssueFullPage issue={issue} jiraBaseUrl={jiraBaseUrl} />;
}
