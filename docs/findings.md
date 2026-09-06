# Exploratory testing & security notes — Product Hunt

I spent an afternoon on this. Most of it was scripted poking with Playwright and curl; the last hour
or so was me in a real browser window clicking through forms, forums, profiles and comment areas by
hand. Everything below I managed to reproduce at least twice on 6 Sep 2026. Screenshots are in
`docs/evidence/`.

## What I did and didn't do

This is someone else's production system, so I stayed passive. No real writes, no token guessing
beyond one deliberately forged token, no load testing (the biggest burst I sent was 6 requests), no
trying to get past the Cloudflare challenge when it showed up. If a check would have needed me to
log in and vote or comment for real, I didn't do it.

Severity: **S1** critical, **S2** high (a core journey is broken for some users), **S3** medium
(wrong but there's a workaround), **S4** low (cosmetic / docs).

---

## Bugs and oddities

### F1 — Upvoting while logged out does nothing at all (S2)

Open the homepage signed out and click the upvote arrow on any launch. I expected the sign-in modal,
the same one the header button opens. Instead: nothing. No modal, no redirect, no network request, the
count doesn't move. I checked it wasn't a hydration timing issue by clicking the header "Sign in" in
the same session, which works fine.

What makes this clearly a bug rather than a policy: every other logged-out action I tried does the
right thing. Follow on a profile, "Leave a review" on a product, "Login to comment", upvoting a comment,
upvoting a forum thread: all of them open the sign-in modal. The launch-card upvote on the feed is the
one that doesn't, and it's the most visible action on the site. I'd fix this first.

Evidence: `docs/evidence/logged-out-vote-no-prompt.png` (the bug), `follow-logged-out.png`,
`forum-upvote.png`, `login-to-comment.png` (the correct behaviour everywhere else). Automated in
`e2e/tests/logged-out-vote.spec.ts` as an expected failure so CI goes red the day it gets fixed.

### F2 — The same product shows up twice in today's list (S3)

Click "See all of today's products" and dedupe the rows by slug. `/products/parkicious` was in there
twice: once at rank 60 with 2 votes and again at rank 534 with 0 votes, in a list of 534 launches.
My guess is the product has two launch records for the same day, but it could just as easily be the feed
query not deduping. Either way it shouldn't reach the page.

The expansion test reports duplicates in its annotations each run rather than failing on them, since
it's a data problem and not a ranking-logic problem.

### F3 — Garbage leaderboard dates just get normalised (S3)

`/leaderboard/daily/2026/13/45` returns 200 with the heading "Best of Product Hunt — February 14, 2027".
Month 13, day 45 rolled forward instead of 404ing. `/leaderboard/daily/2030/1/1` is also a 200 with an
empty list. Confusing if you land on it, and it hands crawlers an infinite URL space.

### F4 — Search pagination accepts anything and has no empty state (S3)

`/search?q=notion&page=-1` and `&page=abc` both return 200 showing page 1. `&page=99999` returns 200
with a completely empty main area. No "no more results", nothing.

### F5 — The 404 page uses the homepage title (S4)

Unknown product URLs correctly return HTTP 404 with a friendly page and a link home, which is good. But
the `<title>` is still "Product Hunt – The best new products in tech." so tabs, history and analytics
can't tell a 404 from the homepage.

Evidence: `docs/evidence/404-page.png`. Status and heading covered in `e2e/tests/not-found.spec.ts`.

### F6 — Three sign-in buttons have no accessible name (S3)

In the sign-in modal, LinkedIn, GitHub and X are labelled buttons. Google, Facebook and Apple are icon
only with no text, no `aria-label`, no `title`. A screen reader just says "button". That's a WCAG 4.1.2 failure, and it's on the
login path of all places.

Evidence: `docs/evidence/sign-in-modal.png`.

### F7 — One in five rows of the expanded feed is an ad (S4)

After expanding today's list there were 133 sponsored `<article>` cards mixed into 535 launches. They
show a vote count and look almost identical to organic rows apart from a small "Promoted" badge. I wouldn't call it a bug, but
it's worth knowing about, and any automation has to filter them out or ranking checks are meaningless.

Evidence: `docs/evidence/today-expanded.png`.

### F8 — API rate limiting is flat per request, not complexity based (S3)

The docs say the 6250-point / 15-minute quota is "calculated based on the fields requested". I sent
`{ __typename }`, `posts(first:1){id}` and a `posts(first:20)` with nested topics and makers, and
diffed `X-Rate-Limit-Remaining` each time. Every one cost exactly 100 points.

So the real limit is 62 requests per 15 minutes. Batching fields to "save complexity" gains nothing,
and I burned through the whole quota twice while building this suite before I noticed. The rate-limit
test now logs the per-query cost so this is visible on every run.

### F9 — Documented mutation `userSelect` doesn't exist (S4)

The API reference lists three mutations: `userFollow`, `userFollowUndo`, `userSelect`. Introspection
with a valid token shows only the first two. The docs have drifted.

### Things I checked that were fine

Homepage feed and rank numbering; product page navigation and history back; search palette and the
full results page (`search-results.png`); sign-in modal open and close; real HTTP 404s for unknown products, topics and user
profiles; mobile layout (no horizontal overflow, CTA reachable, `mobile-feed.png`); the empty-search message; emoji and
3000-character queries; ranks in the expanded list never go backwards; newsletter form rejects empty
and malformed emails with inline messages (`newsletter-invalid.png`); follow, review, comment and
comment/forum upvotes all prompt sign-in when logged out.

---

## Security observations

**S1 — Introspection.** Enabled for any authenticated client, and a free developer app is enough.
Refused with 401 without a token. Exposed mutations are `userFollow` and `userFollowUndo` only. For a
public, documented API I think that's an acceptable trade-off. `introspection-security.test.ts` will
fail if a mutation shows up that isn't in the docs.

**S2 — Rate limiting.** Headers `X-Rate-Limit-Limit: 6250`, `Remaining` and `Reset` (≤ 900 s) are on
every authenticated response, and a 6-request burst is served normally. One thing I noticed: 401
responses carry no rate-limit headers at all, so an unauthenticated caller gets no signal that
token guessing is being throttled. Worth confirming server side that failed auth is limited per IP.

**S3 — Session storage.** `_producthunt_session_production` is `HttpOnly; Secure; SameSite=Lax`, which
is right. `csrf_token` is a readable cookie, which is expected for the double-submit pattern.
`localStorage.user-session` is just an anonymous `{uuid, expiresAt}`. I did not verify this for a
logged-in session, since logging in is OAuth only and I kept that out of scope.

**S4 — Error shape.** A 401 comes back as
`{"data":null,"errors":[{"error":"invalid_oauth_token","error_description":"..."}]}`. That's an
OAuth-style envelope, not a GraphQL error: there's no `message` key, so a generic GraphQL client will
render "undefined". Nothing leaks though: no stack traces, paths or framework names, and there's an
`x-request-id` for support. I'd add a spec-shaped error with `extensions.code = UNAUTHENTICATED`
alongside the existing keys.

**S5 — Writes without a token.** `userFollow` with no token → 401 and `data: null`. A forged bearer
token gets exactly the same status and error code as no token, so there's nothing to learn from probing. Good.

**S6 — Login surface.** Social only: LinkedIn, GitHub, X, Google, Facebook, Apple. No email/password.
That removes credential stuffing and weak passwords from the picture but makes the product fully
dependent on those IdPs. The account recovery story is worth a look.

**S7 — Bot management and WAF.** Cloudflare challenges headless Chromium after two or three full page
loads in one browser context (403, `__cf_chl` in the URL). The WAF returns 403 for
`<img src=x onerror=…>` in the search query, and harmless payloads are echoed as text, not HTML. These are strong
controls. The cost is that any synthetic monitoring has to use a fresh context per navigation, which is
how the E2E suite is built.

**S8 — Web security headers.** `X-Frame-Options: SAMEORIGIN` and `X-Content-Type-Options: nosniff` are
present. There is no `Content-Security-Policy` at all. HSTS is `max-age=2592000` (30 days) with
`includeSubDomains; preload`, but the preload list requires a year, so the `preload` directive isn't
doing anything. I'd start a report-only CSP and raise HSTS to a year.

**S9 — Tracking before consent.** On first load, before touching the cookie banner, the browser already
had `_ga`, `_ga_*`, `_fbp`, Facebook `fr`, Twitter `guest_id*`, LinkedIn `bcookie`/`li_sugr`, and a
Datadog RUM cookie with session replay sampling. Facebook Pixel, GA4, Segment and Datadog POSTs all fired
while the "No thanks / Accept all cookies" banner was still up. For EU/UK visitors that's a GDPR /
ePrivacy problem. The tag manager should be gated on consent state; right now it clearly isn't.

**S10 — API transport.** GET to the GraphQL endpoint is a 404, non-JSON bodies are a 400, baseline
headers are present. Covered in `auth-boundaries.test.ts`.

**S11 — Third-party surface.** A page load talks to around ten third-party origins (GA, Facebook,
Twitter, LinkedIn, Datadog, Segment, imgix, a Facebook CAPI gateway on AWS). Without a CSP, a compromise
of any of them is full XSS.

---

## Which of these are automated

| Finding | Where |
|---|---|
| F1 | `e2e/tests/logged-out-vote.spec.ts` (expected failure, flips when fixed) |
| F2 | `e2e/tests/today-expansion.spec.ts` reports duplicates per run |
| F5, F6 | partly: `not-found.spec.ts`, `sign-in-modal.spec.ts` |
| F8, F9, S1, S2 | `rate-limit.test.ts`, `introspection-security.test.ts` (token needed) |
| S4, S5, S10 | `auth-boundaries.test.ts` (no token needed) |
| F3, F4, F7, S3, S6–S9, S11 | documented only |
