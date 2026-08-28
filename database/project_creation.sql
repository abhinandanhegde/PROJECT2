-- ============================================================
-- T2 Bug Tracker — Atomic Project Creation
-- ============================================================
-- Run AFTER schema.sql, rls.sql on Supabase PostgreSQL via SQL Editor.
-- This function atomically creates a project AND the creator's ADMIN membership.
-- This prevents projects from existing without an admin.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_project(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_result JSONB;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Create the project
  INSERT INTO public.projects (name, description, created_by)
  VALUES (p_name, p_description, v_user_id)
  RETURNING id INTO v_project_id;

  -- Atomically add the creator as ADMIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (v_project_id, v_user_id, 'ADMIN');

  -- Return the created project as JSONB
  SELECT to_jsonb(p.*) INTO v_result
  FROM public.projects p
  WHERE p.id = v_project_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public;

-- ============================================================
-- PERMISSIONS
-- ============================================================

-- Revoke from anon
REVOKE EXECUTE ON FUNCTION public.create_project(TEXT, TEXT) FROM anon;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT) TO authenticated;

-- Grant to service_role for seed data
GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT) TO service_role;
