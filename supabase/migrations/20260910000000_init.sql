-- CAT Register — initial schema.
-- Every user-owned table is RLS-protected with an ownership predicate.
-- auth.uid() is wrapped in a scalar subquery so the planner evaluates it once
-- per statement rather than once per row.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  exam_date   date not null default '2026-11-29',
  started_on  date not null default current_date,
  daily_goal_minutes smallint not null default 145 check (daily_goal_minutes between 15 and 900),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles are self-insertable"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles are self-updatable"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------- drill log

create table if not exists public.drill_log (
  user_id   uuid not null references auth.users (id) on delete cascade,
  on_day    date not null,
  drill_key text not null check (char_length(drill_key) between 1 and 32),
  minutes   integer not null default 0 check (minutes between 0 and 1440),
  done      boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, on_day, drill_key)
);

alter table public.drill_log enable row level security;

create policy "drill rows are self-readable"
  on public.drill_log for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "drill rows are self-writable"
  on public.drill_log for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "drill rows are self-updatable"
  on public.drill_log for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "drill rows are self-deletable"
  on public.drill_log for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists drill_log_user_day_idx
  on public.drill_log (user_id, on_day desc);

-- ---------------------------------------------------------------- mocks

create table if not exists public.mocks (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  taken_on  date not null,
  series    text not null check (char_length(series) between 1 and 80),
  varc      numeric(5,2) check (varc between 0 and 100),
  dilr      numeric(5,2) check (dilr between 0 and 100),
  qa        numeric(5,2) check (qa between 0 and 100),
  overall   numeric(5,2) check (overall between 0 and 100),
  reviewed  boolean not null default false,
  note      text,
  created_at timestamptz not null default now()
);

alter table public.mocks enable row level security;

create policy "mocks are self-readable"
  on public.mocks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "mocks are self-writable"
  on public.mocks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "mocks are self-updatable"
  on public.mocks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "mocks are self-deletable"
  on public.mocks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists mocks_user_taken_idx
  on public.mocks (user_id, taken_on);

-- ---------------------------------------------------------------- syllabus

-- Shared reference data, identical for everyone. Read-only to clients.
create table if not exists public.syllabus_topics (
  id      integer primary key generated always as identity,
  section text not null check (section in ('VARC', 'DILR', 'QA')),
  name    text not null,
  sort    smallint not null default 0,
  unique (section, name)
);

alter table public.syllabus_topics enable row level security;

create policy "syllabus is readable by signed-in users"
  on public.syllabus_topics for select
  to authenticated
  using (true);

create table if not exists public.topic_status (
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic_id   integer not null references public.syllabus_topics (id) on delete cascade,
  confidence smallint not null default 0 check (confidence between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

alter table public.topic_status enable row level security;

create policy "topic status is self-readable"
  on public.topic_status for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "topic status is self-writable"
  on public.topic_status for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "topic status is self-updatable"
  on public.topic_status for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists topic_status_user_idx on public.topic_status (user_id);

-- ---------------------------------------------------------------- focus

create table if not exists public.focus_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  on_day     date not null,
  drill_key  text not null,
  seconds    integer not null check (seconds between 1 and 86400),
  ended_at   timestamptz not null default now()
);

alter table public.focus_sessions enable row level security;

create policy "focus sessions are self-readable"
  on public.focus_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "focus sessions are self-writable"
  on public.focus_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "focus sessions are self-deletable"
  on public.focus_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists focus_user_day_idx
  on public.focus_sessions (user_id, on_day desc);

-- ---------------------------------------------------------------- mistakes

create table if not exists public.mistakes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  section    text not null check (section in ('VARC', 'DILR', 'QA')),
  topic      text,
  note       text not null check (char_length(note) between 1 and 2000),
  cause      text not null default 'concept'
             check (cause in ('concept', 'careless', 'time', 'selection')),
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.mistakes enable row level security;

create policy "mistakes are self-readable"
  on public.mistakes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "mistakes are self-writable"
  on public.mistakes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "mistakes are self-updatable"
  on public.mistakes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "mistakes are self-deletable"
  on public.mistakes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists mistakes_user_created_idx
  on public.mistakes (user_id, created_at desc);

-- ---------------------------------------------------------------- grants

grant select, insert, update, delete on
  public.profiles, public.drill_log, public.mocks,
  public.topic_status, public.focus_sessions, public.mistakes
  to authenticated;

grant select on public.syllabus_topics to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------- seed

insert into public.syllabus_topics (section, name, sort) values
  ('QA', 'Percentages', 10),
  ('QA', 'Ratio and proportion', 20),
  ('QA', 'Averages and alligation', 30),
  ('QA', 'Profit, loss and discount', 40),
  ('QA', 'Simple and compound interest', 50),
  ('QA', 'Time, speed and distance', 60),
  ('QA', 'Time and work', 70),
  ('QA', 'Linear equations', 80),
  ('QA', 'Quadratic equations', 90),
  ('QA', 'Inequalities and modulus', 100),
  ('QA', 'Functions and graphs', 110),
  ('QA', 'Logarithms, indices, surds', 120),
  ('QA', 'Progressions', 130),
  ('QA', 'Number system: divisibility', 140),
  ('QA', 'Number system: remainders', 150),
  ('QA', 'Number system: factors', 160),
  ('QA', 'Geometry: triangles', 170),
  ('QA', 'Geometry: circles', 180),
  ('QA', 'Coordinate geometry', 190),
  ('QA', 'Mensuration', 200),
  ('QA', 'Permutations and combinations', 210),
  ('QA', 'Probability', 220),
  ('DILR', 'Tables and caselets', 10),
  ('DILR', 'Bar, line and pie charts', 20),
  ('DILR', 'Venn diagrams', 30),
  ('DILR', 'Arrangements: linear', 40),
  ('DILR', 'Arrangements: circular', 50),
  ('DILR', 'Matrix and grid puzzles', 60),
  ('DILR', 'Binary and conditional logic', 70),
  ('DILR', 'Games and tournaments', 80),
  ('DILR', 'Scheduling and routes', 90),
  ('DILR', 'Data sufficiency', 100),
  ('DILR', 'Quant-heavy DI sets', 110),
  ('DILR', 'Set selection under time', 120),
  ('VARC', 'Reading comprehension: main idea', 10),
  ('VARC', 'Reading comprehension: inference', 20),
  ('VARC', 'Reading comprehension: tone and attitude', 30),
  ('VARC', 'Reading comprehension: elimination technique', 40),
  ('VARC', 'Para summary', 50),
  ('VARC', 'Para jumbles', 60),
  ('VARC', 'Odd sentence out', 70),
  ('VARC', 'Critical reasoning', 80)
on conflict (section, name) do nothing;
