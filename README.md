# Product Hunt QA take-home

Test strategy, exploratory/security notes, and two automated suites (Playwright for the web app,
Bun + TypeScript for the GraphQL API) against Product Hunt.

- Part 1, strategy: [`docs/test-strategy.md`](docs/test-strategy.md)
- Part 2, findings: [`docs/findings.md`](docs/findings.md) with screenshots in [`docs/evidence/`](docs/evidence/)
- Part 3, tests: [`e2e/`](e2e/) (8 scenarios) and [`api/`](api/) (8 suites, 25 tests)

## Setup

You need [Bun](https://bun.sh).

```bash
bun install
bunx playwright install chromium
cp .env.example .env
```

### Getting an API token

Every request to the Product Hunt API needs a bearer token, even for public reads. Create an app at
[producthunt.com/v2/oauth/applications](https://www.producthunt.com/v2/oauth/applications), then either:

- put the app's API key and secret into `.env` as `PH_CLIENT_ID` / `PH_CLIENT_SECRET` and run
  `bun run token`, which does the client-credentials exchange and writes `PH_ACCESS_TOKEN` for you, or
- copy the app's Developer Token straight into `.env` as `PH_ACCESS_TOKEN`.

Without a token, the 7 API tests that don't need one still run and the other 18 are reported as
skipped. The E2E suite doesn't need a token.

One warning: the API charges a flat 100 points per request out of a 6250-point budget per 15 minutes
(see finding F8). That's 62 requests. A full API run uses about 25, so don't run it more than twice in
a quarter hour or you'll get 429s. The client tells you exactly that when it happens.

## Running things

```bash
bun run test:api          # ~3s, needs token for the full set
bun run test:e2e          # headless, 4 workers, ~25s
bun run test:e2e:headed   # watch it
bun run test:e2e:ui       # Playwright UI mode
bun run test:all
bun run typecheck
```

What you should see:

- E2E: `8 passed`. `logged-out-vote.spec.ts` shows a ✘ because it's marked `test.fail()`. It encodes a
  real bug (F1). The day Product Hunt fixes it this test will go red, which is exactly what I want.
- API with a token: `25 pass`. Without: `7 pass, 18 skip`.

CI is in [`.github/workflows/ci.yml`](.github/workflows/ci.yml): typecheck, then API and E2E in parallel,
Playwright report uploaded as an artifact. Add `PH_ACCESS_TOKEN` as a repo secret to get the full API run.

**The E2E job is non-blocking in GitHub Actions, on purpose.** The first CI run showed every test's initial
page load getting a Cloudflare 403. GitHub-hosted runners come from Azure IP ranges that Cloudflare blocks
outright, whereas from a normal connection a fresh browser context's first load always gets through. The
`gotoOnce` fixture reports this as "Cloudflare challenge, infra block" rather than a test failure, which is
the behaviour I wanted. Typecheck and API tests are unaffected and still gate the build. To make E2E gate
too you'd need a self-hosted runner or an allow-listed egress IP, which is the first thing I'd set up with
more time. Locally the suite is green.

## Layout

```
docs/
  test-strategy.md
  findings.md
  evidence/                 screenshots
e2e/
  support/fixtures.ts       gotoOnce fixture, Feed helper, the data-test selectors in one place
  tests/                    one scenario per file
api/
  client/graphqlClient.ts   small typed fetch wrapper, returns status + rate-limit headers + body
  types/schema.ts           the bit of the schema I use, plus both error shapes the API emits
  fixtures.ts               query strings and their types
  tests/
scripts/get-token.ts        client credentials -> PH_ACCESS_TOKEN
playwright.config.ts
```

### E2E scenarios

| Spec | What it checks |
|---|---|
| `homepage-feed` | today's launches render with rank, name, tagline and a numeric vote count |
| `product-detail` | click a launch, land on its product page, go back to a working feed |
| `today-expansion` | "See all" expands to the full list, teaser items are all still there, ranks never decrease, duplicates get reported |
| `search` | header palette suggests as you type, Enter goes to `/search?q=`, results are relevant and distinct |
| `sign-in-modal` | all six providers render, no password field, Escape closes it |
| `logged-out-vote` | upvote while signed out should prompt sign-in. It doesn't. Known bug F1, `test.fail()` |
| `not-found` | unknown product returns a real 404 with a way home |
| `mobile-feed` | Pixel 7: no horizontal scroll, sign-in visible, bottom of the list reachable |

### API tests

| File | Token? | What it checks |
|---|---|---|
| `auth-boundaries` | no | 401 with a structured error for reads and writes without a token or with a forged one; forged and missing look identical; nothing leaks; GET refused, non-JSON is a 400, security headers present |
| `posts-query` | yes | shape and types, `first: 0`, `postedAfter`/`postedBefore` honoured |
| `pagination` | yes | cursor moves forward without gaps or repeats, bad cursor isn't a 500 |
| `ordering` | yes | `VOTES` and `NEWEST` are monotonic, default order is `RANKING` |
| `post-detail` | yes | id and slug lookups agree with the list, unknown id is `null` |
| `error-handling` | yes | wrong type, unknown field, syntax error all produce proper GraphQL errors |
| `introspection-security` | yes | logs whether introspection is on, fails if an undocumented mutation appears |
| `rate-limit` | yes | headers present, per-request cost logged, a small burst is 200 or 429 and nothing else |

## Findings, short version

Full detail in [`docs/findings.md`](docs/findings.md).

- **F1** Upvoting a launch while logged out does nothing. No prompt, no request, no feedback. Every other logged-out action (follow, review, comment, forum upvote) correctly opens the sign-in modal, so this one is clearly a bug. I'd raise it first.
- **F2** The same product appeared twice in today's expanded list with different vote counts.
- **F3 / F4** Nonsense leaderboard dates (`/2026/13/45`) and search pages (`page=-1`, `page=abc`) return 200. `page=99999` is a blank page.
- **F6** Google, Facebook and Apple sign-in buttons have no accessible name.
- **F8** API quota is a flat 100 points per request, not complexity based like the docs say. Real limit is 62 requests per 15 minutes.
- **S9** Analytics, Facebook Pixel, Twitter/LinkedIn cookies and Datadog session replay all fire before the cookie banner is answered.
- **S8** No Content-Security-Policy on the web app. HSTS is 30 days, which makes the `preload` flag pointless.
- **S4** API auth errors use `error`/`error_description` instead of a GraphQL `message`.
- Things that are fine: reads and writes fail closed with identical 401s for missing vs forged tokens, the session cookie is HttpOnly and Secure, GET GraphQL is refused, the WAF eats XSS payloads, and 404s are real 404s.

## How I built it and why

**One page load per E2E test.** This was the first real problem I hit. Product Hunt sits behind Cloudflare Bot
Management, and after two or three full navigations in the same headless context I'd get a challenge
page. A fresh context's first load never got challenged, even with four in parallel. So every test does
a single `goto` through a `gotoOnce` fixture and then only moves by clicking or `goBack()`. The fixture
also fails with an explicit "Cloudflare challenge" message if one does show up, so an infra block can't
be mistaken for a product bug.

**Wait for `load`, not `domcontentloaded`.** The site is a hydrated React app. Clicks that land before
hydration are just dropped. Switching the wait fixed what looked like flakiness, and I didn't have to add a single sleep.

**`data-test` attributes and roles, no CSS classes.** The app ships good hooks (`vote-button`,
`homepage-section-today`, `login-with-*`, `spotlight-result-product-*`). The ad cards are `<article>`
wrappers, so I scope to direct children of the section to keep them out of ranking assertions.

**Known bugs are `test.fail()`, not `test.skip()`.** Skipping hides the signal. An expected failure keeps
CI green now and goes red when the fix ships.

**No GraphQL client library.** It's about 100 lines over `fetch` that give me status, the rate-limit headers
and the body. The API returns two different error shapes and I wanted both typed rather than hidden
behind a library's idea of an error.

**Token-gated tests use `describe.skipIf`.** A fresh clone with no secrets still runs the auth and
transport tests and reports the rest as skipped instead of failing.

**Nothing writes to production.** The only mutation in the suite is sent without credentials to prove it's
refused.

## If I had more time

1. A self-hosted runner (or an allow-listed egress IP) so the E2E job can actually gate the build instead
   of being blocked by Cloudflare on GitHub-hosted runners. Then a nightly run so ranking and pagination
   drift gets caught without anyone pushing.
2. Generate the types from introspection instead of hand-typing the subset, and fail the build on schema changes.
3. Log in once manually, save Playwright `storageState`, and cover the real write path: vote, check the
   count, un-vote; comment form validation; follow/unfollow via the API with cleanup.
4. Add `@axe-core/playwright` on the feed, product page and sign-in modal. F6 would have been free.
5. A consent test: assert no third-party tracker request fires until the banner is accepted (S9).
6. Screenshot comparisons on the feed card and product header with dynamic counts masked.
7. Contract tests against the web app's own `/frontend/graphql` persisted queries, since that's what real
   users hit rather than the public API.
