-- ============================================================================
-- On signup, automatically create a business for the new user (using the
-- business_name they entered) and make them its owner. This is the ONLY
-- place a business gets created — there is no "join existing business by
-- id" flow in this simple version, which keeps tenant isolation foolproof:
-- a brand new auth user can never attach themselves to someone else's
-- business_id.
-- ============================================================================

create or replace function handle_new_user_signup()
returns trigger
language plpgsql
security definer
as $$
declare
  v_business_id uuid;
  v_business_name text;
begin
  v_business_name := coalesce(new.raw_user_meta_data->>'business_name', 'My Business');

  insert into businesses (name) values (v_business_name)
  returning id into v_business_id;

  insert into business_users (business_id, user_id, role)
  values (v_business_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user_signup();
