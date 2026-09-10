/**
 * next/headers, as much of it as the app uses.
 *
 * The app calls `cookies()` from its Supabase server client, awaiting it the
 * way `cookies()` behaves inside a Next request. Outside a request there is
 * nothing to read, so the suite binds a jar here and the auth-js adapter reads
 * and writes it exactly as it would in production — including writing a
 * refreshed session back, which is why set() has to work.
 */

function jar() {
  if (!globalThis.__E2E_COOKIE_JAR__) {
    throw new Error("No cookie jar bound. Call bindSession(cookies) before using the app modules.");
  }
  return globalThis.__E2E_COOKIE_JAR__;
}

export function bindCookieJar(cookies = {}) {
  const store = new Map(Object.entries(cookies));
  const adapter = {
    getAll: () => [...store].map(([name, value]) => ({ name, value })),
    get: (name) => (store.has(name) ? { name, value: store.get(name) } : undefined),
    set: (name, value) => {
      // Supports both cookies().set(name, value) and set({ name, value }).
      if (typeof name === "object" && name !== null) store.set(name.name, name.value);
      else if (typeof value === "object" && value !== null) store.set(value.name, value.value);
      else store.set(name, value);
    },
    delete: (name) => store.delete(name),
    has: (name) => store.has(name),
    toString: () => [...store].map(([n, v]) => `${n}=${v}`).join("; "),
    snapshot: () => Object.fromEntries(store),
  };
  globalThis.__E2E_COOKIE_JAR__ = adapter;
  return adapter;
}

/** Awaitable, like the real one. */
export function cookies() {
  return Promise.resolve(jar());
}

export function headers() {
  return Promise.resolve(new Headers());
}
