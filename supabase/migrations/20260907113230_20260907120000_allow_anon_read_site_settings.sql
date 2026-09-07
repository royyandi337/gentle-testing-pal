/*
# Allow anon reads on site_settings

1. Security Changes
- Update the SELECT policy on `site_settings` to allow `anon, authenticated` reads.
- This is needed because the landing page and login page are unauthenticated,
  but must display the site name, tagline, and logo configured by the owner.
- Site settings are display-only data (name, tagline, logo, address) — safe to expose publicly.
- Write policies (INSERT/UPDATE/DELETE) remain owner-only, unchanged.

2. Important Notes
- Only the SELECT policy changes. Owners can still modify; anon cannot write.
- Re-running this migration is safe (DROP POLICY IF EXISTS + CREATE).
*/

DROP POLICY IF EXISTS "anyone_can_read_site_settings" ON public.site_settings;
CREATE POLICY "anyone_can_read_site_settings"
  ON public.site_settings FOR SELECT
  TO anon, authenticated USING (true);