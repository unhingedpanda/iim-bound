# Supabase Auth → Clerk: migration state

**Status: in progress. `main` does not build. Do not deploy until the steps below are done.**

Last updated mid-migration. Everything here is reversible; nothing has been applied to
production data except the backup taken at the start.

## Why we are doing this

The trigger was not Clerk's feature set — it was two hosted Supabase settings:

```
mailer_autoconfirm       False   every new sign-up must click a link
rate_limit_email_sent    2       TWO auth emails per hour, project-wide
```

That ceiling is Supabase's shared SMTP. Clerk fixes it and brings username sign-in,
which Supabase Auth does not have.

## Done

| Step | Detail |
| --- | --- |
| Clerk CLI | 3.3.0, authenticated as `ryash1867@gmail.com` |
| Clerk app | `app_3J9RlDWw5Xhduh2Sy9uF9XAMwGg` ("IIM Bound"), linked via git remote |
| Clerk skills | `npx skills add clerk/skills --agent '*' -y` — 20 skills in `.agents/skills/` |
| SDK | `@clerk/nextjs` 7.9.2 |
| React | **19.2.0 → 19.2.8.** Clerk requires `~19.2.3`; install failed without it |
| Dev keys | `clerk env pull` → `.env.local`, redirects repointed `/` → `/today` |
| Prod keys | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD`, `CLERK_SECRET_KEY_PROD` (added by hand) |
| Prod instance | `ins_3J9T60OpKXCO2agAvtDIuD8BB3n` (live keys) |
| **`role` claim** | JWT template `supabase` created on the **dev** instance: `{"role":"authenticated"}`, RS256, 60s |
| `clerk doctor` | Clean. Warnings: production instance not in `.env.local` as the active keys; shell completion |
| Backup | `/tmp/backup/*.json` — 1 user, 1 profile, 4 drills, 2 drill_log rows (move this somewhere durable) |

`clerk init` also scaffolded `ClerkProvider` in `src/app/layout.tsx` and
`src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`.
It did **not** install the SDK, and it did not touch `src/proxy.ts` — the auth-gate and
`safeNext` hardening is still intact.

## The open question that gates everything

```
auth.uid()          -> uuid
auth.users.id       -> uuid
profiles.id         -> uuid    (and every other user column)
Clerk user id       -> user_3J9TLACq8DyB6mcpqqoO3fYnzfS   ← not a uuid
```

29 RLS policies in `public` are all shaped `auth.uid() = user_id`, and 16 foreign keys
point at `auth.users(id)`.

**If Supabase's third-party-auth integration coerces Clerk's `sub` into a uuid** (or sets
`auth.uid()` from a claim that is a uuid), then the schema stays exactly as it is, the RLS
policies need no edits, and the only work left is application code.

**If it does not**, the user columns have to become `text`, the 16 FKs to `auth.users` have
to be dropped (Clerk users do not live there), and every policy keeps working only because
`auth.uid()::text = user_id` still compares equal — which needs checking policy by policy.

Settle this first. Everything below depends on the answer, and guessing it wrong means
retyping seven tables twice.

Note: an earlier claim of mine in this session — that existing Supabase users could keep
their UUIDs because Clerk lets you specify a user id — was wrong. Clerk generates its own
`user_…` ids; the Platform API does not accept a caller-supplied one.

## Remaining work

1. **Verify the uuid question above.** Read Supabase's third-party auth docs, then prove it
   against a throwaway account rather than trusting the read.
2. **Register the integration in Supabase.** Dashboard → Authentication → Third-Party Auth →
   add Clerk for both instances' domains, or for local dev:
   ```toml
   [auth.third_party.clerk]
   enabled = true
   domain = "<your-app>.clerk.accounts.dev"
   ```
3. **Rewrite `src/proxy.ts`** to `clerkMiddleware` with the existing `isAppPath` predicate,
   keeping the `Cache-Control: private, no-store` on redirects. Add `'/__clerk/:path*'` to
   the matcher after `'/(api|trpc)(.*)'`.
   The current file enforces the auth gate and is the reason the gate works at all — it was
   at the repo root and silently ignored by Next 16 before this session.
4. **`src/lib/supabase/{server,client}.ts`** — pass Clerk's token via
   `accessToken: async () => (await auth()).getToken()` server-side, `getToken({template:'supabase'})`
   client-side. `currentUserId()` becomes Clerk's `userId`.
5. **Delete** `src/components/LoginForm.tsx` and `src/app/auth/callback/route.ts`; sign-out
   through Clerk's `signOut()` instead of the `/auth/signout` POST.
6. **Wipe and re-key** (the "start clean" decision): `yashr060@gmail.com` plus test rows go.
   `syllabus_topics` (42 shared topics) stays.
7. **Rework the test suites.** `tests/e2e/client.mjs` mints Supabase session cookies by hand —
   that approach dies with Clerk. Use Clerk's testing tokens (`@clerk/testing`) rather than
   weakening the suite; the RLS and day-window coverage is the valuable part.
8. **Wire Vercel**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` as the *live*
   values for Production, test values for Preview/Development.
9. **Lower the password minimum** if 15 characters is too strict — Clerk's instance config has
   `auth_password.min_length: 15` against the 6 you had on Supabase.

Already right in Clerk's config, no action needed: `auth_username.required_for_sign_up: true`,
`auth_username.used_for_sign_in: true`, `auth_password.enabled: true`, Google OAuth enabled.

## Deploy safety

`main` is red. Until step 1–5 land, any push to `main` deploys a build that imports
`@clerk/nextjs` with no Supabase boundary and no middleware — it will not compile. Deploy from
a branch, or finish the migration before pushing.
