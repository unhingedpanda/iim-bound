# Supabase Auth → Clerk: migration state

**Status: in progress on the `clerk-migration` branch. `main` is still Supabase Auth and is
deployable — keep it that way until this is finished.**

## Why

Not Clerk's feature set. Two hosted Supabase settings:

```
mailer_autoconfirm       False   every new sign-up must click a link
rate_limit_email_sent    2       TWO auth emails per hour, project-wide
```

That ceiling is Supabase's shared SMTP. Clerk fixes it and brings username sign-in, which
Supabase Auth does not have.

## The finding that decides the whole migration

**`auth.uid()` returns NULL for a Clerk session.** Proven on the local stack, not inferred:

```sql
select set_config('request.jwt.claims',
  '{"sub":"user_3J9TLACq8DyB6mcpqqoO3fYnzfS","role":"authenticated"}', true);
select auth.uid();   -->  NULL
```

No exception. `auth.uid()` is declared `returns uuid`, and Clerk user ids are
`user_…` strings, so the cast yields NULL.

Why that is the dangerous part: every policy here is `auth.uid() = user_id`, and
`user_id = null` matches nothing. So the failure mode is **not** an error — it is every
signed-in user seeing an empty app. Nothing in a log, nothing on screen. This is the kind of
bug that ships.

