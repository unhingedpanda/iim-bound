-- Identity moves from Supabase Auth to Clerk, so the user columns stop being uuid.
--
-- Clerk user ids are `user_…` strings. `auth.uid()` is declared `returns uuid`,
-- so for a Clerk session it returns NULL rather than raising — measured, not
-- assumed:
--
--   select set_config('request.jwt.claims',
--     '{"sub":"user_3J9TLACq8DyB6mcpqqoO3fYnzfS","role":"authenticated"}', true);
--   select auth.uid();   -->  NULL
--
-- Every policy in this schema is `auth.uid() = user_id`, and `user_id = null`
-- matches nothing. The failure mode is therefore not an error but every
-- signed-in user seeing an empty app, with nothing in the logs. That is why the
-- policies below read the claim directly instead.
--
-- Supabase's own position, from the docs change in supabase/supabase#29135:
-- auth.uid() is not usable with third-party auth.
--
-- Scope, measured against the live schema: 29 policies, 8 foreign keys, and 9
-- user columns. The four `id` columns that are their own primary keys are
-- unrelated to identity and stay uuid.

/* ------------------------------------------------------------ the identity */

-- One definition of "who is calling", so 29 policies cannot drift apart.
--
-- `auth.uid()` stays as a fallback: it costs a boolean and it keeps any
-- pre-existing Supabase session working during the switch. After the wipe every
-- caller is a Clerk user and only the first branch is ever taken.
create or replace function public.current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif((select auth.jwt()) ->> 'sub', ''),
    (select auth.uid())::text
  )
$$;

comment on function public.current_user_id() is
  'The Clerk user id for the current request, or null. Replaces auth.uid(), which returns null for a non-uuid sub.';

grant execute on function public.current_user_id() to authenticated, anon;

/* ------------------------------------------------- the columns, and the keys */

-- Foreign keys to auth.users go first: the columns are about to stop being uuid,
-- and these rows do not live in auth.users any more anyway. Mirroring Clerk users
-- into auth.users was considered and rejected — auth.users.id is uuid.
alter table public.profiles        drop constraint if exists profiles_id_fkey;
alter table public.user_drills     drop constraint if exists user_drills_user_id_fkey;
alter table public.drill_log       drop constraint if exists drill_log_user_id_fkey;
alter table public.focus_sessions  drop constraint if exists focus_sessions_user_id_fkey;
alter table public.mocks           drop constraint if exists mocks_user_id_fkey;
alter table public.syllabus_topics drop constraint if exists syllabus_topics_user_id_fkey;
alter table public.topic_status    drop constraint if exists topic_status_user_id_fkey;
alter table public.mistakes        drop constraint if exists mistakes_user_id_fkey;

-- Every policy has to go before the columns are retyped: Postgres refuses to
-- alter a column that a policy definition depends on, which is how this
-- migration first failed. They are all recreated below, so nothing is lost.
drop policy if exists "drill rows are self-readable" on public.drill_log;
drop policy if exists "drill rows are self-writable" on public.drill_log;
drop policy if exists "drill rows are self-updatable" on public.drill_log;
drop policy if exists "drill rows are self-deletable" on public.drill_log;
drop policy if exists "focus sessions are self-readable" on public.focus_sessions;
drop policy if exists "focus sessions are self-writable" on public.focus_sessions;
drop policy if exists "focus sessions are self-deletable" on public.focus_sessions;
drop policy if exists "mocks are self-readable" on public.mocks;
drop policy if exists "mocks are self-writable" on public.mocks;
drop policy if exists "mocks are self-updatable" on public.mocks;
drop policy if exists "mocks are self-deletable" on public.mocks;
drop policy if exists "mistakes are self-readable" on public.mistakes;
drop policy if exists "mistakes are self-writable" on public.mistakes;
drop policy if exists "mistakes are self-updatable" on public.mistakes;
drop policy if exists "mistakes are self-deletable" on public.mistakes;
drop policy if exists "drills are self-readable" on public.user_drills;
drop policy if exists "drills are self-writable" on public.user_drills;
drop policy if exists "drills are self-updatable" on public.user_drills;
drop policy if exists "drills are self-deletable" on public.user_drills;
drop policy if exists "topic status is self-readable" on public.topic_status;
drop policy if exists "topic status is self-writable" on public.topic_status;
drop policy if exists "topic status is self-updatable" on public.topic_status;
drop policy if exists "profiles are self-readable" on public.profiles;
drop policy if exists "profiles are self-insertable" on public.profiles;
drop policy if exists "profiles are self-updatable" on public.profiles;
drop policy if exists "syllabus shows shared and own topics" on public.syllabus_topics;
drop policy if exists "own syllabus topics are writable" on public.syllabus_topics;
drop policy if exists "own syllabus topics are updatable" on public.syllabus_topics;
drop policy if exists "own syllabus topics are deletable" on public.syllabus_topics;

-- Using the type change rebuilds every dependent index, so the ones worth
-- keeping are recreated explicitly afterwards rather than trusted to survive.
alter table public.profiles        alter column id      type text;
alter table public.user_drills     alter column user_id type text;
alter table public.drill_log       alter column user_id type text;
alter table public.focus_sessions  alter column user_id type text;
alter table public.mocks           alter column user_id type text;
alter table public.syllabus_topics alter column user_id type text;
alter table public.topic_status    alter column user_id type text;
alter table public.mistakes        alter column user_id type text;

