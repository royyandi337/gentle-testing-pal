/*
# Expand website settings for owner controls

1. New Columns
- `site_settings.logo_data_url` (text, nullable) — optional uploaded logo stored as a small data URL for the shared application identity.
- `site_settings.site_name_main` (text) — primary line of the application name.
- `site_settings.site_name_sub` (text) — secondary line of the application name.
- `site_settings.payment_mode` (text) — `otomatis` or `manual` upgrade mode.
- `site_settings.payment_gateway` (text) — selected gateway name, without storing private credentials.
- `site_settings.manual_payment_info` (text) — payment instructions shown to users in manual mode.
- `site_settings.accent_color` (text) — selected accent color used by the owner settings UI and application branding.

2. Modified Table
- `site_settings` keeps its existing single-row structure and existing identity fields.
- New fields use safe defaults so existing settings remain valid.

3. Security
- Existing RLS remains enabled.
- Existing authenticated read policy and owner-only write policies continue to protect these settings.

4. Important Notes
- Payment gateway credentials are intentionally not stored in this table. They must remain in secure server configuration.
- The logo is limited by the application to a small image data URL before saving.
*/

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS logo_data_url text,
  ADD COLUMN IF NOT EXISTS site_name_main text NOT NULL DEFAULT 'ROY DIGITAL',
  ADD COLUMN IF NOT EXISTS site_name_sub text NOT NULL DEFAULT 'SOLUTION',
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'otomatis',
  ADD COLUMN IF NOT EXISTS payment_gateway text NOT NULL DEFAULT 'Midtrans',
  ADD COLUMN IF NOT EXISTS manual_payment_info text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#C79A46';

UPDATE public.site_settings
SET
  site_name_main = COALESCE(NULLIF(site_name_main, ''), split_part(site_name, ' ', 1) || CASE WHEN position(' ' IN site_name) > 0 THEN ' ' || split_part(site_name, ' ', 2) ELSE '' END),
  site_name_sub = COALESCE(NULLIF(site_name_sub, ''), 'SOLUTION')
WHERE id = true;