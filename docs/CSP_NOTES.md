# Content Security Policy & Security Headers — `@vesper/web`

Authored in Chat 014. Source of truth for the web app's HTTP security headers.
All headers are emitted from `apps/web/next.config.ts` via the `async headers()`
block, applied to every route (`source: '/(.*)'`).

This document explains every CSP directive value, the rationale for each allowed
origin, the deliberate exclusion of `'unsafe-eval'`, and the deferred
per-request nonce.

---

## Assembled Content-Security-Policy

```
default-src 'self'; script-src 'self' https://js.stripe.com https://app.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.posthog.com https://*.sentry.io https://api.stripe.com; frame-src 'self' https://js.stripe.com https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com
```

---

## Directive-by-directive rationale

### `default-src 'self'`
Baseline fallback for any fetch directive not otherwise listed. Restricts all
resource loads to the app's own origin unless a more specific directive widens
it.

### `script-src 'self' https://js.stripe.com https://app.posthog.com`
Executable scripts. Allowed origins:
- **`'self'`** — the app's own first-party bundles.
- **`https://js.stripe.com`** — Stripe.js / Stripe Checkout client SDK.
- **`https://app.posthog.com`** — PostHog analytics client snippet.

Deliberately **NO `'unsafe-eval'`** (see below), **NO `'unsafe-inline'`**, and
**NO `'nonce-...'`** (see "Deferred: per-request nonce" below). Omitting
`'unsafe-inline'` is intentional: it is what makes a future nonce meaningful. A
nonce only restricts inline scripts if `'unsafe-inline'` is absent — browsers
ignore a nonce when `'unsafe-inline'` is also present.

### `style-src 'self' 'unsafe-inline'`
`'unsafe-inline'` is **required** here. Next.js injects inline `<style>` tags
and inline `style` attributes for its CSS handling (styled-jsx / CSS-in-JS and
critical-CSS inlining). Without `'unsafe-inline'` on `style-src`, the app's
styling breaks. This is a styling-only concession and does not affect script
execution safety — `script-src` remains strict.

### `img-src 'self' data: blob:`
- **`data:`** — inline data-URI images (small icons, SVGs encoded inline, and
  some library-generated assets).
- **`blob:`** — object-URL images generated client-side (e.g. canvas exports,
  in-memory previews).

### `font-src 'self' data:`
- **`data:`** — fonts inlined as data URIs (common with self-hosted font
  pipelines and icon fonts).

### `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.posthog.com https://*.sentry.io https://api.stripe.com`
XHR / fetch / WebSocket / EventSource targets:
- **`https://*.supabase.co`** — Supabase REST/Auth/Storage (PostgREST, GoTrue).
- **`wss://*.supabase.co`** — Supabase Realtime WebSocket channel.
- **`https://api.anthropic.com`** — Anthropic AI API (routed through
  `@vesper/ai`; direct connect allowed for any client-side streaming surface).
- **`https://api.posthog.com`** — PostHog event ingest endpoint.
- **`https://*.sentry.io`** — Sentry error/event ingest.
- **`https://api.stripe.com`** — Stripe API calls from the client SDK.

### `frame-src 'self' https://js.stripe.com https://checkout.stripe.com`
Embeddable frames:
- **`https://js.stripe.com`** — Stripe.js iframes (card element, 3DS challenge).
- **`https://checkout.stripe.com`** — Stripe Checkout hosted frame/redirect.

### `frame-ancestors 'none'`
No origin may embed this app in a frame. Anti-clickjacking; complements the
`X-Frame-Options: DENY` header for browsers that honor one or the other.

### `base-uri 'self'`
Restricts `<base href>` to the app's origin, preventing injected `<base>` tags
from rewriting the resolution of every relative URL on the page.

### `form-action 'self' https://checkout.stripe.com`
Allowed form submission targets:
- **`'self'`** — first-party form posts.
- **`https://checkout.stripe.com`** — POST-redirect into Stripe Checkout.

---

## Deliberate exclusion of `'unsafe-eval'`

`script-src` omits `'unsafe-eval'` — this is **Decision 13** in
`docs/ARCHITECTURE_DECISIONS.md`, made canonical in Chat 014.

**Why:** `'unsafe-eval'` permits `eval()`, `new Function()`, and string-argument
`setTimeout`/`setInterval`. Allowing it opens an XSS escalation path: any
injected script could call `eval()` with full execution scope, which negates the
CSP's primary value as a second-line defense against script injection.

**Rich-UI library audit (Design-Track Re-Overhaul / ADD-D).** The rich posture
adds the code libraries `lenis`, `gsap`, `vanta`, and `three` to `@vesper/web`. All
four were audited for the JS constructs `'unsafe-eval'` gates — `eval(` and
`new Function(` — in their shipped builds: **zero** matches in three's core
(`build/three.module.js`), vanta's `dist`, gsap, and lenis. This corrects an earlier
belief recorded here that "Three.js compiles GLSL shaders via runtime `eval`":
modern three (r150+, and the r185 installed) passes GLSL **strings** to the WebGL
API, and **shader compilation is GPU-side** (`gl.compileShader` / `gl.linkProgram`),
which is **not** JavaScript-`eval` and **not** gated by `script-src`.

