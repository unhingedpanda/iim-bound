-- Custom topic names were globally unique: unique (section, name) meant Bob
-- could not add a topic Alice already had, and nobody could reuse a seed name.
-- Scope uniqueness per owner instead. Shared rows (user_id null) stay globally
-- unique so the seed's ON CONFLICT semantics hold; user rows are unique per
-- user. Safe to apply: the old global constraint already forbids every
-- duplicate the new indexes would reject, so creation cannot fail on live data.
alter table public.syllabus_topics
  drop constraint if exists syllabus_topics_section_name_key;

create unique index if not exists syllabus_topics_shared_name_idx
  on public.syllabus_topics (section, name)
  where user_id is null;

create unique index if not exists syllabus_topics_user_name_idx
  on public.syllabus_topics (section, name, user_id)
  where user_id is not null;
