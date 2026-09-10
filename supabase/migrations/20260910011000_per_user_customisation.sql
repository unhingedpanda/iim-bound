-- Per-user customisation: drills, thresholds, and own syllabus topics.

alter table public.profiles
  add column if not exists streak_threshold smallint not null default 3
    check (streak_threshold between 1 and 12),
  add column if not exists section_floor numeric(5,2) not null default 85
    check (section_floor between 0 and 100),
  add column if not exists target_percentile numeric(5,2) not null default 99
    check (target_percentile between 0 and 100),
  add column if not exists theme text not null default 'system'
    check (theme in ('system', 'light', 'dark'));

alter table public.profiles drop column if exists daily_goal_minutes;

-- Drills are now rows, not constants.
create table if not exists public.user_drills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  slug           text not null check (char_length(slug) between 1 and 32),
  label          text not null check (char_length(label) between 1 and 40),
  blurb          text check (char_length(blurb) <= 120),
  target_minutes integer not null default 30 check (target_minutes between 1 and 600),
  sort           smallint not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.user_drills enable row level security;

create policy "drills are self-readable" on public.user_drills for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "drills are self-writable" on public.user_drills for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "drills are self-updatable" on public.user_drills for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "drills are self-deletable" on public.user_drills for delete
  to authenticated using ((select auth.uid()) = user_id);

create index if not exists user_drills_user_sort_idx
  on public.user_drills (user_id, sort);

-- Syllabus: shared rows have a null owner; a user may add their own.
alter table public.syllabus_topics
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

drop policy if exists "syllabus is readable by signed-in users" on public.syllabus_topics;

create policy "syllabus shows shared and own topics" on public.syllabus_topics for select
  to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy "own syllabus topics are writable" on public.syllabus_topics for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "own syllabus topics are updatable" on public.syllabus_topics for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own syllabus topics are deletable" on public.syllabus_topics for delete
  to authenticated using ((select auth.uid()) = user_id);

create index if not exists syllabus_topics_user_idx on public.syllabus_topics (user_id);

grant select, insert, update, delete on public.user_drills to authenticated;
grant insert, update, delete on public.syllabus_topics to authenticated;
grant usage, select on all sequences in schema public to authenticated;
