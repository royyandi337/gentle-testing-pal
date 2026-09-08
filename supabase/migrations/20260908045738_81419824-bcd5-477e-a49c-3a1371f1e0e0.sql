ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS price_weekly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_yearly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_weekly_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_monthly_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price_yearly_enabled boolean NOT NULL DEFAULT true;