-- Email tracking tables for SendLayer webhook status (tms schema)
-- Run once in Supabase SQL editor (or psql) before relying on durable storage.

CREATE TABLE IF NOT EXISTS tms.tracked_emails (
  id text PRIMARY KEY,
  message_id text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  current_status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  complained_at timestamptz,
  bounce_reason text,
  diagnostic_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracked_emails_message_id_key UNIQUE (message_id)
);

CREATE TABLE IF NOT EXISTS tms.email_events (
  id text PRIMARY KEY,
  tracked_email_id text REFERENCES tms.tracked_emails (id) ON DELETE SET NULL,
  message_id text NOT NULL,
  event text NOT NULL,
  recipient text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  code text,
  ip_address text,
  event_fingerprint text NOT NULL,
  raw_payload jsonb,
  unmatched boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_events_event_fingerprint_key UNIQUE (event_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_tracked_emails_recipient ON tms.tracked_emails (recipient);
CREATE INDEX IF NOT EXISTS idx_tracked_emails_status ON tms.tracked_emails (current_status);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON tms.email_events (message_id);

GRANT ALL ON tms.tracked_emails TO postgres;
GRANT ALL ON tms.tracked_emails TO service_role;
GRANT ALL ON tms.email_events TO postgres;
GRANT ALL ON tms.email_events TO service_role;

-- Authenticated app users can read via API using service role; tighten RLS if exposing PostgREST directly.
COMMENT ON TABLE tms.tracked_emails IS 'SMTP sends correlated to SendLayer webhook MessageID';
COMMENT ON TABLE tms.email_events IS 'Idempotent SendLayer webhook / Events API history';
