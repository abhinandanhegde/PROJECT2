-- ============================================================
-- T2 Bug Tracker — Complete Database Schema
-- ============================================================
-- Run this against your Supabase PostgreSQL database via the SQL Editor.
-- Requires: pg_trgm extension for text search
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================

-- Bug status lifecycle
CREATE TYPE bug_status AS ENUM (
  'NEW', 'CONFIRMED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED'
);

CREATE TYPE bug_resolution AS ENUM (
  'FIXED', 'WONT_FIX', 'DUPLICATE', 'INVALID'
);

CREATE TYPE bug_severity AS ENUM (
  'BLOCKER', 'CRITICAL', 'MAJOR', 'NORMAL', 'MINOR', 'TRIVIAL'
);

CREATE TYPE bug_priority AS ENUM (
  'P1', 'P2', 'P3', 'P4', 'P5'
);

-- User roles within a project (project-aware, NOT global admin/member)
CREATE TYPE project_role AS ENUM (
  'REPORTER', 'DEVELOPER', 'QA', 'ADMIN'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Users (synced from Supabase Auth via trigger)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project membership (project-aware authorization)
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'REPORTER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Components (subdivisions within a project)
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Bugs (the core entity)
CREATE TABLE bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reporter_id UUID NOT NULL REFERENCES users(id),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status bug_status NOT NULL DEFAULT 'NEW',
  resolution bug_resolution,
  severity bug_severity NOT NULL DEFAULT 'NORMAL',
  priority bug_priority NOT NULL DEFAULT 'P3',
  duplicate_of UUID REFERENCES bugs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachments
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bug relationships (blocks, depends on, related to)
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  target_bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('blocks', 'depends_on', 'related_to')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_bug_id, target_bug_id, relationship_type),
  CHECK (source_bug_id != target_bug_id)
);

-- Activity log / audit trail
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bug_id UUID REFERENCES bugs(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bug_id UUID REFERENCES bugs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved searches
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Bugs
CREATE INDEX idx_bugs_project_id ON bugs(project_id);
CREATE INDEX idx_bugs_status ON bugs(status);
CREATE INDEX idx_bugs_severity ON bugs(severity);
CREATE INDEX idx_bugs_assignee_id ON bugs(assignee_id);
CREATE INDEX idx_bugs_reporter_id ON bugs(reporter_id);
CREATE INDEX idx_bugs_created_at ON bugs(created_at DESC);
CREATE INDEX idx_bugs_updated_at ON bugs(updated_at DESC);
CREATE INDEX idx_bugs_title_trgm ON bugs USING gin (title gin_trgm_ops);
CREATE INDEX idx_bugs_description_trgm ON bugs USING gin (description gin_trgm_ops);

-- Comments
CREATE INDEX idx_comments_bug_id ON comments(bug_id);

-- Activity log
CREATE INDEX idx_activity_log_project_id ON activity_log(project_id);
CREATE INDEX idx_activity_log_bug_id ON activity_log(bug_id);
CREATE INDEX idx_activity_log_actor_id ON activity_log(actor_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- Project members
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- Relationships
CREATE INDEX idx_relationships_source ON relationships(source_bug_id);
CREATE INDEX idx_relationships_target ON relationships(target_bug_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_bugs_updated_at
  BEFORE UPDATE ON bugs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BUG LIFECYCLE STATE MACHINE (Reference — enforced in backend)
-- ============================================================
--
-- Primary flow:
--   NEW → CONFIRMED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED
--
-- REOPENED can return to: CONFIRMED, IN_PROGRESS
-- CLOSED → REOPENED: Only ADMINs can reopen closed bugs
--
-- Valid transitions:
--   NEW        → CONFIRMED
--   CONFIRMED  → IN_PROGRESS, NEW
--   IN_PROGRESS→ RESOLVED, CONFIRMED
--   RESOLVED   → VERIFIED, REOPENED
--   VERIFIED   → CLOSED, REOPENED
--   CLOSED     → REOPENED (ADMIN only)
--   REOPENED   → CONFIRMED, IN_PROGRESS
--
-- Resolution rules:
--   status = RESOLVED  → resolution REQUIRED (FIXED, WONT_FIX, DUPLICATE, INVALID)
--   status != RESOLVED → resolution must be NULL