Corroborated by Supabase's own docs change, *"you can no longer use `auth.uid()` in RLS
policies when using [third party] auth"*
([supabase#29135](https://github.com/supabase/supabase/pull/29135)), and by repeated
`invalid input syntax for type uuid` reports for Clerk against Supabase Storage.

**Consequence: the original plan — keep the schema, mirror Clerk users into `auth.users` so
`auth.uid()` keeps working — is dead.** It cannot work, and it would have failed silently at
runtime rather than at build time.

Earlier claims in this session that I have since disproved, recorded so they are not repeated:

- ~~"Existing users can keep their UUIDs; Clerk lets you specify a user id."~~ Clerk generates
  its own `user_…` ids; the Platform API does not accept a caller-supplied one.
- ~~"Keep the schema and the 29 RLS policies survive untouched."~~ They do not. See above.

## The correct shape

User columns become `text` holding the Clerk `sub`, and policies read the claim directly:

```sql
-- 29 policies, from:
using ((select auth.uid()) = user_id)
-- to:
using ((select auth.jwt() ->> 'sub') = user_id)
```

Exact scope, measured against the live schema:

| | count |
| --- | --- |
| RLS policies using `auth.uid()` | 29 |
| FK constraints in `public` → `auth.users` | 8 |
| User columns to retype `uuid` → `text` | 9 |
| `id` columns that **stay** `uuid` | 4 (`focus_sessions`, `mocks`, `mistakes`, `user_drills` — their own PKs) |

Nine columns, not twelve: `id` on those four tables is unrelated to identity.

`auth.uid()` may keep working for *pre-existing Supabase sessions*, so during the switch both
must be checked — but every user will be a Clerk user after the wipe, so the policies can go
straight to the claim.

## Done

| Step | Detail |
| --- | --- |
| Clerk CLI | 3.3.0, authenticated as `ryash1867@gmail.com` |
| Clerk app | `app_3J9RlDWw5Xhduh2Sy9uF9XAMwGg` ("IIM Bound"), linked via git remote |
| Clerk skills | 20 skills in `.agents/skills/` (`npx skills add clerk/skills --agent '*' -y`) |
| SDK | `@clerk/nextjs` 7.9.2 |
| React | **19.2.0 → 19.2.8.** Clerk 7.9.2 requires `~19.2.3` and refused to install otherwise |
| Dev keys | `clerk env pull` → `.env.local`; fallback redirects repointed `/` → `/today` |
| Prod keys | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD`, `CLERK_SECRET_KEY_PROD` (added by hand) |
| Instances | dev `ins_3J9RlCZTjSyAppqIGH3d5DbvYLl`, prod `ins_3J9T60OpKXCO2agAvtDIuD8BB3n` |
| Dev frontend API | `https://stirred-sheepdog-6790.clerk.accounts.dev` (verified live; issuer is the bare host, no path) |
| Supabase ⟷ Clerk | **Third-Party Auth connection registered and ENABLED** for the dev domain |
| `role` claim | Clerk's "Connect with Supabase" sets it on the session token. A JWT template named `supabase` also exists on both instances (kept, so the client can request an explicit token) |
| Production backup | `~/iim-bound-backup-20260911/` — 1 user, 1 profile, 4 drills, 2 drill_log rows |

`clerk init` scaffolded `ClerkProvider` in `src/app/layout.tsx` and the `/sign-in`,
`/sign-up` catch-all routes. It did **not** install the SDK, and it did **not** touch
`src/proxy.ts` — the auth-gate and `safeNext` hardening is intact.

Two build breaks it caused, both fixed: the missing SDK, and an `agent/` tree of skill
templates whose TypeScript was typechecked via tsconfig's `**/*.ts`. `agent/` and `.agents/`
are now excluded and gitignored.

Already correct in Clerk's config, no action needed: `auth_username.required_for_sign_up: true`,
`auth_username.used_for_sign_in: true`, `auth_password.enabled: true`, Google OAuth enabled.
Note `auth_password.min_length: 15` against the 6 you had on Supabase — lower it if that is too
strict for a prep tracker.

## Remaining work

1. **Schema migration.** `uuid` → `text` on the nine user columns, drop the 8 FKs to
   `auth.users`, rewrite the 29 policies to `auth.jwt() ->> 'sub'`. Cheap now and expensive
   later precisely because the wipe was chosen — the tables are empty.
2. **`src/proxy.ts` → `clerkMiddleware`**, keeping the `isAppPath` predicate and the
   `Cache-Control: private, no-store` on redirects. Add `'/__clerk/:path*'` to the matcher
   after `'/(api|trpc)(.*)'`. This file is the reason the auth gate works at all — it sat at
   the repo root and was silently ignored by Next 16 before this work.
3. **`src/lib/supabase/{server,client}.ts`** — pass Clerk's token. Server:
   `accessToken: async () => (await auth()).getToken()`. Client:
   `getToken({ template: 'supabase' })`. `currentUserId()` becomes Clerk's `userId` (a string).
4. **Types follow the schema.** `Profile.id`, `getProfile(userId)`, `requireUser()` and every
   `userId: string` that was `string`-as-uuid are now genuinely arbitrary text — worth a
   `ClerkUserId` branded type so a uuid cannot creep back in.
5. **Delete** `src/components/LoginForm.tsx` and `src/app/auth/callback/route.ts`. Sign out via
   Clerk's `signOut()` instead of the `/auth/signout` POST.
6. **Wipe** (the "start clean" decision): `yashr060@gmail.com` and the test rows go.
   `syllabus_topics` (42 shared topics) stays.
7. **Rework the tests.** `tests/e2e/client.mjs` mints Supabase session cookies by hand; that
   approach dies with Clerk. Move to `@clerk/testing` tokens rather than weakening the suite —
   the RLS and day-window coverage is the valuable part.
8. **Vercel env**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` as the **live**
   values for Production, test values for Preview and Development.
9. **Production Clerk domain.** Clerk's primary domain is currently `iimbound.vercel.app` with
   the frontend API at `https://iimbound.vercel.app/__clerk` — a proxy through the Next app, so
   it 404s until `clerkMiddleware` ships (verified: the discovery doc 404s today). Either add
   the CNAME `clerk.iimbound.vercel.app → frontend-api.clerk.services` for a clean bare host,
   or register the `/__clerk` URL after step 2 deploys. Worth moving to a domain you own rather
   than a `.vercel.app` preview host before real users arrive.

## Deploy safety

`main` is untouched and deployable. This branch builds (`npm run check` green, `next build`
green) but its auth boundary is half-converted: `ClerkProvider` and `/sign-in` exist while
`src/proxy.ts` still checks Supabase sessions. **Do not merge to `main` until steps 1–5 are
done** — merging now would deploy a shell that cannot authenticate anyone.
