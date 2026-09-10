-- logMinutes() read cached minutes, added the session, and wrote them back, so
-- two tabs stopping at once both read the same value and one session vanished
-- (last-write-wins). This moves the whole write into one transaction,
-- serialised per user+day+drill by an advisory lock, deriving the cached
-- minutes from the session rows with the same per-session rounding as before.
create or replace function public.log_focus_session(p_on_day date, p_drill_key text, p_seconds integer)
returns void
language plpgsql
as $$
declare
  v_seconds integer := p_seconds;
  v_minutes integer;
begin
  if v_seconds is null or v_seconds < 1 then return; end if;
  if v_seconds > 86400 then v_seconds := 86400; end if;

  perform pg_advisory_xact_lock(
    hashtext((select auth.uid())::text || '|' || p_on_day::text || '|' || p_drill_key)
  );

  insert into public.focus_sessions (user_id, on_day, drill_key, seconds)
  values ((select auth.uid()), p_on_day, p_drill_key, v_seconds);

  -- Saturate at the drill_log cap (minutes in a day): without this, a day
  -- with over 24h of sessions would abort the whole transaction and lose the
  -- session row with it. The check constraint stays as the backstop.
  select least(1440, coalesce(sum(round(seconds / 60.0)), 0))::integer into v_minutes
  from public.focus_sessions
  where user_id = (select auth.uid())
    and on_day = p_on_day
    and drill_key = p_drill_key;

  insert into public.drill_log (user_id, on_day, drill_key, minutes, updated_at)
  values ((select auth.uid()), p_on_day, p_drill_key, v_minutes, now())
  on conflict (user_id, on_day, drill_key)
  do update set minutes = excluded.minutes, updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.log_focus_session(date, text, integer) to authenticated;
