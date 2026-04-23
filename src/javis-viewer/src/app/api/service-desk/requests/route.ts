import { NextRequest, NextResponse } from 'next/server';
import { SUBMIT_FORM_GROUPS } from '@/types/service-desk';
import { resolveAccessContextFromRequest } from '@/lib/access';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const ALL_ALLOWED_COMPONENTS = new Set(Object.values(SUBMIT_FORM_GROUPS).flat());

function buildAuthHeader(): string {
  const jiraEmail = process.env.JIRA_EMAIL;
  const jiraToken = process.env.JIRA_TOKEN;
  const credentials = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
  return `Basic ${credentials}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const jiraUrl = process.env.JIRA_URL;
  const jiraEmail = process.env.JIRA_EMAIL;
  const jiraToken = process.env.JIRA_TOKEN;

  if (!jiraUrl || !jiraEmail || !jiraToken) {
    return NextResponse.json({ error: 'Jira is not configured' }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const group = (formData.get('group') as string | null)?.trim() ?? '';
  const component = (formData.get('component') as string | null)?.trim() ?? '';
  const summary = (formData.get('summary') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() ?? '';

  if (!group || !component || !summary) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const access = await resolveAccessContextFromRequest(request);
  const submitterName = access.user?.name ?? access.user?.email ?? 'Unknown';
  const submitterEmail = access.user?.email ?? '';

  if (summary.length > 255) {
    return NextResponse.json({ error: 'Summary exceeds 255 characters' }, { status: 400 });
  }

  if (!SUBMIT_FORM_GROUPS[group]) {
    return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  }

  if (!ALL_ALLOWED_COMPONENTS.has(component)) {
    return NextResponse.json({ error: 'Invalid component' }, { status: 400 });
  }

  const files = formData.getAll('files').filter((v): v is File => v instanceof File && v.size > 0);
  let totalBytes = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `"${file.name}" exceeds 10MB limit` }, { status: 400 });
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: 'Total file size exceeds 25MB' }, { status: 400 });
    }
  }

  const submittedByBlock = `*Submitted by:* ${submitterName} <${submitterEmail}>\n*Group:* ${group}\n\n`;
  const fullDescription = description ? `${submittedByBlock}${description}` : submittedByBlock.trim();

  const authHeader = buildAuthHeader();

  let issueKey: string;
  try {
    const createRes = await fetch(`${jiraUrl}/rest/api/2/issue`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: 'PSSM' },
          issuetype: { name: 'Support' },
          summary,
          description: fullDescription,
          components: [{ name: component }],
          labels: [group],
          priority: { name: 'Medium' },
        },
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error('[service-desk/requests] Jira issue creation failed:', createRes.status, errorText);
      return NextResponse.json({ error: 'Failed to create Jira issue' }, { status: 502 });
    }

    const created = await createRes.json() as { key: string };
    issueKey = created.key;
  } catch (err) {
    console.error('[service-desk/requests] Jira API error:', err);
    return NextResponse.json({ error: 'Jira API request failed' }, { status: 502 });
  }

  if (files.length > 0) {
    try {
      const attachFormData = new FormData();
      for (const file of files) {
        attachFormData.append('file', file);
      }

      const attachRes = await fetch(`${jiraUrl}/rest/api/2/issue/${issueKey}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'X-Atlassian-Token': 'no-check',
        },
        body: attachFormData,
      });

      if (!attachRes.ok) {
        console.error('[service-desk/requests] Attachment upload failed:', attachRes.status);
      }
    } catch (err) {
      console.error('[service-desk/requests] Attachment upload error:', err);
    }
  }

  return NextResponse.json(
    { issueKey, webUrl: `${jiraUrl}/browse/${issueKey}` },
    { status: 201 }
  );
}
