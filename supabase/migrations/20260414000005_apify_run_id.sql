alter table reports
  add column if not exists apify_run_id text,
  add column if not exists apify_dataset_id text;
