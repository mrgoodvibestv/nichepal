alter table profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text
    default 'free'
    check (subscription_status in
      ('free', 'active', 'canceled', 'past_due'));
