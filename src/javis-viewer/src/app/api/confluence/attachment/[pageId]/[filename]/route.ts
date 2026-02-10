import { NextRequest, NextResponse } from 'next/server';

const CONFLUENCE_BASE = process.env.JIRA_URL || 'https://ac-avi.atlassian.net';
const CONFLUENCE_EMAIL = process.env.JIRA_EMAIL || '';
const CONFLUENCE_TOKEN = process.env.JIRA_TOKEN || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string; filename: string }> }
) {
  try {
    const { pageId, filename } = await params;
    const decodedFilename = decodeURIComponent(filename);

    // First, get the attachment info to find the download URL
    const attachmentsUrl = `${CONFLUENCE_BASE}/wiki/api/v2/pages/${pageId}/attachments`;
    const authHeader = Buffer.from(`${CONFLUENCE_EMAIL}:${CONFLUENCE_TOKEN}`).toString('base64');

    const attachmentsRes = await fetch(attachmentsUrl, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
      },
    });

    if (!attachmentsRes.ok) {
      console.error('Failed to fetch attachments:', attachmentsRes.status);
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const attachmentsData = await attachmentsRes.json();
    const attachment = attachmentsData.results?.find(
      (att: { title: string }) => att.title === decodedFilename
    );

    if (!attachment) {
      console.error('Attachment not found:', decodedFilename);
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Get the download URL from the attachment
    const downloadUrl = attachment.downloadLink ||
      `${CONFLUENCE_BASE}/wiki/rest/api/content/${pageId}/child/attachment/${attachment.id}/download`;

    // Fetch the actual image
    const imageRes = await fetch(`${CONFLUENCE_BASE}/wiki${attachment.downloadLink}`, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
      },
    });

    if (!imageRes.ok) {
      // Try alternative download URL
      const altRes = await fetch(`${CONFLUENCE_BASE}/wiki/download/attachments/${pageId}/${encodeURIComponent(decodedFilename)}`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
        },
      });

      if (!altRes.ok) {
        console.error('Failed to fetch image:', altRes.status);
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
      }

      const imageBuffer = await altRes.arrayBuffer();
      const contentType = altRes.headers.get('content-type') || 'image/png';

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('content-type') || 'image/png';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
