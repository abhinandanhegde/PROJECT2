-- ============================================================
-- FIX: Add missing INSERT policies for activity_log and notifications
-- Run this in Supabase SQL Editor
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
