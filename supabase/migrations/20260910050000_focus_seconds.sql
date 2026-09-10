-- Focus time is stored as seconds and only ever rendered as minutes.
--
-- The previous version cached `sum(round(seconds / 60.0))` into drill_log, so
-- rounding happened per session and the errors added up instead of cancelling:
-- two 30-second sessions are one minute of work and cached two, and thirty
-- short sessions trebled the day. `least(1440, …)` also clamped the running
-- sum rather than the day, so the cached figure could move down when a session
-- was removed. Minutes are now derived at read time from the true total.
--
-- The function is also reachable directly through PostgREST, so it re-checks
-- what the Server Action checks: the day is really a day and really near
-- today, and the drill key really belongs to the caller. A key that is not
-- theirs is ignored rather than rejected — the session is the valuable part,
-- and the caller cannot see the difference anyway.
--
-- `set search_path = ''` pins name resolution: without it a caller who can
-- create objects could shadow a function this one calls.

-- Changing a function's return type is not something CREATE OR REPLACE can do.
--
-- Both argument orders are dropped, and that is not belt-and-braces: this
-- project's hosted database has `(p_drill_key, p_on_day, p_seconds)` while
-- every migration file declares `(p_on_day, p_drill_key, p_seconds)` — the
-- hosted one was created by hand and never matched the repo. Dropping only the
-- date/text/integer form would have left the hosted variant in place, and
-- PostgREST resolving the app's named-argument call against two overloads
-- fails as ambiguous. Deployment order does not save you here either: the
-- migration is the thing that creates the second overload.
--
-- Postgres identifies a function by name plus argument *types*, not names, so
-- these two drops are genuinely different functions. Dropped without a
-- signature would take every overload of the name, which is what we want but
-- is a blunt instrument to leave in a migration; naming both is explicit about
-- what is being replaced and why.
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
  v_user  uuid := (select auth.uid());
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
    hashtext(v_user::text || '|' || p_on_day::text || '|' || p_drill_key)
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
