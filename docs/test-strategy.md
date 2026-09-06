# Test strategy — Product Hunt

Shubham Raj. Written as if I'm the only QA on this product and it shipped last week.

## What actually matters here

Product Hunt is a read-heavy discovery site. People come to see what launched today, ranked by votes,
and sometimes click through to a product. Everything that writes is behind social login. The things
that would genuinely hurt the business, in the order I'd worry about them:

1. **The ranking being wrong.** Wrong order, duplicates, missing launches. Nobody files a bug for
   this, they just quietly stop trusting the list.
2. **The path from anonymous visitor to signed-in user.** Browse, open a product, try to upvote, get
   asked to sign in. If any step breaks, that's growth we don't get back.
3. **Auth and abuse.** The API and the site have to fail closed without credentials. Vote and follow
   manipulation is the obvious abuse vector.
4. **Hygiene.** Consent, security headers, third-party scripts. Regulatory and reputational.

UI polish matters too, but it's not where I'd spend my first week.

## Where I put the effort

**Mostly API and contract tests.** The GraphQL schema is the actual product surface. Ordering,
pagination, auth and error contracts are cheaper and far less flaky to check there than in a browser.

**E2E only for the anonymous journey.** Feed → product → back, search, expanding today's list, the
sign-in modal, the logged-out vote, 404s, mobile. Eight scenarios, not a regression pass over every page.

**Exploratory testing finds things, automation keeps them found.** Every automated check maps back
to a risk above or to a finding in `findings.md`.

## Priorities

| Area | Risk | Covered by |
|---|---|---|
| Auth boundaries and transport (no token, forged token, writes) | High | API: `auth-boundaries` |
| Feed ranking, duplicates, expansion | High | E2E: `homepage-feed`, `today-expansion`. API: `ordering`, `pagination` |
| Anonymous vote → sign-in prompt | High | E2E: `logged-out-vote` (known bug, F1) |
| Search, mobile, 404s | Medium | E2E: `search`, `mobile-feed`, `not-found` |
| API validation, rate limiting, introspection | Medium | API: `error-handling`, `post-detail`, `rate-limit`, `introspection-security` |
| Marketing pages, forums, newsletters | Low | Not automated |

Non-functional things I track rather than test exhaustively: real cost per API request, introspection
vs the documented mutation list, CSP and HSTS, whether tracking waits for consent. See `findings.md`.

## Rules I held the suites to

- **Headless, parallel, idempotent, no fixed sleeps.** Web-first assertions and `expect.poll` only.
- **One full page load per E2E test.** Product Hunt is behind Cloudflare Bot Management and a headless
  context gets challenged after two or three navigations. A fresh context's first load was reliable
  every time, so each test loads once via a `gotoOnce` fixture and then moves client-side. The fixture
  fails with a clear "Cloudflare challenge" message so an infra block is never misread as a product bug.
- **Known bugs stay visible.** A confirmed bug becomes `test.fail()` with the finding number, not
  `test.skip()`. CI is green while the bug exists and goes red the day it's fixed.
- **Read-only against production.** The one mutation in the suite is sent without a token to prove
  it's refused. Tests share no state. Token-gated API tests skip rather than fail when no token is set.

## Deliberately not doing

- **Automating real OAuth login.** Login is social only. Driving a third-party consent screen is brittle
  and against most providers' terms. I test the sign-in surface instead.
- **Load or performance testing** against someone else's production.
- **Visual regression.** Too much upkeep for a first pass.
