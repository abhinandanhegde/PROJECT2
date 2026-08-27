-- ============================================================
-- T2 Bug Tracker — Audit Function (log_activity)
-- ============================================================
-- Run AFTER schema.sql and rls.sql on Supabase PostgreSQL via SQL Editor.
-- This function is called by FastAPI endpoints (Dev 2) to log audit events.
-- The actor_id must match auth.uid() — the function validates this.
-- ============================================================

-- Function: log an activity event
-- Called by: FastAPI endpoints after domain mutations
-- Security: SECURITY DEFINER with fixed search_path
--   - Validates actor_id matches auth.uid()
--   - Only authenticated roles can call it
CREATE OR REPLACE FUNCTION public.log_activity(
  p_project_id UUID,
  p_bug_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_caller_id UUID;
BEGIN
  -- Get the actual authenticated user from the JWT context
  v_caller_id := auth.uid();

  -- SECURITY: Reject if the caller tries to log an activity as someone else
  IF p_actor_id IS NOT NULL AND v_caller_id IS NOT NULL AND p_actor_id != v_caller_id THEN
    RAISE EXCEPTION 'Security violation: actor_id (%) does not match authenticated user (%)', p_actor_id, v_caller_id;
  END IF;

  -- If no actor_id provided, use the authenticated user
  IF p_actor_id IS NULL THEN
    p_actor_id := v_caller_id;
  END IF;

  -- Validate required fields
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;

  IF p_action IS NULL OR p_action = '' THEN
    RAISE EXCEPTION 'action is required';
  END IF;

  IF p_entity_type IS NULL OR p_entity_type = '' THEN
    RAISE EXCEPTION 'entity_type is required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id is required';
  END IF;

  -- Insert the activity log entry
  INSERT INTO public.activity_log (
    project_id, bug_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    p_project_id, p_bug_id, p_actor_id, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public;

-- ============================================================
-- RESTRICT EXECUTE PERMISSIONS
-- ============================================================

-- Revoke from anon (unauthenticated) — audit inserts must not be anonymous
REVOKE EXECUTE ON FUNCTION public.log_activity(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB, JSONB) FROM anon;

-- Grant to authenticated users only
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;

-- Also grant to service_role for background tasks / seed data
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB, JSONB) TO service_role;

-- ============================================================
-- ACTIVITY LOG EVENT VOCABULARY (use these exact strings)
-- ============================================================
--
-- BUG_CREATED            — New bug created
-- BUG_UPDATED            — Any bug field changed
-- BUG_ASSIGNED           — Assignee changed
-- BUG_STATUS_CHANGED     — Status transition
-- BUG_SEVERITY_CHANGED   — Severity changed
-- BUG_PRIORITY_CHANGED   — Priority changed
-- BUG_RESOLVED           — Status → RESOLVED
-- BUG_REOPENED           — Status → REOPENED
-- COMMENT_CREATED        — Comment added
-- COMMENT_DELETED        — Comment removed
-- RELATIONSHIP_CREATED   — Link added between bugs
-- RELATIONSHIP_REMOVED   — Link removed
-- MEMBER_ADDED           — User added to project
-- MEMBER_REMOVED         — User removed from project
-- COMPONENT_CREATED      — Component added
-- PROJECT_CREATED        — Project created
