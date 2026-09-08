/*
# Create usage_credits table for SaaS credit/tier system

1. Modified Tables
- `profiles` — add `tier` column (app_tier enum, default 'trial')

2. New Types
- `app_tier` enum: 'trial', 'regular', 'premium'
  - trial: 10 AI credits/day, basic Photo/PDF tools unlimited
  - regular: 100 AI credits/day, ad-free, batch processing
  - premium: unlimited AI credits, high-accuracy Word<->PDF

3. New Tables
- `usage_credits` — tracks AI credit usage per user per day.
  - user_id (uuid, FK auth.users, DEFAULT auth.uid())
  - date (date, DEFAULT current_date)
  - credits_used (integer, DEFAULT 0)
  - UNIQUE(user_id, date) — auto-resets daily (new date = new row)

4. New Functions
- `get_remaining_credits()` — SECURITY DEFINER, returns remaining AI credits
  for the current user today. Returns -1 for premium (unlimited).
- `deduct_credit(amount)` — SECURITY DEFINER, deducts AI credits. Throws
  if insufficient. Returns -1 for premium.

5. Security
- RLS enabled on usage_credits. Users can only SELECT their own rows.
- No direct INSERT/UPDATE/DELETE — only via SECURITY DEFINER functions.
*/

DO $$ BEGIN
  CREATE TYPE app_tier AS ENUM ('trial', 'regular', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier app_tier NOT NULL DEFAULT 'trial';

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
