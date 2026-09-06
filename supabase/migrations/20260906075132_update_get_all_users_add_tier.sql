/*
# Update get_all_users() to also return the tier column from profiles
*/

DROP FUNCTION IF EXISTS public.get_all_users();

CREATE FUNCTION public.get_all_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  tier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (SELECT private.is_owner()) THEN
    RAISE EXCEPTION 'Hanya owner yang boleh melihat daftar user.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at,
         COALESCE(ur.role::text, 'user'),
         COALESCE(p.tier::text, 'trial')
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
