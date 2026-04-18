-- Fix 1: package constraint was missing 'pro' — Pro plan subscribers
-- would cause a DB constraint violation in the webhook, preventing activation.
alter table profiles
  drop constraint if exists profiles_package_check;

alter table profiles
  add constraint profiles_package_check
  check (package in ('starter', 'growth', 'pro'));

-- Fix 2: atomic credit deduction via Postgres function.
-- The previous read-then-write pattern in deductCredit() had a race
-- condition: two simultaneous requests could both read the same balance,
-- both pass the >= check, and both write the same decremented value,
-- effectively granting one free operation per race.
-- This function does the decrement and the check atomically in a single
-- statement, then inserts the transaction row only on success.
create or replace function deduct_credits(
  p_profile_id uuid,
  p_amount      int,
  p_description text
) returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  v_new_credits int;
begin
  update public.profiles
     set credits = credits - p_amount
   where id = p_profile_id
     and credits >= p_amount
  returning credits into v_new_credits;

  -- v_new_credits is NULL if no row was updated (insufficient credits)
  if v_new_credits is null then
    return -1;
  end if;

  insert into public.credit_transactions (profile_id, amount, type, description)
  values (p_profile_id, -p_amount, 'deduction', p_description);

  return v_new_credits;
end;
$$;
