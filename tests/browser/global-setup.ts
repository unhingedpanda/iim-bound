import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Clerk's testing token, minted once per run.
 *
 * The Frontend API is guarded by bot protection, so a headless browser signing
 * in from a fresh profile is treated as suspicious and routed to a
 * device-verification step that needs a real inbox. The testing token tells
 * Clerk this traffic is a test, which is the supported way through — the
 * alternative would be turning off bot protection and device trust in the
 * instance, weakening the settings real users depend on.
 *
 * `clerkSetup` also publishes CLERK_FAPI and CLERK_TESTING_TOKEN into
 * process.env, which is what setupClerkTestingToken needs later.
 */
export default async function globalSetup() {
  await clerkSetup();
}
