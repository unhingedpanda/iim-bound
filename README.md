# IIM Bound

A daily logbook for CAT preparation. Drills with a timer behind each one, a mock log that works in
attempts and accuracy rather than a single percentile, a syllabus you can see the holes in, and an
error log that separates *didn't know it* from *knew it and slipped*.

Hosted for anyone who signs up. The source is public so you can read exactly what it does with your
data, file issues, and send patches.

**Live:** https://iimbound.vercel.app

## Why it exists

Most CAT prep dies of inconsistency, not of difficulty. The things that actually decide a percentile
are boring and hard to see from the inside:

- whether you touched all three sections **today**, not on average
- whether a weak section is a knowledge problem or a question-selection one
- which section is dragging your overall down across your last few mocks
- how much of the syllabus is left, and how much of it is only "shaky"
- whether your errors are knowledge gaps or timing and selection problems, which more studying
  does not fix

The register makes each of those a number on a screen instead of a feeling.

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Actions) |
| Styling | Tailwind CSS v4, CSS-first theme tokens |
| Data & auth | Supabase Postgres with row-level security, email magic-link sign-in |
| Lint & format | Biome |
| Hosting | Vercel |

Every user-owned table is protected by RLS with an ownership predicate, so one account cannot read
another's rows even if the API key leaks — the key is publishable by design.

## Running it locally

```bash
git clone <your-fork>
cd iim-bound
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev
```

You need a Supabase project. Create one, then apply the schema:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Or paste the files in `supabase/migrations/` into the SQL editor in the dashboard, in filename
order.

If `db push` cannot reach the database — the direct host is IPv6-only on some networks, and the
IPv4 pooler may be blocked — `npm run db:migrate <version>` applies one migration through the
Management API instead, using the CLI's own access token and recording it in
`schema_migrations` exactly as the CLI would:

```bash
npm run db:migrate 20260910050000
```

For a local stack instead, `npm run test:up` starts one from `supabase/config.toml`. Its ports are
in the `553xx` range rather than the Supabase defaults, so this project can run on the same machine
as other Supabase projects without fighting over `54321`.

For magic links to work locally, add `http://localhost:3000/auth/callback` to
**Authentication → URL configuration → Redirect URLs** in the Supabase dashboard.

### Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # Biome check
npm run format     # Biome check --write
npm run typecheck  # tsc --noEmit
npm run test       # fast: the exam model, the calendar, the route list, form parsing
npm run check      # lint + typecheck + test
npm run test:e2e   # the whole app against a real Supabase stack (see below)
npm run test:up    # start the local Supabase stack
npm run test:down  # stop it
```

## Deploying

Push to GitHub, import the repo in Vercel, and set two environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then add `https://<your-domain>/auth/callback` to the Supabase redirect URL list. No other
configuration is needed: the app itself holds no server-side secret, and the only database function
it calls (`log_focus_session`) runs as the caller under row-level security.

Only the two `NEXT_PUBLIC_*` variables are needed, and both are inlined at build time — a build made
with one project's values will keep talking to that project even if the environment changes
afterwards, so set them before `npm run build`.

## The prep model

CAT is fixed and the register treats it that way: three sections, the real paper (24 / 22 / 22
questions, 40 minutes each, +3 and −1 with no negative on TITA), and one date. Everything you ask of
*yourself* around it is a per-user row you can change from **Settings** — your drills and their
minute targets, how many of them a day has to hit to keep a streak, your sectional floor, the
percentile you are aiming at, your exam date, and your own syllabus topics alongside the shared
list.

### Scoring

`src/lib/cat.ts` holds the exam model and the score-to-percentile curves, taken from CAT 2025's
published results. That is what lets the mock log ask for **attempts and correct answers per
section** rather than a percentile:

- net score and accuracy are derived from what you entered, so a past paper or a free mock counts as
  much as a paid series
- where a series does report a percentile, that number is stored and always wins over the estimate
- the gap to your target is expressed in **correct answers**, because that is the only unit you can
  do anything about
- each section is diagnosed against the net questions your target percentile actually took, taken
  from the same curve its percentile comes from, so "attempt more" and "attempt fewer" are told
  apart instead of averaged
- a section you logged on its own is kept as a sectional mock with a sectional net. It gets no
  overall percentile, because the overall curve is calibrated against a whole paper

An estimate says where it came from. Between two published anchors it is an interpolation; past the
top anchor it is a floor, and the page says so rather than reporting a fourth decimal place the data
does not support. Scaling across slots means the whole thing is worth about ±1 percentile. It is a
compass, not a result.

