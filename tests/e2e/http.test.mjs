/**
 * The app as a server actually behaves.
 *
 * These run against the production build on a real port, so what is exercised
 * is the middleware (proxy), the route handlers, and the server-rendered HTML —
 * the parts that unit-testing the React tree cannot reach.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_URL, cookieHeader, newUser, sessionCookies } from "./client.mjs";

async function request(path, { cookies, headers = {} } = {}) {
  const response = await fetch(`${APP_URL}${path}`, {
    redirect: "manual",
    headers: { ...(cookies ? { cookie: cookieHeader(cookies) } : {}), ...headers },
  });
  const raw = await response.text();
  return {
    response,
    location: response.headers.get("location"),
    // The RSC payload is JSON inside a script tag, so its quotes arrive
    // escaped, and React puts hydration comments between adjacent text nodes.
    // Undo both so assertions can be written against the copy as it reads.
    body: raw.replace(/\\"/g, '"').replace(/<!-- -->/g, ""),
  };
}

describe("route protection", () => {
  const gated = ["/today", "/mocks", "/syllabus", "/errors", "/settings"];

  it("sends a signed-out visitor to the sign-in form with a way back", async () => {
    for (const path of gated) {
      const { response, location } = await request(path);
      assert.equal(response.status, 307, `${path} should redirect`);
      assert.ok(location?.startsWith("/login"), `${path} → ${location}`);
      // The parameter arrives percent-encoded, so compare it decoded.
      const next = new URL(location, APP_URL).searchParams.get("next");
      assert.equal(next, path, `${path} should carry a next so the visit is not lost`);
    }
  });

  it("does not let a redirect be cached for the next visitor", async () => {
    // Without this a shared cache can hand a signed-in visitor the redirect
    // that was minted for a signed-out one.
    const { response } = await request("/today");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  });

  // "admits a signed-in visitor" and "keeps one off the entry pages" used to
  // live here, reached with a hand-built Supabase session cookie. Nothing builds
  // one any more: a session is Clerk's, and an HTTP-only client cannot complete
  // Clerk's sign-in. Both assertions moved to tests/browser/layout.spec.ts,
  // where a real signed-in browser is available and the check is stronger.

  it("leaves the public pages public", async () => {
    for (const path of ["/", "/login", "/demo", "/demo/mocks", "/demo/syllabus", "/demo/errors"]) {
      const { response } = await request(path);
      assert.equal(response.status, 200, `${path} should be reachable signed out`);
    }
  });

});

// The run grid used to be asserted here, against /today's server-rendered HTML.
// Fetching that page needs a real Clerk session now, which an HTTP client cannot
// obtain, so the same assertions live in tests/browser/layout.spec.ts where a
// signed-in browser already is — including the two that cost real bugs to find:
// the exam day owning a square, and every square carrying the --fill the motion
// hangs off.

describe("sign-in", () => {
  it("serves Clerk's component, not a home-made email form", async () => {
    const { response, body } = await request("/login");
    assert.equal(response.status, 200);
    // Clerk's publishable key is what mounts its client; if it stops appearing,
    // the form is gone and the page is a shell.
    assert.match(body, /data-clerk-publishable-key/, "Clerk's key should be on the page");
    assert.match(body, /clerk-js-script/, "and its client script");
  });

  it("routes Clerk at the app's own sign-in screen", async () => {
    // The form itself is NOT in this HTML: Clerk's component bails out to
    // client-side rendering, so the fields only exist after its client mounts —
    // which is why the field-level assertions live in the browser suite. What
    // the server does decide is where Clerk sends people, and that is checked
    // here from the RSC payload.
    const { body } = await request("/login");
    assert.match(body, /\"signInUrl\":\"\/login\"/, "sign-in should stay on our route");
    assert.match(body, /\"signUpUrl\":\"\/login\"/, "and so should sign-up");
    assert.match(
      body,
      /\"signInFallbackRedirectUrl\":\"\/today\"/,
      "a finished sign-in should land in the logbook, not the marketing page",
    );
  });

  it("keeps a hostile next out of the redirect, wherever it is consumed", async () => {
    // `next=//evil.com` is a protocol-relative URL: `${origin}${next}` lands the
    // visitor on another host with a real sign-in link as the bait. This test
    // used to point at /auth/callback, which no longer exists — but the rule it
    // was protecting still does, in safeNext() and in the proxy, so it is
    // asserted against the surfaces that consume the parameter today.
    const hostile = ["//evil.com/x", "https://evil.com", "/\\evil.com", "//evil.com"];
    for (const value of hostile) {
      const { location } = await request(`/today?next=${encodeURIComponent(value)}`);
      const target = new URL(location, APP_URL);
      assert.equal(target.hostname, new URL(APP_URL).hostname, `${value} changed host`);
      assert.equal(target.port, new URL(APP_URL).port, `${value} left the app's port`);
      assert.equal(target.pathname, "/login", `${value} did not land on sign-in`);
      // The proxy owns this parameter and only ever writes the path it is
      // gating, so a hostile value cannot survive into the redirect.
      assert.equal(
        target.searchParams.get("next"),
        "/today",
        `${value} influenced the next parameter`,
      );
    }
  });

  it("signs out through Clerk's page, not a GET that signs you out", async () => {
    // The old route was a POST form to /auth/signout, which meant a prefetch or
    // a back button could end a session as a side effect of a page load. Clerk's
    // page asks first.
    const { response, body } = await request("/signout");
    assert.equal(response.status, 200);
    assert.match(body, /Signed out/i);
  });
});

describe("response hygiene", () => {
  it("sets the headers that keep a page from being framed or sniffed", async () => {
    const { response } = await request("/login");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.ok(response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"));
  });
});
