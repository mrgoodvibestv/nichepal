-- Add audiences array to profiles
-- Each element: { id, name, description, goal, subreddits }
alter table profiles
  add column if not exists audiences jsonb default '[]'::jsonb;

-- Audience context columns on reports
alter table reports
  add column if not exists audience_id text;
alter table reports
  add column if not exists audience_name text;
alter table reports
  add column if not exists audience_description text;
alter table reports
  add column if not exists audience_goal text;
