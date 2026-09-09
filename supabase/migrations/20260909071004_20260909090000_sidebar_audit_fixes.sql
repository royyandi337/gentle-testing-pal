/*
# Sidebar Audit Fixes — Add advertiser role, trial expiry, realtime

## Summary
This migration adds support for the "advertiser" account type, adds a
trial expiry timestamp to profiles, enables Supabase Realtime on the
profiles and usage_credits tables, and creates a helper function to
fetch sidebar-relevant user data in a single round-trip.

## Changes

### 1. Add 'advertiser' to app_role enum
- The `app_role` enum currently has: owner, admin, user
- Added: `advertiser` — users who manage ad campaigns and billing

### 2. Add trial_expires_at to profiles
- New column: `trial_expires_at` (timestamptz, nullable)
- Used by the sidebar to display a countdown widget for trial users
- Defaults to NULL; set when a user starts a trial

### 3. Enable Realtime on profiles and usage_credits
- `ALTER TABLE ... REPLICA IDENTITY FULL` + `alter publication supabase_realtime add table`
- Allows the frontend to subscribe to changes and update the sidebar
  (credits, tier, trial expiry) in real-time without page refresh

### 4. New function: get_sidebar_user_data()
- SECURITY DEFINER, search_path set to public
- Returns a single row with: tier, role, avatar_url, trial_expires_at
- Replaces the 2-3 separate queries the sidebar currently makes
- Executes as authenticated, reads only the calling user's own data

### 5. Security
- No new tables created
- No RLS policy changes (existing policies remain correct)
- get_sidebar_user_data() only returns data for auth.uid() — no cross-user access
*/

-- 1. Add 'advertiser' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'advertiser';

-- 2. Add trial_expires_at column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'trial_expires_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN trial_expires_at timestamptz;
  END IF;
END $$;

-- 3. Enable Realtime on profiles and usage_credits
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE usage_credits REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'usage_credits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE usage_credits;
  END IF;
END $$;

-- 4. Helper function: get_sidebar_user_data()
-- Returns tier, role, avatar_url, trial_expires_at for the current user
CREATE OR REPLACE FUNCTION public.get_sidebar_user_data()
RETURNS TABLE (
  tier app_tier,
  role app_role,
  avatar_url text,
  trial_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.tier,
    ur.role,
    p.avatar_url,
    p.trial_expires_at
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.get_sidebar_user_data() TO authenticated;
