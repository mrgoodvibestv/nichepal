-- Add credits column to profiles
alter table profiles add column credits int not null default 0;

-- Credit transactions log
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  amount int not null,
  type text not null check (type in ('grant', 'deduction')),
  description text,
  created_at timestamptz default now()
);

alter table credit_transactions enable row level security;

create policy "Users see their transactions"
  on credit_transactions for all using (
    profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );
