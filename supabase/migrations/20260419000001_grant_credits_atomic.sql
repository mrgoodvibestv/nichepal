-- Atomic credit grant via Postgres function.
-- Used by the Stripe webhook for top-ups and renewals.
-- Eliminates the read-then-write race condition in grantCredits()
-- where a duplicate webhook event could grant credits twice.
create or replace function grant_credits(
  p_profile_id  uuid,
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
     set credits = credits + p_amount
   where id = p_profile_id
  returning credits into v_new_credits;

  if v_new_credits is null then
    return -1;
  end if;

  insert into public.credit_transactions (profile_id, amount, type, description)
  values (p_profile_id, p_amount, 'grant', p_description);

  return v_new_credits;
end;
$$;
