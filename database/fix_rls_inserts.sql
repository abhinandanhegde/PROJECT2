-- ============================================================
-- ⚠️ SUPERSEDED — DO NOT APPLY
-- ============================================================
-- This file is superseded by `fix_rls_policies.sql`.
-- Its `notifications` policy used `WITH CHECK (true)` (insecure) and its
-- `activity_log` policy had no project-membership check.
-- Use `fix_rls_policies.sql` instead.
-- ============================================================
-- (Kept for reference only. The original content is below.)
-- ============================================================

-- Activity log: allow authenticated users to insert audit entries
DROP POLICY IF EXISTS "activity_log_insert_authenticated" ON activity_log;
CREATE POLICY "activity_log_insert_authenticated"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Notifications: allow authenticated users to insert notifications
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;
CREATE POLICY "notifications_insert_authenticated"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
