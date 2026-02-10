import crypto from 'crypto';
import type {
  SlackBlock,
  SlackHeaderBlock,
  SlackSectionBlock,
  SlackActionsBlock,
  SlackContextBlock,
  SlackButtonElement,
  SlackCommandResponse,
} from '@/types/slack';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

/**
 * Verify Slack request signature (HMAC-SHA256)
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn('SLACK_SIGNING_SECRET not configured');
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minutes window)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 300) {
    console.warn('Slack request timestamp too old');
    return false;
  }

  // Create signature base string
  const sigBaseString = `v0:${timestamp}:${body}`;

  // Calculate expected signature
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  hmac.update(sigBaseString);
  const expectedSignature = `v0=${hmac.digest('hex')}`;

  // Compare using timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Parse URL-encoded form data from Slack
 */
export function parseSlackFormData(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const data: Record<string, string> = {};
  for (const [key, value] of params) {
    data[key] = value;
  }
  return data;
}

// Block Kit Builder Utilities

export function headerBlock(text: string): SlackHeaderBlock {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text,
      emoji: true,
    },
  };
}

export function sectionBlock(
  text: string,
  fields?: string[]
): SlackSectionBlock {
  const block: SlackSectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text,
    },
  };

  if (fields) {
    block.fields = fields.map((f) => ({
      type: 'mrkdwn',
      text: f,
    }));
  }

  return block;
}

export function fieldsSection(fields: string[]): SlackSectionBlock {
  return {
    type: 'section',
    fields: fields.map((f) => ({
      type: 'mrkdwn',
      text: f,
    })),
  };
}

export function dividerBlock(): { type: 'divider' } {
  return { type: 'divider' };
}

export function actionsBlock(
  buttons: Array<{
    text: string;
    actionId: string;
    value?: string;
    style?: 'primary' | 'danger';
  }>
): SlackActionsBlock {
  return {
    type: 'actions',
    elements: buttons.map(
      (btn): SlackButtonElement => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: btn.text,
          emoji: true,
        },
        action_id: btn.actionId,
        value: btn.value,
        style: btn.style,
      })
    ),
  };
}

export function contextBlock(texts: string[]): SlackContextBlock {
  return {
    type: 'context',
    elements: texts.map((t) => ({
      type: 'mrkdwn',
      text: t,
    })),
  };
}

// Response Builders

export function ephemeralResponse(
  text: string,
  blocks?: SlackBlock[]
): SlackCommandResponse {
  return {
    response_type: 'ephemeral',
    text,
    blocks,
  };
}

export function inChannelResponse(
  text: string,
  blocks?: SlackBlock[]
): SlackCommandResponse {
  return {
    response_type: 'in_channel',
    text,
    blocks,
  };
}

// Formatted Message Builders

export function buildStatusMessage(data: {
  sprintName: string;
  progress: number;
  done: number;
  inProgress: number;
  todo: number;
  total: number;
}): SlackBlock[] {
  const progressBar = buildProgressBar(data.progress);

  return [
    headerBlock(`:runner: Sprint Status: ${data.sprintName}`),
    sectionBlock(`${progressBar} *${data.progress}%*`),
    fieldsSection([
      `:white_check_mark: *Done:* ${data.done}`,
      `:hourglass_flowing_sand: *In Progress:* ${data.inProgress}`,
      `:clipboard: *To Do:* ${data.todo}`,
      `:bar_chart: *Total:* ${data.total}`,
    ]),
  ];
}

export function buildRiskListMessage(
  risks: Array<{
    severity: string;
    title: string;
    milestone_title?: string;
  }>
): SlackBlock[] {
  const severityEmoji: Record<string, string> = {
    critical: ':rotating_light:',
    high: ':warning:',
    medium: ':large_orange_diamond:',
    low: ':white_circle:',
  };

  const blocks: SlackBlock[] = [
    headerBlock(`:warning: Current Risks (${risks.length})`),
  ];

  for (const risk of risks.slice(0, 10)) {
    const emoji = severityEmoji[risk.severity] || ':question:';
    blocks.push(
      sectionBlock(
        `${emoji} *${risk.severity.toUpperCase()}*: ${risk.title}${
          risk.milestone_title ? `\n_Milestone: ${risk.milestone_title}_` : ''
        }`
      )
    );
  }

  if (risks.length > 10) {
    blocks.push(contextBlock([`_And ${risks.length - 10} more..._`]));
  }

  return blocks;
}

export function buildSearchResultsMessage(
  query: string,
  results: Array<{
    key: string;
    summary: string;
    status: string;
    assignee?: string;
  }>
): SlackBlock[] {
  const blocks: SlackBlock[] = [
    headerBlock(`:mag: Search Results for "${query}"`),
  ];

  if (results.length === 0) {
    blocks.push(sectionBlock('No results found.'));
    return blocks;
  }

  for (const issue of results.slice(0, 10)) {
    const statusEmoji = getStatusEmoji(issue.status);
    blocks.push(
      sectionBlock(
        `${statusEmoji} *${issue.key}*: ${issue.summary}${
          issue.assignee ? `\n_Assignee: ${issue.assignee}_` : ''
        }`
      )
    );
  }

  if (results.length > 10) {
    blocks.push(contextBlock([`_Showing 10 of ${results.length} results_`]));
  }

  return blocks;
}

export function buildErrorMessage(message: string): SlackBlock[] {
  return [
    sectionBlock(`:x: *Error*\n${message}`),
  ];
}

export function buildHelpMessage(): SlackBlock[] {
  return [
    headerBlock(':robot_face: Jarvis Commands'),
    sectionBlock(`Available commands:
• \`/jarvis status\` - Current sprint status
• \`/jarvis search <query>\` - Search Jira issues
• \`/jarvis risk\` - View current risks
• \`/jarvis help\` - Show this help`),
    contextBlock(['Jarvis - Your project management assistant']),
  ];
}

// Utility Functions

function buildProgressBar(percent: number, width = 10): string {
  const filled = Math.round((width * percent) / 100);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function getStatusEmoji(status: string): string {
  const statusMap: Record<string, string> = {
    Done: ':white_check_mark:',
    Closed: ':white_check_mark:',
    Resolved: ':white_check_mark:',
    Complete: ':white_check_mark:',
    Completed: ':white_check_mark:',
    'In Progress': ':hourglass_flowing_sand:',
    'In Review': ':eyes:',
    Testing: ':test_tube:',
    Blocked: ':no_entry:',
    'On Hold': ':pause_button:',
  };
  return statusMap[status] || ':clipboard:';
}

/**
 * Send a deferred response to Slack using response_url
 */
export async function sendDeferredResponse(
  responseUrl: string,
  response: SlackCommandResponse
): Promise<boolean> {
  try {
    const res = await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to send deferred response:', error);
    return false;
  }
}
