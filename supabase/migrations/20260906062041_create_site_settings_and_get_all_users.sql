/*
# Create site_settings table and get_all_users function

1. New Tables
- `site_settings` — single-row table (id boolean PK default true) storing the website's
  configurable display fields: site_name, site_address, site_tagline.
  - `id` (boolean, PK, default true) — ensures only one row ever exists.
  - `site_name` (text, not null) — website display name.
  - `site_address` (text, not null default '') — physical/address line.
  - `site_tagline` (text, not null default '') — short tagline/slogan.
  - `updated_at` (timestamptz, default now()) — last modification timestamp.
  - `updated_by` (uuid, nullable) — the user who last updated settings.

2. New Functions
- `public.get_all_users()` — SECURITY DEFINER function that returns all registered users
  with their email, creation date, last sign-in, and role. Only callable by owners (RLS
  on the function is enforced via the `private.is_owner()` check inside).

3. Security
- RLS enabled on `site_settings`.
  - SELECT: any authenticated user can read site settings (they're display data).
  - INSERT/UPDATE/DELETE: only owner role can modify.
- `get_all_users()` is SECURITY DEFINER and checks `private.is_owner()` internally,
  returning an empty set for non-owners.

4. Notes
- A default row is inserted with sensible defaults.
- The `get_all_users` function reads from `auth.users` (normally inaccessible via RLS)
  by running as SECURITY DEFINER, but gates access with the is_owner check.
*/

CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT single_row CHECK (id = true),
  site_name text NOT NULL DEFAULT 'ROY DIGITAL SOLUTION',
  site_address text NOT NULL DEFAULT '',
  site_tagline text NOT NULL DEFAULT 'Solusi Digital untuk Foto, Dokumen & Kreativitas',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_site_settings" ON public.site_settings;
CREATE POLICY "anyone_can_read_site_settings"
  ON public.site_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "owner_can_insert_site_settings" ON public.site_settings;
CREATE POLICY "owner_can_insert_site_settings"
  ON public.site_settings FOR INSERT
  TO authenticated WITH CHECK (private.is_owner());

DROP POLICY IF EXISTS "owner_can_update_site_settings" ON public.site_settings;
CREATE POLICY "owner_can_update_site_settings"
  ON public.site_settings FOR UPDATE
  TO authenticated USING (private.is_owner()) WITH CHECK (private.is_owner());

DROP POLICY IF EXISTS "owner_can_delete_site_settings" ON public.site_settings;
CREATE POLICY "owner_can_delete_site_settings"
  ON public.site_settings FOR DELETE
  TO authenticated USING (private.is_owner());

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT
    u.id AS user_id,
    u.email AS email,
    u.created_at AS created_at,
    u.last_sign_in_at AS last_sign_in_at,
    COALESCE(ur.role::text, 'user') AS role
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE private.is_owner()
  ORDER BY u.created_at DESC;
$$;
