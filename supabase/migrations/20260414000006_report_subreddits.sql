alter table reports
  add column if not exists selected_subreddits text[] default '{}';
