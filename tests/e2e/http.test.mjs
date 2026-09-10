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

  it("admits a signed-in visitor to every gated page", async () => {
    const user = await newUser();
    const cookies = sessionCookies(user.session);

    for (const path of gated) {
      const { response, body } = await request(path, { cookies });
      assert.equal(response.status, 200, `${path} should render, got ${response.status}`);
      assert.ok(body.includes("IIM Bound"), `${path} should render the app shell`);
    }
  });

  it("keeps a signed-in visitor off the entry pages", async () => {
    const user = await newUser();
    const cookies = sessionCookies(user.session);

    for (const path of ["/", "/login"]) {
      const { response, location } = await request(path, { cookies });
      assert.equal(response.status, 307, `${path} should redirect for a signed-in visitor`);
      assert.ok(location?.endsWith("/today"), `${path} → ${location}`);
    }
  });

  it("leaves the public pages public", async () => {
    for (const path of ["/", "/login", "/demo", "/demo/mocks", "/demo/syllabus", "/demo/errors"]) {
      const { response } = await request(path);
      assert.equal(response.status, 200, `${path} should be reachable signed out`);
    }
  });

  it("treats a wrong session cookie as signed out", async () => {
    const user = await newUser();
    const cookies = sessionCookies(user.session);
    const [name] = Object.keys(cookies);

    const { response, location } = await request("/today", { cookies: { [name]: "garbage" } });
    assert.equal(response.status, 307);
    assert.ok(location?.startsWith("/login"));
  });
});

describe("the run grid", () => {
  it("gives the exam day a square of its own", async () => {
    // The bug: the grid was built from an exclusive day count, so its last
    // square was the day before the exam and the exam itself never appeared.
    // Every square carries its own date in a title, which is what is read here.
    const user = await newUser();
    const cookies = sessionCookies(user.session);

    const { response, body } = await request("/today", { cookies });
    assert.equal(response.status, 200);

    const days = [...body.matchAll(/title="(\d{4}-\d{2}-\d{2}) — \d+ of \d+"/g)].map((m) => m[1]);
    assert.ok(days.length > 60, `expected a long run, saw ${days.length} squares`);

    const examDate = "2026-11-29";
    assert.equal(days[days.length - 1], examDate, "the exam date is the last square");
    assert.ok(
      body.includes(`One square a day to Sunday, 29 November`),
      "and the copy agrees with the grid",
    );

    // Inclusive from the first day of the run: no gaps and no duplicates.
    const unique = new Set(days);
    assert.equal(unique.size, days.length, "no square is drawn twice");
    const sorted = [...unique].sort();
    assert.deepEqual(days, sorted, "the squares run in order");
  });

  it("counts today's minutes from the same drills the target is built from", async () => {
    const user = await newUser();
    const cookies = sessionCookies(user.session);
    const { body } = await request("/today", { cookies });

    // A brand-new account is seeded with the four default drills, whose
    // targets sum to 145 minutes — the denominator on the header figure.
    assert.ok(body.includes("Minutes today"), "the figure is on the page");
    assert.ok(body.includes("/145"), "against the target its own drills add up to");
    assert.ok(body.includes("All 4"), "and all four are on the board");
  });

  it("gives every square the hook its motion hangs off", async () => {
    // A square's shade is driven by --fill rather than a baked background,
    // which is what lets a day that changes animate instead of jumping. If the
    // class or the property stops rendering, that transition silently becomes
    // decoration that does nothing.
    const user = await newUser();
    const cookies = sessionCookies(user.session);
    const { body } = await request("/today", { cookies });

    const squares = [...body.matchAll(/class="run-square[^"]*"[^>]*style="([^"]*)"/g)];
    assert.equal(squares.length, 80, "every day of the default run is a square");
    for (const [, style] of squares) {
      assert.ok(style.includes("--fill:"), `a square is missing --fill: ${style}`);
    }
  });
});

describe("auth routes", () => {
  it("reports a missing code instead of failing", async () => {
    const { response, location } = await request("/auth/callback");
    assert.equal(response.status, 307);
    assert.ok(location?.includes("error=missing_code"), location);
  });

  it("reports a bad code instead of failing", async () => {
    const { response, location } = await request("/auth/callback?code=not-a-real-code");
    assert.equal(response.status, 307);
    assert.ok(location?.includes("error=link_expired"), location);
  });

  it("refuses to bounce a browser off-site", async () => {
    // `next=//evil.com` is a protocol-relative URL: `${origin}${next}` would
    // have landed the visitor on another host with a real magic link as bait.
    for (const hostile of ["//evil.com/x", "https://evil.com", "/\\evil.com", "//evil.com"]) {
      const { response, location } = await request(
        `/auth/callback?code=x&next=${encodeURIComponent(hostile)}`,
      );
      assert.equal(response.status, 307);
      // Next echoes the origin it was asked for, which may be spelled
      // "localhost" or "127.0.0.1" — what matters is that it is this machine
      // and this port, never an outside host.
      const target = new URL(location, APP_URL);
      assert.ok(
        ["localhost", "127.0.0.1"].includes(target.hostname),
        `${hostile} resolved to another host: ${location}`,
      );
      assert.equal(target.port, new URL(APP_URL).port, `${hostile} left the app's port`);
      // And it must land on a real route, not on a URL that merely looks local.
      assert.equal(new URL(location, APP_URL).pathname, "/login");
    }
  });

  it("still honours an on-site next", async () => {
    const { location } = await request("/auth/callback?code=x&next=%2Fmocks");
    assert.equal(new URL(location, APP_URL).pathname, "/login", "a bad code goes to sign-in");
  });

  it("signs out only on POST, and returns to the landing page", async () => {
    const get = await request("/auth/signout");
    assert.equal(get.response.status, 405, "a GET must not sign anyone out");

    const post = await fetch(`${APP_URL}/auth/signout`, { method: "POST", redirect: "manual" });
    assert.equal(post.status, 303);
    assert.equal(new URL(post.headers.get("location"), APP_URL).pathname, "/");
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
