/*
# Create SaaS credit/tier system + avatars bucket

This migration adds the missing pieces for the SaaS credit system and avatar storage.

1. New Types
- `app_tier` enum: 'trial', 'regular', 'premium'

2. Modified Tables
- `profiles` — add `tier` column (app_tier, default 'trial')

3. New Tables
- `usage_credits` — AI credit usage per user per day
  - user_id, date, credits_used, UNIQUE(user_id, date) for daily auto-reset

4. New Functions
- `get_remaining_credits()` — returns remaining AI credits today (-1 = unlimited)
- `deduct_credit(amount)` — deducts credits with overflow protection

5. New Storage Bucket
- `avatars` — public bucket for user profile photos

6. Security
- RLS on usage_credits (SELECT own only)
- SECURITY DEFINER functions for credit operations
- Storage policies for avatars bucket (users manage own folder)
*/

-- 1. Create app_tier enum
DO $$ BEGIN
  CREATE TYPE app_tier AS ENUM ('trial', 'regular', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add tier column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier app_tier NOT NULL DEFAULT 'trial';

-- 3. Create usage_credits table
CREATE TABLE IF NOT EXISTS public.usage_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  credits_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.usage_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credits" ON public.usage_credits;
CREATE POLICY "select_own_credits"
  ON public.usage_credits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- 4. get_remaining_credits() function
CREATE OR REPLACE FUNCTION public.get_remaining_credits()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH user_tier AS (
    SELECT COALESCE(
      (SELECT tier FROM public.profiles WHERE id = auth.uid()),
      'trial'::app_tier
    ) AS t
  )
  SELECT CASE
    WHEN (SELECT t FROM user_tier) = 'premium' THEN -1
    ELSE
      GREATEST(0,
        CASE (SELECT t FROM user_tier)
          WHEN 'trial' THEN 10
          WHEN 'regular' THEN 100
          ELSE 10
        END
        - COALESCE(
          (SELECT credits_used FROM public.usage_credits
           WHERE user_id = auth.uid() AND date = current_date),
          0
        )
      )
  END;
$$;

-- 5. deduct_credit(amount) function
CREATE OR REPLACE FUNCTION public.deduct_credit(amount integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier app_tier;
  v_daily_limit integer;
  v_used integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(
    (SELECT tier FROM public.profiles WHERE id = auth.uid()),
    'trial'::app_tier
  ) INTO v_tier;

  IF v_tier = 'premium' THEN
    RETURN -1;
  END IF;

  v_daily_limit := CASE v_tier
    WHEN 'trial' THEN 10
    WHEN 'regular' THEN 100
    ELSE 10
  END;

  SELECT credits_used INTO v_used
  FROM public.usage_credits
  WHERE user_id = auth.uid() AND date = current_date;

  v_used := COALESCE(v_used, 0);

  IF v_used + amount > v_daily_limit THEN
    RAISE EXCEPTION 'Insufficient credits: you have % remaining, need %',
      GREATEST(0, v_daily_limit - v_used), amount;
  END IF;

  INSERT INTO public.usage_credits (user_id, date, credits_used)
  VALUES (auth.uid(), current_date, amount)
  ON CONFLICT (user_id, date)
  DO UPDATE SET credits_used = public.usage_credits.credits_used + amount,
                updated_at = now();

  RETURN GREATEST(0, v_daily_limit - (v_used + amount));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remaining_credits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credit(integer) TO authenticated;

-- 6. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload/read/update/delete their own avatar folder
DROP POLICY IF EXISTS "avatar_read_own" ON storage.objects;
CREATE POLICY "avatar_read_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_insert_own" ON storage.objects;
CREATE POLICY "avatar_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_update_own" ON storage.objects;
CREATE POLICY "avatar_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
CREATE POLICY "avatar_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Also allow public read of avatars (so profile photos are visible)
DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
CREATE POLICY "avatar_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');
