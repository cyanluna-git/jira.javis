import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const JIRA_BASE = process.env.JIRA_URL || 'https://ac-avi.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string; filename: string }> }
) {
  try {
    const { issueKey, filename } = await params;
    const decodedFilename = decodeURIComponent(filename);
    const authHeader = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

    // First, try to get attachment info from local DB
    const client = await pool.connect();
    let attachmentUrl: string | null = null;
    let mimeType: string = 'application/octet-stream';

    try {
      const result = await client.query(
        `SELECT raw_data->'fields'->'attachment' as attachments
         FROM jira_issues WHERE key = $1`,
        [issueKey]
      );

      if (result.rows.length > 0 && result.rows[0].attachments) {
        const attachments = result.rows[0].attachments;
        const attachment = attachments.find(
          (att: any) => att.filename === decodedFilename
        );

        if (attachment) {
          attachmentUrl = attachment.content;
          mimeType = attachment.mimeType || 'application/octet-stream';
        }
      }
    } finally {
      client.release();
    }

    // If not found in DB, try to fetch from Jira API directly
    if (!attachmentUrl) {
      const issueResponse = await fetch(
        `${JIRA_BASE}/rest/api/3/issue/${issueKey}?fields=attachment`,
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Accept': 'application/json',
          },
        }
      );

      if (issueResponse.ok) {
        const issueData = await issueResponse.json();
        const attachments = issueData.fields?.attachment || [];
        const attachment = attachments.find(
          (att: any) => att.filename === decodedFilename
        );

        if (attachment) {
          attachmentUrl = attachment.content;
          mimeType = attachment.mimeType || 'application/octet-stream';
        }
      }
    }

    if (!attachmentUrl) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Fetch the actual attachment content
    const attachmentResponse = await fetch(attachmentUrl, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
      },
    });

    if (!attachmentResponse.ok) {
      console.error('Failed to fetch attachment:', attachmentResponse.status);
      return NextResponse.json(
        { error: 'Failed to fetch attachment' },
        { status: attachmentResponse.status }
      );
    }

    const buffer = await attachmentResponse.arrayBuffer();
    const contentType = attachmentResponse.headers.get('content-type') || mimeType;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        'Content-Disposition': `inline; filename="${decodedFilename}"`,
      },
    });
  } catch (error) {
    console.error('Error fetching Jira attachment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
