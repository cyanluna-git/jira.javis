import { NextRequest, NextResponse } from 'next/server';
import { SUBMIT_FORM_GROUPS } from '@/types/service-desk';
import { resolveAccessContextFromRequest } from '@/lib/access';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const ALL_ALLOWED_COMPONENTS = new Set(Object.values(SUBMIT_FORM_GROUPS).flat());

const JSM_SERVICE_DESK_ID = '1';
const JSM_REQUEST_TYPE_BY_GROUP: Record<string, string> = {
  IntegratedSystem: '4',
  Abatement: '117',
};

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
    const missing = {
      JIRA_URL: !jiraUrl,
      JIRA_EMAIL: !jiraEmail,
      JIRA_TOKEN: !jiraToken,
    };
    console.error('[service-desk/requests] Jira is not configured; missing env vars:', missing);
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

  if (!submitterEmail) {
    console.warn('[service-desk/requests] Rejected submit: session has no email claim', {
      source: access.user?.source,
      isAuthenticated: access.isAuthenticated,
    });
    return NextResponse.json(
      { error: 'Authenticated session is missing email claim; cannot identify Jira reporter' },
      { status: 401 }
    );
  }

  if (summary.length > 255) {
    return NextResponse.json({ error: 'Summary exceeds 255 characters' }, { status: 400 });
  }

  if (!SUBMIT_FORM_GROUPS[group]) {
    return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  }

  if (!ALL_ALLOWED_COMPONENTS.has(component)) {
    return NextResponse.json({ error: 'Invalid component' }, { status: 400 });
  }

  const requestTypeId = JSM_REQUEST_TYPE_BY_GROUP[group];

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
    const createRes = await fetch(`${jiraUrl}/rest/servicedeskapi/request`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        serviceDeskId: JSM_SERVICE_DESK_ID,
        requestTypeId,
        raiseOnBehalfOf: submitterEmail,
        requestFieldValues: {
          summary,
          description: fullDescription,
          components: [{ name: component }],
          labels: [group],
        },
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error(
        '[service-desk/requests] JSM request creation failed:',
        createRes.status,
        errorText
      );

      if (createRes.status === 400) {
        let mentionsRaiseOnBehalfOf = errorText.includes('raiseOnBehalfOf');
        if (!mentionsRaiseOnBehalfOf) {
          try {
            const parsed = JSON.parse(errorText) as Record<string, unknown>;
            const flat = JSON.stringify(parsed);
            mentionsRaiseOnBehalfOf =
              flat.includes('raiseOnBehalfOf') || flat.includes('cannot be added');
          } catch {
            mentionsRaiseOnBehalfOf = errorText.includes('cannot be added');
          }
        }
        if (mentionsRaiseOnBehalfOf) {
          return NextResponse.json(
            {
              error:
                'Your account is not enrolled as a JSM customer for PSSM. Contact the Jira administrator to enable customer self-registration or add your account to the project.',
            },
            { status: 403 }
          );
        }
      }

      return NextResponse.json({ error: 'Failed to create Jira issue' }, { status: 502 });
    }

    const created = (await createRes.json()) as { issueKey?: string; issueId?: string };
    if (!created.issueKey) {
      console.error(
        '[service-desk/requests] JSM response missing issueKey, falling back to issueId:',
        created
      );
    }
    issueKey = created.issueKey ?? created.issueId ?? '';
    if (!issueKey) {
      return NextResponse.json({ error: 'Failed to read Jira issue key' }, { status: 502 });
    }
  } catch (err) {
    console.error('[service-desk/requests] Jira API error:', err);
    return NextResponse.json({ error: 'Jira API request failed' }, { status: 502 });
  }

  if (files.length > 0) {
    try {
      const tempFormData = new FormData();
      for (const file of files) {
        tempFormData.append('file', file);
      }

      const tempRes = await fetch(
        `${jiraUrl}/rest/servicedeskapi/servicedesk/${JSM_SERVICE_DESK_ID}/attachTemporaryFile`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'X-ExperimentalApi': 'opt-in',
            'X-Atlassian-Token': 'no-check',
          },
          body: tempFormData,
        }
      );

      if (!tempRes.ok) {
        const tempErrText = await tempRes.text();
        console.error(
          '[service-desk/requests] attachTemporaryFile failed:',
          tempRes.status,
          tempErrText
        );
      } else {
        const tempJson = (await tempRes.json()) as {
          temporaryAttachments: { temporaryAttachmentId: string; fileName: string }[];
        };
        const temporaryAttachmentIds = tempJson.temporaryAttachments.map(
          (a) => a.temporaryAttachmentId
        );

        const attachRes = await fetch(
          `${jiraUrl}/rest/servicedeskapi/request/${issueKey}/attachment`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-ExperimentalApi': 'opt-in',
            },
            body: JSON.stringify({
              temporaryAttachmentIds,
              public: true,
            }),
          }
        );

        if (!attachRes.ok) {
          const attachErrText = await attachRes.text();
          console.error(
            '[service-desk/requests] Attachment upload failed:',
            attachRes.status,
            attachErrText
          );
        }
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
