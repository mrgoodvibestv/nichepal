-- Profiles: one per user, stores their business context
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  business_name text,
  url text,
  positioning text,
  keywords text[] default '{}',
  target_subreddits text[] default '{}',
  tone text default 'peer-to-peer',
  package text default 'starter' check (package in ('starter', 'growth')),
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reports: one per generation run
create table reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  status text default 'generating' check (status in ('generating', 'complete', 'failed')),
  week_of date default current_date,
  strategy_note text,
  subreddits_scanned int default 0,
  threads_found int default 0,
  high_priority_count int default 0,
  generated_at timestamptz default now()
);

-- Threads: individual Reddit posts inside a report
create table threads (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade not null,
  subreddit text not null,
  title text not null,
  url text not null,
  author text,
  upvotes int default 0,
  num_comments int default 0,
  upvote_ratio float default 0,
  posted_at timestamptz,
  thread_type text check (thread_type in ('trending', 'rising', 'evergreen')),
  priority text check (priority in ('high', 'medium')),
  relevance_score int default 0,
  why_engage text,
  comment_template text,
  body_snippet text,
  engaged boolean default false,
  engaged_at timestamptz,
  created_at timestamptz default now()
);

-- Community searches: subreddits users explore and optionally add
create table community_searches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  query text,
  subreddit text,
  relevance_reason text,
  added_to_profile boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table reports enable row level security;
alter table threads enable row level security;
alter table community_searches enable row level security;

create policy "Users own their profile" on profiles
  for all using (auth.uid() = user_id);

create policy "Users see their reports" on reports
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users see their threads" on threads
  for all using (
    report_id in (
      select r.id from reports r
      join profiles p on p.id = r.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "Users see their searches" on community_searches
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

-- Auto-update updated_at on profiles
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure handle_updated_at();
