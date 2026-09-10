-- A mock is not one percentile. Every CAT analysis guide records attempts and
-- correct answers per section; net score, accuracy and an estimated percentile
-- are derived from those. The reported percentile stays optional, because a
-- past-paper or free mock gives you marks and no percentile at all.

alter table public.mocks
  add column if not exists varc_attempted smallint check (varc_attempted between 0 and 24),
  add column if not exists varc_correct   smallint check (varc_correct   between 0 and 24),
  add column if not exists dilr_attempted smallint check (dilr_attempted between 0 and 22),
  add column if not exists dilr_correct   smallint check (dilr_correct   between 0 and 22),
  add column if not exists qa_attempted   smallint check (qa_attempted   between 0 and 22),
  add column if not exists qa_correct     smallint check (qa_correct     between 0 and 22),
  add column if not exists takeaway       text     check (char_length(takeaway) <= 300),
  add column if not exists reviewed_on    date;

do $$ begin
  alter table public.mocks
    add constraint mocks_correct_within_attempted check (
      coalesce(varc_correct, 0) <= coalesce(varc_attempted, 24)
      and coalesce(dilr_correct, 0) <= coalesce(dilr_attempted, 22)
      and coalesce(qa_correct, 0)   <= coalesce(qa_attempted, 22)
    );
exception when duplicate_object then null; end $$;

-- Mistakes come out of a mock review, so let them point back at the mock.
alter table public.mistakes
  add column if not exists mock_id uuid references public.mocks (id) on delete set null;

create index if not exists mistakes_mock_idx on public.mistakes (mock_id);

-- Two more root causes the analysis guides separate out: misreading a question
-- you knew, and skipping one you could have solved (the biggest score leak).
alter table public.mistakes drop constraint if exists mistakes_cause_check;
alter table public.mistakes
  add constraint mistakes_cause_check
  check (cause in ('concept', 'careless', 'misread', 'time', 'selection', 'missed'));