**Consequence: no `script-src` relaxation was made.** The production `script-src`
still carries **no `'unsafe-eval'`** — Decision 13's exclusion stays fully intact,
and `next.config.ts` was **not** modified for the rich-UI libraries. The
`vite-plugin-glsl` precompiled-shader workaround is therefore **not needed** and was
not added.

**If a future WebGL surface needs it.** three's worker-based asset loaders
(DRACOLoader / KTX2Loader / basis) spin Web Workers from `blob:` URLs; if such a
loader is ever adopted, the minimal directive is **`worker-src blob:`** (and/or
`child-src blob:`) — still far narrower than a blanket `'unsafe-eval'`. Vanta's
standard animated backgrounds and GSAP/Lenis need none of this. No such loader ships
today.

---

## Non-CSP security headers

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year, incl. subdomains; opt-in to the preload list. |
| `X-Frame-Options` | `DENY` | Anti-clickjacking (legacy companion to `frame-ancestors 'none'`). |
| `X-Content-Type-Options` | `nosniff` | Disable MIME sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Send full referrer same-origin, origin-only cross-origin, nothing on downgrade. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Deny camera, mic, geolocation by default. |

### HSTS preload submission — deferred
The `preload` token is present, but **submission to
[hstspreload.org](https://hstspreload.org) is a deferred manual cutover task**,
done only after the production domain (`vesper.day`) has been live and serving
HSTS for a few weeks. Not performed in this chat.

### Permissions-Policy geolocation note
`geolocation=()` denies geolocation at the Permissions-Policy layer. The
location-capture flow re-enables it **at runtime via the browser's JS
Geolocation API**, which prompts the user directly. It is **not** re-granted via
this header. Leave `geolocation=()` as-is.

---

## CSP source-of-truth split (middleware vs. next.config)

The full document-response CSP currently lives **only** in
`apps/web/next.config.ts` `headers()`. `apps/web/middleware.ts` is **not**
involved in CSP emission and was not modified in Chat 014.

This is a single-source design: there is exactly one CSP, emitted statically for
all routes. The middleware's only responsibilities remain rate limiting (two
public API paths) and the cookie auth gate (the protected app route group).

---

## Deferred: per-request nonce

**What the build plan specified.** `PHASE_4_BUILD_PLAN.md` Chat 014 lists a live
per-request nonce in `script-src` (`'nonce-{NONCE}'`) plus
`apps/web/lib/csp/nonce.ts` as the generator, intended to authorize inline
scripts (e.g. a Sentry bootstrap) that cannot be externalized.

**Why it was deferred.**
1. **No inline-script consumer exists at this chat.** A full scan of `apps/web/`
   found no `dangerouslySetInnerHTML` and no inline `<script>`. Sentry
   initializes through external config files (`sentry.client.config.ts`,
   `instrumentation.ts`), not an inline bootstrap. There is nothing for a nonce
   to authorize.
2. **A static block cannot emit a live nonce.** `next.config.ts` `headers()`
   returns one fixed string for all requests; it cannot vary per request. A
   literal `'nonce-X'` baked into a static header is inert and — worse — an
   unmatched static nonce token can suppress the `'unsafe-inline'` fallback in
   ways that break legitimate inline scripts introduced later. So no nonce token
   is present in the static CSP.
3. **Middleware does not run on document routes.** The current middleware
   matcher covers only `/api/v1/waitlist`, `/api/v1/referral/track`, and the
   protected app prefixes (`/plan`, `/tasks`, `/week`, `/settings`). It does not
   run on `/`, `/sign-in`, or marketing routes. Threading a live nonce now would
   mean attaching middleware to all public routes to carry a token nothing
   reads.

**Current state.** `apps/web/lib/csp/nonce.ts` exists (Edge-safe Web Crypto
generator) but is **unwired** — nothing imports it yet. The static CSP carries
no nonce token.

**Migration path (when the first inline script lands).**
1. Move the document-response CSP emission from `next.config.ts` into
   `apps/web/middleware.ts`, computed per request.
2. Generate the nonce with `generateNonce()` from `apps/web/lib/csp/nonce.ts`.
3. Add `'nonce-${value}'` to `script-src` in the middleware-emitted CSP.
4. Pass the nonce to the render tree via an `x-nonce` request header so the
   layout/component rendering the inline `<script>` can read it and set
   `nonce={...}`.
5. Expand the middleware matcher to cover document routes.
6. Leave `next.config.ts` `headers()` carrying **only** the non-CSP static
   headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
   Permissions-Policy), so there is still exactly **one** source of truth for the
   document-response CSP — now middleware instead of next.config.
