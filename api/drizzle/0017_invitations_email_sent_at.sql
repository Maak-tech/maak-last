-- Migration 0017: Track email delivery for family invitations
-- emailSentAt is null when the invite was created but email not confirmed sent.
-- The invite UI should show a "Resend" button when emailSentAt is null or >1 hour old.

ALTER TABLE family_invitations
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
