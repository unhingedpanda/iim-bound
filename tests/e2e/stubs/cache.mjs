/**
 * next/cache, outside a request.
 *
 * Server Actions call refresh() to re-render what the person is looking at.
 * There is no client router here, so it becomes a no-op — but it counts, so a
 * test can assert that a write asked for a refresh instead of silently
 * forgetting to. That assertion is the regression guard for the revalidate
 * bookkeeping this suite replaced.
 */

export function refresh() {
  globalThis.__E2E_REFRESHES__ = (globalThis.__E2E_REFRESHES__ ?? 0) + 1;
}

export function revalidatePath() {
  globalThis.__E2E_REFRESHES__ = (globalThis.__E2E_REFRESHES__ ?? 0) + 1;
}

export function revalidateTag() {}

export function updateTag() {}
