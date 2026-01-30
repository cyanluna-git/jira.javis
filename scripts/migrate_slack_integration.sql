-- Slack Integration Migration
-- Run: PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/migrate_slack_integration.sql

-- Slack notification log
CREATE TABLE IF NOT EXISTS slack_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  message_ts TEXT,                              -- Slack message timestamp (for updates)
  notification_type TEXT NOT NULL,              -- risk_alert, sprint_update, custom
  payload JSONB,                                -- Full message payload
  status TEXT DEFAULT 'pending',                -- pending, sent, failed
  error_message TEXT,                           -- Error details if failed
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

-- Channel configuration
CREATE TABLE IF NOT EXISTS slack_channel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT,
  notification_types TEXT[],                     -- Array of notification types to receive
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_notifications_channel ON slack_notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_type ON slack_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON slack_notifications(status);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_created ON slack_notifications(created_at DESC);

-- Update timestamp trigger for channel config
CREATE OR REPLACE FUNCTION update_slack_channel_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_slack_channel_config_timestamp ON slack_channel_config;
CREATE TRIGGER trigger_update_slack_channel_config_timestamp
  BEFORE UPDATE ON slack_channel_config
  FOR EACH ROW
  EXECUTE FUNCTION update_slack_channel_config_timestamp();

-- Sample default channel config (optional)
-- INSERT INTO slack_channel_config (channel_id, channel_name, notification_types, enabled)
-- VALUES ('#jarvis-alerts', 'jarvis-alerts', ARRAY['risk_alert', 'sprint_update'], true)
-- ON CONFLICT (channel_id) DO NOTHING;

COMMENT ON TABLE slack_notifications IS 'Log of all Slack notifications sent by Jarvis';
COMMENT ON TABLE slack_channel_config IS 'Configuration for Slack channels receiving notifications';
