-- Performance: add indexes on foreign keys
create index if not exists idx_community_searches_profile_id
  on community_searches(profile_id);

create index if not exists idx_credit_transactions_profile_id
  on credit_transactions(profile_id);

create index if not exists idx_reports_profile_id
  on reports(profile_id);

create index if not exists idx_threads_report_id
  on threads(report_id);

-- Deduplication: index on thread URL for fast weekly dedup queries
create index if not exists idx_threads_url
  on threads(url);

-- Optimize RLS policies: wrap auth.uid() in (select ...) to prevent per-row re-evaluation
alter policy "Users own their profile" on profiles
  using ((select auth.uid()) = user_id);

alter policy "Users see their reports" on reports
  using (
    profile_id in (
      select id from profiles where user_id = (select auth.uid())
    )
  );

alter policy "Users see their threads" on threads
  using (
    report_id in (
      select r.id from reports r
      join profiles p on p.id = r.profile_id
      where p.user_id = (select auth.uid())
    )
  );

alter policy "Users see their searches" on community_searches
  using (
    profile_id in (
      select id from profiles where user_id = (select auth.uid())
    )
  );

alter policy "Users see their transactions" on credit_transactions
  using (
    profile_id in (
      select id from profiles where user_id = (select auth.uid())
    )
  );

-- Add package column to profiles if not exists (no-op if already present)
alter table profiles
  add column if not exists package text default 'starter'
  check (package in ('starter', 'growth'));
