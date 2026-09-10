# Supabase Auth → Clerk: what changed, and the trap in it

**Done and deployed.** This file is kept because one finding in it is a landmine: it was invisible in
the build, invisible in the logs, and would have shipped. `README.md` describes how the app works
now; this describes why one part of it is shaped the way it is.

## Why the move

Not Clerk's feature set. Two hosted Supabase settings:

```
mailer_autoconfirm       False   every new sign-up must click a link
rate_limit_email_sent    2       TWO auth emails per hour, project-wide
```

That ceiling is Supabase's shared SMTP, and it is not raisable on a hobby project. Clerk also brings
username sign-in, which Supabase Auth does not have.

## The trap: `auth.uid()` is NULL for a Clerk session

Proven on the local stack, not inferred:

```sql
begin;
select set_config('request.jwt.claims',
  '{"sub":"user_3J9TLACq8DyB6mcpqqoO3fYnzfS","role":"authenticated"}', true);
select auth.uid();   -->  NULL
rollback;
```

(Inside a transaction on purpose: `set_config(..., true)` is transaction-scoped, and psql
autocommits, so the same test run as two statements reports a false NULL.)

No exception. `auth.uid()` is declared `returns uuid`, and Clerk user ids are `user_…` strings, so the
cast yields NULL. Every policy here read `auth.uid() = user_id`, and `user_id = null` matches
nothing — so the failure mode is **not** an error. It is every signed-in user seeing an empty app,
with nothing in a log and nothing on screen. That is the kind of bug that ships.

Corroborated by Supabase's own docs change, *"you can no longer use `auth.uid()` in RLS policies when
using [third party] auth"* ([supabase#29135](https://github.com/supabase/supabase/pull/29135)), and by
repeated `invalid input syntax for type uuid` reports for Clerk against Supabase Storage.

**The consequence killed two plans**, recorded so they are not proposed again:

- ~~"Existing users can keep their UUIDs; Clerk lets you specify a user id."~~ Clerk generates its
  own `user_…` ids; the Platform API does not accept a caller-supplied one.
- ~~"Keep the schema and mirror Clerk users into `auth.users` so the 29 policies survive untouched."~~
  `auth.users.id` is `uuid` and `auth.uid()` is still NULL. It cannot work, and it would have failed
  silently at runtime rather than at build time.

## What the schema does instead

User columns are `text` holding the Clerk `sub`, and policies read the claim through one helper:

```sql
create function public.current_user_id() returns text
  language sql stable
  set search_path = ''
as $$ select coalesce(nullif(auth.jwt() ->> 'sub', ''), auth.uid()::text) $$;

-- 29 policies, from:  using ((select auth.uid()) = user_id)
--                 to:  using ((select public.current_user_id()) = user_id)
```

Exact scope, measured against the live schema:

| | count |
| --- | --- |
| RLS policies using `auth.uid()` | 29 |
| FK constraints in `public` → `auth.users` | 8 |
| User columns retyped `uuid` → `text` | 9 |
| `id` columns that **stayed** `uuid` | 4 (`focus_sessions`, `mocks`, `mistakes`, `user_drills` — their own PKs) |

The `auth.uid()::text` fallback in the helper is for pre-existing Supabase sessions during the
switch, and costs nothing now that none exist.

Two ordering details that cost a failed migration each:

- **All 29 policies must be dropped before the columns are retyped.** Postgres refuses to alter the
  type of a column a policy depends on, and the error names the policy rather than the fix.
- **The `log_focus_session` overloads must be dropped before they are recreated**, or the new ones
  land beside the old ones instead of replacing them.

`20260910060000_clerk_identity.sql` and `20260910070000_focus_rpc_clerk_identity.sql` are the two
migrations; they are idempotent enough to be re-run against a database that has already had them.

## What else moved

| Piece | Now |
| --- | --- |
| Identity in SQL | `auth.jwt() ->> 'sub'` via `current_user_id()`, never `auth.uid()` |
| Supabase client | `@supabase/supabase-js` with `accessToken: () => getToken({ template: 'supabase' })` |
| ~~`@supabase/ssr`~~ | Gone from both clients — it exists to persist Supabase's *own* session, and Clerk owns the session now |
| `src/proxy.ts` | `clerkMiddleware` + the existing `isAppPath` gate; passes `/__clerk` straight through |
| Sign-in UI | Clerk's `<SignIn>` at `/login`, themed to the app's tokens; `/signout` is a page, not a POST route |
| Deleted | `LoginForm.tsx`, `app/auth/callback`, `app/auth/signout`, `app/sign-in`, `app/sign-up`, `lib/clerk.ts` |

### Two things about `src/proxy.ts` worth remembering

`/__clerk` must reach Clerk **without** the auth gate running over it. Running the gate across the
proxy path produced Clerk's *"Refreshing the session token resulted in an infinite redirect loop …
your keys do not match"* — a message that sends you to check the keys, which were identical. The
cause was the middleware, not the keys.

And Clerk's dev instance will not settle a session on `127.0.0.1`. Use `localhost`. The suite always
did; manual testing did not, which cost an hour.

## The wipe

The tables were emptied rather than migrated: there was one user (`yashr060@gmail.com`), four drills
and two drill rows. Preserved: the 42 shared `syllabus_topics`. Backup of the old rows at
`~/iim-bound-backup-20260911/`.

That was the right call precisely because the tables were empty — the retype is cheap now and
expensive once there is history in them.

## Verifying a fresh deployment

The things that would silently regress, in the order they fail:

1. `/login` renders Clerk's form, not a blank panel. A missing `CLERK_SECRET_KEY` shows an empty
   page, not an error.
2. Sign in, then confirm the run grid is there rather than empty — this is the `auth.uid()` trap.
3. Load the same page in a second account and confirm it is *empty*, not the first account's data.
4. `select count(*) from syllabus_topics` is still 42 — the shared topics are not user-scoped.

The e2e suite covers 1 through 4 against the local stack; `tests/browser/` covers 1 and 2 in a real
browser against a real Clerk session.
