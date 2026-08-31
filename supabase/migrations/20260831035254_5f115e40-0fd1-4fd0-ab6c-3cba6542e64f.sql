CREATE OR REPLACE FUNCTION private.is_owner()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'::public.app_role
  );
$$;
REVOKE ALL ON FUNCTION private.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_owner() TO authenticated, service_role;
DROP FUNCTION private.has_role(UUID, public.app_role);

CREATE POLICY "owner_manage_user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));

CREATE POLICY "owner_manage_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));

CREATE POLICY "owner_manage_projects" ON public.projects
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));

CREATE POLICY "owner_manage_uploaded_files" ON public.uploaded_files
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));

CREATE POLICY "owner_manage_processed_files" ON public.processed_files
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));

CREATE POLICY "owner_manage_ai_jobs" ON public.ai_jobs
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));

CREATE POLICY "rds_storage_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));