create index if not exists drill_log_user_day_idx      on public.drill_log (user_id, on_day desc);
create index if not exists focus_user_day_idx          on public.focus_sessions (user_id, on_day desc);
create index if not exists mistakes_user_created_idx   on public.mistakes (user_id, created_at desc);
create index if not exists mocks_user_taken_idx        on public.mocks (user_id, taken_on);
create index if not exists syllabus_topics_user_idx    on public.syllabus_topics (user_id);
create index if not exists topic_status_user_idx       on public.topic_status (user_id);
create index if not exists user_drills_user_sort_idx   on public.user_drills (user_id, sort);

/* -------------------------------------------------------------- the policies */

-- Rewritten wholesale rather than patched: each one had its own copy of
-- `(select auth.uid()) = user_id`, which is how they were able to disagree in
-- the first place. Every one now calls current_user_id().

-- drill_log
drop policy if exists "drill rows are self-readable" on public.drill_log;
create policy "drill rows are self-readable" on public.drill_log
  for select to authenticated using (public.current_user_id() = user_id);

drop policy if exists "drill rows are self-writable" on public.drill_log;
create policy "drill rows are self-writable" on public.drill_log
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "drill rows are self-updatable" on public.drill_log;
create policy "drill rows are self-updatable" on public.drill_log
  for update to authenticated
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

drop policy if exists "drill rows are self-deletable" on public.drill_log;
create policy "drill rows are self-deletable" on public.drill_log
  for delete to authenticated using (public.current_user_id() = user_id);

-- focus_sessions
drop policy if exists "focus sessions are self-readable" on public.focus_sessions;
create policy "focus sessions are self-readable" on public.focus_sessions
  for select to authenticated using (public.current_user_id() = user_id);

drop policy if exists "focus sessions are self-writable" on public.focus_sessions;
create policy "focus sessions are self-writable" on public.focus_sessions
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "focus sessions are self-deletable" on public.focus_sessions;
create policy "focus sessions are self-deletable" on public.focus_sessions
  for delete to authenticated using (public.current_user_id() = user_id);

-- mocks
drop policy if exists "mocks are self-readable" on public.mocks;
create policy "mocks are self-readable" on public.mocks
  for select to authenticated using (public.current_user_id() = user_id);

drop policy if exists "mocks are self-writable" on public.mocks;
create policy "mocks are self-writable" on public.mocks
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "mocks are self-updatable" on public.mocks;
create policy "mocks are self-updatable" on public.mocks
  for update to authenticated
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

drop policy if exists "mocks are self-deletable" on public.mocks;
create policy "mocks are self-deletable" on public.mocks
  for delete to authenticated using (public.current_user_id() = user_id);

-- mistakes
drop policy if exists "mistakes are self-readable" on public.mistakes;
create policy "mistakes are self-readable" on public.mistakes
  for select to authenticated using (public.current_user_id() = user_id);

drop policy if exists "mistakes are self-writable" on public.mistakes;
create policy "mistakes are self-writable" on public.mistakes
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "mistakes are self-updatable" on public.mistakes;
create policy "mistakes are self-updatable" on public.mistakes
  for update to authenticated
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

drop policy if exists "mistakes are self-deletable" on public.mistakes;
create policy "mistakes are self-deletable" on public.mistakes
  for delete to authenticated using (public.current_user_id() = user_id);

-- user_drills
drop policy if exists "drills are self-readable" on public.user_drills;
create policy "drills are self-readable" on public.user_drills
  for select to authenticated using (public.current_user_id() = user_id);

drop policy if exists "drills are self-writable" on public.user_drills;
create policy "drills are self-writable" on public.user_drills
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "drills are self-updatable" on public.user_drills;
create policy "drills are self-updatable" on public.user_drills
  for update to authenticated
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

drop policy if exists "drills are self-deletable" on public.user_drills;
create policy "drills are self-deletable" on public.user_drills
  for delete to authenticated using (public.current_user_id() = user_id);

-- topic_status
drop policy if exists "topic status is self-readable" on public.topic_status;
create policy "topic status is self-readable" on public.topic_status
  for select to authenticated using (public.current_user_id() = user_id);

drop policy if exists "topic status is self-writable" on public.topic_status;
create policy "topic status is self-writable" on public.topic_status
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "topic status is self-updatable" on public.topic_status;
create policy "topic status is self-updatable" on public.topic_status
  for update to authenticated
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

-- profiles. The identity column here is `id`, not `user_id`.
drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable" on public.profiles
  for select to authenticated using (public.current_user_id() = id);

drop policy if exists "profiles are self-insertable" on public.profiles;
create policy "profiles are self-insertable" on public.profiles
  for insert to authenticated with check (public.current_user_id() = id);

drop policy if exists "profiles are self-updatable" on public.profiles;
create policy "profiles are self-updatable" on public.profiles
  for update to authenticated
  using (public.current_user_id() = id)
  with check (public.current_user_id() = id);

-- syllabus_topics. The shared seed rows have a null user_id and must stay
-- readable by everyone; only the private ones are identity-scoped.
drop policy if exists "syllabus shows shared and own topics" on public.syllabus_topics;
create policy "syllabus shows shared and own topics" on public.syllabus_topics
  for select to authenticated
  using (user_id is null or public.current_user_id() = user_id);

drop policy if exists "own syllabus topics are writable" on public.syllabus_topics;
create policy "own syllabus topics are writable" on public.syllabus_topics
  for insert to authenticated with check (public.current_user_id() = user_id);

drop policy if exists "own syllabus topics are updatable" on public.syllabus_topics;
create policy "own syllabus topics are updatable" on public.syllabus_topics
  for update to authenticated
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

drop policy if exists "own syllabus topics are deletable" on public.syllabus_topics;
create policy "own syllabus topics are deletable" on public.syllabus_topics
  for delete to authenticated using (public.current_user_id() = user_id);
