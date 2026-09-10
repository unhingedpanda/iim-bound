-- The focus-session RPC moves to the new identity too.
--
-- It declared `v_user uuid := (select auth.uid())`, which for a Clerk session is
-- NULL — and its first guard is `if v_user is null then return null`. So every
-- timer write would have been refused with no error, the exact silent failure
-- the identity migration exists to prevent. Same reasoning as the policies:
-- read the claim, keep the column text.
--
-- The body is otherwise unchanged from 20260910050000.

drop function if exists public.log_focus_session(date, text, integer);
drop function if exists public.log_focus_session(text, date, integer);

create or replace function public.log_focus_session(
  p_on_day date,
  p_drill_key text,
  p_seconds integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_user  text := public.current_user_id();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_seconds integer := least(greatest(coalesce(p_seconds, 0), 0), 86400);
  v_minutes integer;
begin
  -- Nobody to file this against, or nothing worth filing.
  if v_user is null or v_seconds < 1 then
    return null;
  end if;

  -- A day, and one a form could plausibly have named: today in the app's own
  -- zone, or either side of it for a browser in another one. Everything else
  -- is a hand-written request and is dropped.
  if p_on_day is null or p_on_day < v_today - 1 or p_on_day > v_today + 1 then
    return null;
  end if;

  if not exists (
    select 1 from public.user_drills
    where user_id = v_user and slug = p_drill_key
  ) then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_user || '|' || p_on_day::text || '|' || p_drill_key)
  );

  insert into public.focus_sessions (user_id, on_day, drill_key, seconds)
  values (v_user, p_on_day, p_drill_key, v_seconds);

  -- The drill_log row is a derived cache: the true figure is the sum of the
  -- session rows, and this is that sum in whole minutes, rounded once at the
  -- end. Capped because the column is "minutes in a day".
  select least(1440, round(coalesce(sum(seconds), 0) / 60.0))::integer
    into v_minutes
  from public.focus_sessions
  where user_id = v_user and on_day = p_on_day and drill_key = p_drill_key;

  insert into public.drill_log (user_id, on_day, drill_key, minutes, updated_at)
  values (v_user, p_on_day, p_drill_key, v_minutes, now())
  on conflict (user_id, on_day, drill_key)
  do update set minutes = excluded.minutes, updated_at = excluded.updated_at;

  return v_minutes;
end;
$$;

grant execute on function public.log_focus_session(date, text, integer) to authenticated;
