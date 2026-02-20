import { NextRequest, NextResponse } from 'next/server';

const CONFLUENCE_BASE = process.env.JIRA_URL || 'https://ac-avi.atlassian.net';
const CONFLUENCE_EMAIL = process.env.JIRA_EMAIL || '';
const CONFLUENCE_TOKEN = process.env.JIRA_TOKEN || '';
const MEDIA_API_BASE = 'https://api.media.atlassian.com';

interface Attachment {
  id: string;
  title: string;
  mediaType: string;
  fileId: string;
  fileSize: number;
  downloadLink: string;
}

function buildAuthHeader(): string {
  return Buffer.from(`${CONFLUENCE_EMAIL}:${CONFLUENCE_TOKEN}`).toString('base64');
}

/**
 * Strategy 1: Download via Confluence download URL with manual redirect handling.
 * Images redirect to api.media.atlassian.com with a file-scoped JWT token.
 * Videos return 401 on this path (Confluence Cloud limitation).
 */
async function tryDownloadRedirect(
  downloadLink: string,
  authHeader: string,
): Promise<Response | null> {
  const downloadUrl = `${CONFLUENCE_BASE}/wiki${downloadLink}`;

  const res = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'X-Atlassian-Token': 'no-check',
    },
    redirect: 'manual',
  });

  if (res.status === 302) {
    const location = res.headers.get('location');
    if (location && location.includes(MEDIA_API_BASE)) {
      // Redirect to api.media.atlassian.com — follow without auth header (token is in URL)
      const mediaRes = await fetch(location);
      if (mediaRes.ok) return mediaRes;
    }
  }

  if (res.ok) return res;
  return null;
}

/**
 * Strategy 2: Use api.media.atlassian.com directly with file-scoped JWT.
 * Get the JWT by extracting it from a download redirect for the same file.
 * This works for images but not videos (videos return 401 on download URL).
 */
async function tryMediaApiWithRedirectToken(
  attachment: Attachment,
  authHeader: string,
): Promise<Response | null> {
  const downloadUrl = `${CONFLUENCE_BASE}/wiki${attachment.downloadLink}`;

  const res = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'X-Atlassian-Token': 'no-check',
    },
    redirect: 'manual',
  });

  if (res.status !== 302) return null;

  const location = res.headers.get('location');
  if (!location || !location.includes(MEDIA_API_BASE)) return null;

  // Extract the token from the redirect URL
  const tokenMatch = location.match(/[?&]token=([^&]+)/);
  if (!tokenMatch) return null;

  // Use the token with the correct fileId on api.media
  const mediaUrl = `${MEDIA_API_BASE}/file/${attachment.fileId}/binary?token=${tokenMatch[1]}&client=${extractClient(location)}`;
  const mediaRes = await fetch(mediaUrl);
  return mediaRes.ok ? mediaRes : null;
}

/**
 * Strategy 3: For videos — get a collection-scoped media token by
 * using an image attachment's download redirect on the same page,
 * then request the video via api.media.atlassian.com.
 *
 * Confluence issues file-scoped tokens (per-file), so we need to get
 * one token per file. For videos where the download URL returns 401,
 * we try fetching with auto-redirect as a fallback.
 */
async function tryAutoRedirectDownload(
  downloadLink: string,
  authHeader: string,
): Promise<Response | null> {
  const downloadUrl = `${CONFLUENCE_BASE}/wiki${downloadLink}`;

  const res = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
    },
  });

  if (res.ok) {
    const contentType = res.headers.get('content-type') || '';
    // Verify we got actual media content, not an HTML login page
    if (!contentType.includes('text/html')) {
      return res;
    }
  }
  return null;
}

/**
 * Strategy 4: Try alternative download URL format.
 */
async function tryAlternativeDownload(
  pageId: string,
  filename: string,
  authHeader: string,
): Promise<Response | null> {
  const altUrl = `${CONFLUENCE_BASE}/wiki/download/attachments/${pageId}/${encodeURIComponent(filename)}`;

  const res = await fetch(altUrl, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'X-Atlassian-Token': 'no-check',
    },
    redirect: 'manual',
  });

  // Check for media API redirect
  if (res.status === 302) {
    const location = res.headers.get('location');
    if (location && location.includes(MEDIA_API_BASE)) {
      const mediaRes = await fetch(location);
      if (mediaRes.ok) return mediaRes;
    }
  }

  if (res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return res;
  }
  return null;
}

function extractClient(url: string): string {
  const match = url.match(/[?&]client=([^&]+)/);
  return match ? match[1] : '';
}

function buildResponse(res: Response): NextResponse {
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const isVideo = contentType.startsWith('video/');

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string; filename: string }> }
) {
  try {
    const { pageId, filename } = await params;
    const decodedFilename = decodeURIComponent(filename);
    const authHeader = buildAuthHeader();

    // Step 1: Get attachment metadata via V2 API
    const attachmentsUrl = `${CONFLUENCE_BASE}/wiki/api/v2/pages/${pageId}/attachments?limit=50`;
    const attachmentsRes = await fetch(attachmentsUrl, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
      },
    });

    if (!attachmentsRes.ok) {
      console.error(`[confluence-attachment] Failed to fetch attachments for page ${pageId}:`, attachmentsRes.status);
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const attachmentsData = await attachmentsRes.json();
    const attachment: Attachment | undefined = attachmentsData.results?.find(
      (att: Attachment) => att.title === decodedFilename
    );

    if (!attachment) {
      console.error(`[confluence-attachment] Attachment not found: ${decodedFilename}`);
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Step 2: Try download via redirect (works for images → api.media.atlassian.com)
    const redirectResult = await tryDownloadRedirect(attachment.downloadLink, authHeader);
    if (redirectResult) {
      return buildResponse(redirectResult);
    }

    // Step 3: Try with auto-redirect (Node.js fetch follows cross-origin redirects)
    const autoResult = await tryAutoRedirectDownload(attachment.downloadLink, authHeader);
    if (autoResult) {
      return buildResponse(autoResult);
    }

    // Step 4: Try alternative download URL
    const altResult = await tryAlternativeDownload(pageId, decodedFilename, authHeader);
    if (altResult) {
      return buildResponse(altResult);
    }

    // Step 5: Try media API with redirect token (last resort for images)
    const mediaResult = await tryMediaApiWithRedirectToken(attachment, authHeader);
    if (mediaResult) {
      return buildResponse(mediaResult);
    }

    console.error(`[confluence-attachment] All download strategies failed for: ${decodedFilename} (${attachment.mediaType})`);
    return NextResponse.json(
      { error: 'Failed to fetch attachment', filename: decodedFilename, mediaType: attachment.mediaType },
      { status: 502 }
    );
  } catch (error) {
    console.error('[confluence-attachment] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
