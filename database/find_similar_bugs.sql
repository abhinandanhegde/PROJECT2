-- find_similar_bugs: pg_trgm-based duplicate detection
-- Run this in Supabase SQL Editor to enable real trigram similarity search.
--
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION find_similar_bugs(
  p_project_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_threshold FLOAT DEFAULT 0.3,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  bug_id TEXT,
  title TEXT,
  status TEXT,
  severity TEXT,
  priority TEXT,
  similarity FLOAT,
  match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id::TEXT AS bug_id,
    b.title::TEXT,
    b.status::TEXT,
    b.severity::TEXT,
    b.priority::TEXT,
    GREATEST(
      similarity(b.title, p_title),
      CASE WHEN p_description != '' THEN similarity(b.description, p_description) ELSE 0 END
    ) AS sim,
    CASE
      WHEN similarity(b.title, p_title) >= GREATEST(
        CASE WHEN p_description != '' THEN similarity(b.description, p_description) ELSE 0 END
      ) THEN 'title_trgm'::TEXT
      ELSE 'description_trgm'::TEXT
    END AS mt
  FROM bugs b
  WHERE b.project_id = p_project_id
    AND (
      similarity(b.title, p_title) >= p_threshold
      OR (p_description != '' AND similarity(b.description, p_description) >= p_threshold)
    )
  ORDER BY sim DESC
  LIMIT p_limit;
END;
$$;
