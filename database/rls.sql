-- ============================================================
-- T2 Bug Tracker — Row-Level Security (RLS) Policies
-- ============================================================
-- Run AFTER schema.sql on Supabase PostgreSQL via SQL Editor.
-- These policies enforce project-level access control.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: Check if user is a member of a project
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_project_role(p_project_id UUID, p_user_id UUID)
RETURNS project_role AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Anyone authenticated can read all user profiles
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profile
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- PROJECTS POLICIES
-- ============================================================

-- Authenticated users can read projects they are members of
CREATE POLICY "projects_select_members"
  ON projects FOR SELECT
  TO authenticated
  USING (is_project_member(id, auth.uid()));

-- Authenticated users can create projects
CREATE POLICY "projects_insert_authenticated"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only ADMIN members can update projects
CREATE POLICY "projects_update_admin"
  ON projects FOR UPDATE
  TO authenticated
  USING (get_project_role(id, auth.uid()) = 'ADMIN')
  WITH CHECK (get_project_role(id, auth.uid()) = 'ADMIN');

-- Only ADMIN members can delete projects
CREATE POLICY "projects_delete_admin"
  ON projects FOR DELETE
  TO authenticated
  USING (get_project_role(id, auth.uid()) = 'ADMIN');

-- ============================================================
-- PROJECT MEMBERS POLICIES
-- ============================================================

-- Project members can read the member list for their projects
CREATE POLICY "project_members_select"
  ON project_members FOR SELECT
  TO authenticated
  USING (is_project_member(project_id, auth.uid()));

-- ADMINs can add members
CREATE POLICY "project_members_insert_admin"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (get_project_role(project_id, auth.uid()) = 'ADMIN');

-- ADMINs can update member roles
CREATE POLICY "project_members_update_admin"
  ON project_members FOR UPDATE
  TO authenticated
  USING (get_project_role(project_id, auth.uid()) = 'ADMIN')
  WITH CHECK (get_project_role(project_id, auth.uid()) = 'ADMIN');

-- ADMINs can remove members, OR users can remove themselves
CREATE POLICY "project_members_delete_admin_or_self"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    get_project_role(project_id, auth.uid()) = 'ADMIN'
    OR user_id = auth.uid()
  );

-- ============================================================
-- COMPONENTS POLICIES
-- ============================================================

-- Project members can read components
CREATE POLICY "components_select"
  ON components FOR SELECT
  TO authenticated
  USING (is_project_member(project_id, auth.uid()));

-- ADMINs, DEVELOPERs, and QAs can create components
CREATE POLICY "components_insert_admin_developer"
  ON components FOR INSERT
  TO authenticated
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('ADMIN', 'DEVELOPER', 'QA')
  );

-- ADMINs, DEVELOPERs, and QAs can update components
CREATE POLICY "components_update_admin_developer"
  ON components FOR UPDATE
  TO authenticated
  USING (
    get_project_role(project_id, auth.uid()) IN ('ADMIN', 'DEVELOPER', 'QA')
  )
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('ADMIN', 'DEVELOPER', 'QA')
  );

-- ADMINs, DEVELOPERs, and QAs can delete components
CREATE POLICY "components_delete_admin_developer"
  ON components FOR DELETE
  TO authenticated
  USING (
    get_project_role(project_id, auth.uid()) IN ('ADMIN', 'DEVELOPER', 'QA')
  );

-- ============================================================
-- BUGS POLICIES
-- ============================================================

-- Project members can read all bugs in their projects
CREATE POLICY "bugs_select"
  ON bugs FOR SELECT
  TO authenticated
  USING (is_project_member(project_id, auth.uid()));

-- REPORTERs, DEVELOPERs, and QAs can create bugs
CREATE POLICY "bugs_insert_reporter_developer"
  ON bugs FOR INSERT
  TO authenticated
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('REPORTER', 'DEVELOPER', 'QA', 'ADMIN')
    AND reporter_id = auth.uid()
  );

-- REPORTER can update their own bugs (limited fields enforced in app)
-- DEVELOPERs, QAs, and ADMINs can update any bug in their project
CREATE POLICY "bugs_update"
  ON bugs FOR UPDATE
  TO authenticated
  USING (
    is_project_member(project_id, auth.uid())
    AND (
      get_project_role(project_id, auth.uid()) IN ('ADMIN', 'DEVELOPER', 'QA')
      OR (get_project_role(project_id, auth.uid()) = 'REPORTER' AND reporter_id = auth.uid())
    )
  )
  WITH CHECK (
    is_project_member(project_id, auth.uid())
  );

-- ADMINs can delete any bug in their project
CREATE POLICY "bugs_delete_admin"
  ON bugs FOR DELETE
  TO authenticated
  USING (
    get_project_role(project_id, auth.uid()) = 'ADMIN'
  );

-- ============================================================
-- COMMENTS POLICIES
-- ============================================================

-- Project members can read comments on bugs in their projects
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = comments.bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  );

-- Authenticated users can create comments on bugs in their projects
CREATE POLICY "comments_insert"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = comments.bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  );

-- Authors can delete their own comments, ADMINs can delete any
CREATE POLICY "comments_delete_author_or_admin"
  ON comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = comments.bug_id
        AND get_project_role(bugs.project_id, auth.uid()) = 'ADMIN'
    )
  );

-- ============================================================
-- ATTACHMENTS POLICIES
-- ============================================================

-- Project members can read attachments on bugs in their projects
CREATE POLICY "attachments_select"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = attachments.bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  );

-- Project members can create attachments for bugs in their projects
CREATE POLICY "attachments_insert"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = attachments.bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  );

-- Uploaders can delete their own, ADMINs can delete any
CREATE POLICY "attachments_delete_uploader_or_admin"
  ON attachments FOR DELETE
  TO authenticated
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = attachments.bug_id
        AND get_project_role(bugs.project_id, auth.uid()) = 'ADMIN'
    )
  );

-- ============================================================
-- RELATIONSHIPS POLICIES
-- ============================================================

-- Project members can read relationships on bugs in their projects
CREATE POLICY "relationships_select"
  ON relationships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = relationships.source_bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  );

-- Authenticated users can create relationships
CREATE POLICY "relationships_insert"
  ON relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = relationships.source_bug_id
        AND is_project_member(bugs.project_id, auth.uid())
    )
  );

-- Creators can remove their own, ADMINs can remove any
CREATE POLICY "relationships_delete_creator_or_admin"
  ON relationships FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bugs
      WHERE bugs.id = relationships.source_bug_id
        AND get_project_role(bugs.project_id, auth.uid()) = 'ADMIN'
    )
  );

-- ============================================================
-- ACTIVITY LOG POLICIES
-- ============================================================

-- Project members can read activity logs for their projects
CREATE POLICY "activity_log_select"
  ON activity_log FOR SELECT
  TO authenticated
  USING (is_project_member(project_id, auth.uid()));

-- Inserts only via the log_activity() function (SECURITY DEFINER)
-- No direct insert policy — the function handles it
-- Update/Delete: no policies (audit logs are immutable)

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

-- Users can only read their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can insert notifications (via service-role or functions)
-- No direct insert policy for users — notifications are created server-side

-- ============================================================
-- SAVED SEARCHES POLICIES
-- ============================================================

-- Users can only read their own saved searches
CREATE POLICY "saved_searches_select_own"
  ON saved_searches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own saved searches
CREATE POLICY "saved_searches_insert_own"
  ON saved_searches FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own saved searches
CREATE POLICY "saved_searches_update_own"
  ON saved_searches FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own saved searches
CREATE POLICY "saved_searches_delete_own"
  ON saved_searches FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
