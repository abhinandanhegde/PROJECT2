-- ============================================================
-- T2 Bug Tracker — RLS Policy Fixes
-- ============================================================
-- Run AFTER schema.sql, rls.sql, auth_trigger.sql, audit_function.sql,
-- and project_creation.sql in the Supabase SQL Editor.
--
-- Fixes:
--   1. comments  — missing UPDATE policy (comment editing always failed)
--   2. activity_log — missing INSERT policy (audit trail silently empty)
--   3. notifications — insecure INSERT policy (WITH CHECK (true))
-- ============================================================

-- ------------------------------------------------------------
-- COMMENTS — add UPDATE policy
-- Authors can edit their own comments on bugs in projects they belong to.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "comments_update_author" ON comments;
CREATE POLICY "comments_update_author"
  ON comments FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = comments.bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  )
  WITH CHECK (author_id = auth.uid());

-- ------------------------------------------------------------
-- ACTIVITY LOG — add INSERT policy
-- Users can only write audit entries for projects they belong to,
-- and only as themselves (actor_id = auth.uid()).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "activity_log_insert_authenticated" ON activity_log;
CREATE POLICY "activity_log_insert_authenticated"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND is_project_member(project_id, auth.uid())
  );

-- ------------------------------------------------------------
-- NOTIFICATIONS — fix insecure INSERT policy
-- Users can only receive notifications addressed to themselves.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;
CREATE POLICY "notifications_insert_authenticated"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
