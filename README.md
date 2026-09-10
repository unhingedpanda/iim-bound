# CAT Register

A daily register for CAT preparation. Drills with a timer behind each one, a mock log that works in
attempts and accuracy rather than a single percentile, a syllabus you can see the holes in, and an
error log that separates *didn't know it* from *knew it and slipped*.

Hosted for anyone who signs up. The source is public so you can read exactly what it does with your
data, file issues, and send patches.

**Live:** _add your Vercel URL here_

## Why it exists

Most CAT prep dies of inconsistency, not of difficulty. The things that actually decide a percentile
are boring and hard to see from the inside:

- whether you touched all three sections **today**, not on average
- whether a weak section is a knowledge problem or a question-selection one
- which section is dragging your overall down across your last few mocks
- how much of the syllabus you can genuinely do at speed
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
cd cat-register
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

For magic links to work locally, add `http://localhost:3000/auth/callback` to
**Authentication → URL configuration → Redirect URLs** in the Supabase dashboard.

### Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # Biome check
npm run format     # Biome check --write
npm run typecheck  # tsc --noEmit
npm run test       # the CAT scoring model's self-check
npm run check      # lint + typecheck + test
```

## Deploying

Push to GitHub, import the repo in Vercel, and set two environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then add `https://<your-domain>/auth/callback` to the Supabase redirect URL list. No other
configuration is needed — there is no server-side secret.

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

- net score, accuracy and an estimated percentile are derived, so a past paper or a free mock counts
  as much as a paid series
- where a series does report a percentile, that number is stored and always wins over the estimate
- the gap to your target is expressed in **correct answers**, because that is the only unit you can
  do anything about
- each section is diagnosed against the net questions a 99th percentile actually took (VARC 15,
  DILR 13, QA 12), so "attempt more" and "attempt fewer" are told apart instead of averaged

Scaling across slots means any estimate is worth about ±1 percentile. It is a compass, not a result.

### The error log

Six causes, because the fix differs for each and only the first is solved by studying: concept,
careless, misread, time, selection, and missed-easy. The last one is the biggest single score leak
in most mocks and the one a plain notes app never makes you count.

## Contributing

Issues and pull requests welcome. Please run `npm run check` before opening a PR. Keep the visual
language as it is: heavy rules, one signal colour, flag red reserved strictly for a breached
sectional floor.

## Licence

MIT — see [LICENSE](./LICENSE).