### The error log

Six causes, because the fix differs for each and only the first is solved by studying: concept,
careless, misread, time, selection, and missed-easy. The last one is the biggest single score leak
in most mocks and the one a plain notes app never makes you count.

## How it is put together

Four modules carry the ideas, and everything else is presentation:

| Module | Holds |
| --- | --- |
| `src/lib/cat.ts` | The exam: pattern, marking, curves, and what a mock row means |
| `src/lib/day.ts` | The one clock. Which day it is, and which days a write may land on |
| `src/lib/server/writes.ts` | The only path to Postgres: a read that falls back, a write that throws a readable error |
| `src/lib/routes.ts` | The list of sign-in-walled routes, read by both the proxy and the nav |

Three rules the rest of the code follows:

- **One meaning per number.** Today's minutes, the day's target, the run grid and the streak all read
  the same set of drills, so the figures on one screen cannot contradict each other.
- **A write either succeeds or says why.** Nothing fires a Server Action and drops the result; a
  failure becomes a message in the form that sent it, or the error boundary behind it.
- **Nothing may be written to an arbitrary day.** `acceptDay` allows the client's own calendar within
  a day of the server's, and the `log_focus_session` function re-checks the same window itself,
  because it is reachable straight through the API.

### The mark

Three bars gaining under a squared rising rule, the tallest in the signal blue — the run grid in
miniature. The shapes live once in `src/lib/mark.ts` and are rendered by `src/components/Mark.tsx`
and by `src/app/icon.svg`, which Next serves as the favicon. A file cannot import a module, so
`tests/helpers.test.mjs` parses the SVG and checks it against the module: change a bar in one place
and the suite fails rather than the two quietly disagreeing.

Coordinates are whole pixels in a 32-unit box on purpose. A favicon is the one place this mark has
to be sharp, and fractional values anti-alias into mush at 16px.

## Tests

`npm run test` is fast and needs nothing running: it pins the exam model, the calendar arithmetic,
form parsing, the route list, and the rule that decides whether a day may be written to.

`npm run test:e2e` is the real thing. It starts the local Supabase stack, applies
`supabase/migrations` from scratch, builds the app, serves the production build on port 3100, and
then drives both through their real interfaces:

- the app's own query layer and Server Actions, called directly against real PostgREST, real
  row-level security and the real SQL function — one fresh account per test, so isolation is enforced
  by the database rather than by test discipline
- HTTP against the running server, for the middleware, the auth routes and the server-rendered HTML

Only two things are stood in for, both framework plumbing rather than behaviour: `next/headers`, and
`next/cache`'s `refresh()`. They live in `tests/e2e/stubs/`.

`npm run test:browser` drives a real Chromium against that same build and the same database, for the
things an HTTP response cannot show: where two rules actually land on the page, whether a sticky
header stays opaque, whether a rating survives a reload, whether the tabs are thumb-sized on a phone.
It is not a second copy of the suite above — the two check different questions, and a pixel scan
catches what markup assertions cannot.

Both suites share `tests/e2e/harness.sh`, so they are guaranteed to be looking at one build rather
than two.

```bash
npm run test:e2e       # ~1 minute; leaves the stack running, `npm run test:down` to stop it
npm run test:browser   # needs Chromium: `npx playwright install chromium`
npm run test:all       # check + e2e + browser
```

For looking at the app by hand there is `node scripts/demo-seed.mjs`: it makes a local account
(`demo@iimbound.local` / `demo-password-123`) with three weeks of plausible history, weighted so the
streak is real and the run grid has something to say. It refuses to run against anything that is not
127.0.0.1, and writes through PostgREST with the user's own token, so row-level security applies to
it exactly as it applies to the browser.

## Contributing

Issues and pull requests welcome. Please run `npm run check` before opening a PR. If you touch the
query layer, the actions, the SQL or the middleware, run `npm run test:e2e` too; if you touch layout,
colour or anything a person clicks, run `npm run test:browser`. Keep the visual language as it is:
heavy rules, one signal colour, flag red reserved strictly for a breached sectional floor.

## A note on the name

*IIM Bound* describes where its users are trying to get to. It is an independent project with no
connection to the Indian Institutes of Management, and nothing here is official CAT material. The
score-to-percentile curves are interpolated from publicly reported results and are a compass, not a
result.

## Licence

MIT — see [LICENSE](./LICENSE).
