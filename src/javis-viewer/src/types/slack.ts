// Slack API Types

export interface SlackSlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  api_app_id: string;
}

export interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | 'shortcut';
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    domain: string;
  };
  trigger_id: string;
  response_url: string;
  actions?: SlackAction[];
  message?: SlackMessage;
  container?: {
    type: string;
    message_ts: string;
    channel_id: string;
  };
}

export interface SlackAction {
  action_id: string;
  block_id: string;
  type: string;
  value?: string;
  selected_option?: {
    value: string;
    text: { type: string; text: string };
  };
  action_ts: string;
}

export interface SlackMessage {
  type: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
}

// Block Kit Types
export type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackActionsBlock
  | SlackContextBlock
  | SlackImageBlock;

export interface SlackHeaderBlock {
  type: 'header';
  text: SlackPlainTextElement;
}

export interface SlackSectionBlock {
  type: 'section';
  text?: SlackTextElement;
  block_id?: string;
  fields?: SlackTextElement[];
  accessory?: SlackBlockElement;
}

export interface SlackDividerBlock {
  type: 'divider';
}

export interface SlackActionsBlock {
  type: 'actions';
  block_id?: string;
  elements: SlackBlockElement[];
}

export interface SlackContextBlock {
  type: 'context';
  elements: (SlackTextElement | SlackImageElement)[];
}

export interface SlackImageBlock {
  type: 'image';
  image_url: string;
  alt_text: string;
  title?: SlackPlainTextElement;
}

// Block Elements
export type SlackBlockElement =
  | SlackButtonElement
  | SlackStaticSelectElement
  | SlackOverflowElement;

export interface SlackButtonElement {
  type: 'button';
  text: SlackPlainTextElement;
  action_id: string;
  value?: string;
  style?: 'primary' | 'danger';
  url?: string;
}

export interface SlackStaticSelectElement {
  type: 'static_select';
  action_id: string;
  placeholder?: SlackPlainTextElement;
  options: SlackOption[];
  initial_option?: SlackOption;
}

export interface SlackOverflowElement {
  type: 'overflow';
  action_id: string;
  options: SlackOption[];
}

export interface SlackOption {
  text: SlackPlainTextElement;
  value: string;
}

// Text Elements
export type SlackTextElement = SlackPlainTextElement | SlackMrkdwnElement;

export interface SlackPlainTextElement {
  type: 'plain_text';
  text: string;
  emoji?: boolean;
}

export interface SlackMrkdwnElement {
  type: 'mrkdwn';
  text: string;
}

export interface SlackImageElement {
  type: 'image';
  image_url: string;
  alt_text: string;
}

// Response Types
export interface SlackCommandResponse {
  response_type?: 'ephemeral' | 'in_channel';
  text?: string;
  blocks?: SlackBlock[];
  replace_original?: boolean;
  delete_original?: boolean;
}

// Database Types
export interface SlackNotification {
  id: string;
  channel_id: string;
  message_ts: string | null;
  notification_type: 'risk_alert' | 'sprint_update' | 'milestone_update' | 'custom' | 'test';
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface SlackChannelConfig {
  id: string;
  channel_id: string;
  channel_name: string | null;
  notification_types: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
