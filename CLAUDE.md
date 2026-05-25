# CardPortal — Project Guide

## Overview

CardPortal is a **Next.js 14 App Router** demo app (JavaScript, no TypeScript) for Adyen's **Balance Platform / Card Issuing** product. It's a stateless app deployed on **Vercel free tier** — no database, no server sessions. All state is derived live from Adyen API calls. The user's email is the lookup key, stored in the `reference` field of the Adyen AccountHolder.

Styled with **Tailwind CSS** using an Adyen brand palette (green/navy/black). All Adyen API calls go through Next.js API routes (`/app/api/...`) so secret API keys never reach the client.

---

## Tech Stack

- Next.js 14 (App Router) + React 18, JavaScript only
- Tailwind CSS
- `@adyen/adyen-platform-experience-web` — embedded Transactions / Payouts / Capital components
- `@adyen/adyen-web` v6 — Drop-in checkout
- `lucide-react` — icons
- `@vercel/analytics`

---

## Environment Variables (`.env.local`)

Eleven variables total:

```properties
PORT
NEXT_PUBLIC_APP_URL

ADYEN_PLATFORM_API_KEY
ADYEN_PAYMENTS_API_KEY
NEXT_PUBLIC_ADYEN_CLIENT_KEY
ADYEN_MERCHANT_ACCOUNT
ADYEN_BALANCE_PLATFORM

ADYEN_BRAND_VARIANT_VISA
ADYEN_BRAND_VARIANT_MASTERCARD

REPORTS_ACCOUNTHOLDER_ID
REPORTS_BALANCE_ACCOUNT_ID
```

- `ADYEN_PLATFORM_API_KEY` — used for BCL (`/bcl/v2`), LEM (`/lem/v3`, `/lem/v4`), Transfers (`/btl/v4`), and Session Authentication (`authe/api/v1`)
- `ADYEN_PAYMENTS_API_KEY` — used for Checkout (`/v71`) — Drop-in sessions, payments, top-up
- `NEXT_PUBLIC_ADYEN_CLIENT_KEY` — Web SDK client key for Drop-in
- `ADYEN_BRAND_VARIANT_VISA` / `_MASTERCARD` — brand variant strings used when issuing new cards (configurable so the same code works against different Adyen test profiles)
- `REPORTS_ACCOUNTHOLDER_ID` / `REPORTS_BALANCE_ACCOUNT_ID` — hardcoded platform-level AH/BA used by the Reports tab (independent of the logged-in user)

---

## API Domain Helpers (`/lib/adyen.js`)

One helper per Adyen API domain, all wrapping a shared `request()` with `X-API-Key`, JSON parsing, and a unified error extractor:

| Helper | Base URL | Key |
|---|---|---|
| `adyenPlatformRequest` | `balanceplatform-api-test.adyen.com/bcl/v2` | Platform |
| `adyenLemRequest` | `kyc-test.adyen.com/lem/v3` | Platform |
| `adyenLemV4Request` | `kyc-test.adyen.com/lem/v4` | Platform |
| `adyenTransfersRequest` | `balanceplatform-api-test.adyen.com/btl/v4` | Platform |
| `adyenSessionRequest` | `test.adyen.com/authe/api/v1` | Platform |
| `adyenCheckoutRequest` | `checkout-test.adyen.com/v71` | Payments |

Errors throw an `Error` with `status` and `response` attached.

---

## Auth & Session

- **Login**: email → `/api/login` → `GET /bcl/v2/accountHolders?reference={email}`. Includes brute-force protection (rate limit per IP, lockout after failed attempts, honeypot field, minimum form-fill time).
- **Register**: orchestrated via `loginOrProvisionSessionByReference` in `/lib/accountHolderSession.js` — creates Legal Entity → Account Holder → Balance Account.
- **Session state**: `AuthContext` stores `{ accountHolderId, balanceAccountId, legalEntityId, email, companyName }` in React context + localStorage. On reload, it rehydrates by re-fetching the AH to confirm it still exists.

---

## Navigation (`/lib/constants.js`)

The active sidebar nav items are:

```
Account · Onboarding · Cards · Checkout · Sweeps · Reports · API History
```

Notes on routing aliases (kept for friendlier URLs):
- `/account` re-exports from `/home/page.js`
- `/sweeps` re-exports from `/payouts/page.js`
- `/apihistory` re-exports from `/api-history/page.js`

There is no separate "Capital" tab in the current nav.

---

## Pages

### Account (`/account`, code at `/home/page.js`)
Commercial-bank style dashboard for the **logged-in** user:
- Live balance overview card (polls `/api/adyen/account-overview` every 10s)
- Card count summary
- `MainAccountTransfer` widget — initiate transfers from the main BA
- Embedded **Transactions Overview** Adyen component
- Toasts for success/error

### Onboarding (`/onboarding`)
Renders `OnboardingContent`. Covers KYC capabilities + hosted onboarding launch + business-line creation against the user's Legal Entity (uses `/api/adyen/legal-entity`, `/api/adyen/legal-entity/business-lines`, `/api/adyen/hosted-onboarding`).

### Cards (`/cards`)
Renders `CardsContent` with `CardVisual` components — realistic Visa/Mastercard renderings with an eye-icon **PAN reveal** that calls `/api/adyen/cards/reveal`. The reveal route requests encrypted PAN/CVC from Adyen and decrypts it server-side using an RSA public key (via `crypto`). New cards are created via `POST /api/adyen/cards` using `ADYEN_BRAND_VARIANT_VISA` / `_MASTERCARD` for the `brandVariant` field.

### Checkout (`/checkout`)
Storefront simulator using **Adyen Web Drop-in v6**. Generates a random themed order (tourist cities × upscale hotels × adventure items) at a random amount, calls `/api/adyen/checkout/sessions` to create a session, then mounts Drop-in. Result handlers cover `Authorised` / `Refused` / `Error`. Also supports a top-up flow (`/api/adyen/checkout/topup`) and manual `/payments` + `/payments/details` routes for fallback flows. Uses `additionalData.customRoutingFlag: "adyenIssuedTestCard"` to route through the issuing network. `CardWalletViewer` lets the user inspect issued cards alongside checkout.

### Sweeps (`/sweeps`, code at `/payouts/page.js`)
Embedded **Payouts Overview** Adyen component + sweep configuration UI hitting `/api/adyen/sweeps` (GET list + POST create). Supports push/pull sweeps with daily/weekly/monthly/cron/balance schedules tied to a transfer instrument.

### Reports (`/reports`)
Uses the **Reports Account Holder** from env (not the logged-in user). Fetches `/api/adyen/reports/account-holder` and `/api/adyen/reports/balance-accounts`, then mounts a Transactions Overview component scoped to that AH. Surfaces diagnostic hints from API errors.

### API History (`/apihistory`, code at `/api-history/page.js`)
Renders `ApiHistoryContent`. Clean table of every client-side API call, fed by `ApiHistoryContext`'s `trackedFetch` wrapper. Columns: colored Method badge, endpoint, smart "detail" summary, status, timestamp. Click a row to see full request/response JSON. Filters by method and success/fail.

---

## Key API Routes

```
/api/login                                — email lookup + brute-force protection
/api/adyen/sessions                       — Session Authentication for Platform Experience components
/api/adyen/hosted-onboarding              — hosted KYC session
/api/adyen/account-overview               — balance + summary for a BA
/api/adyen/legal-entity                   — LE CRUD
/api/adyen/legal-entity/business-lines    — business line CRUD
/api/adyen/cards                          — list/create payment instruments
/api/adyen/cards/reveal                   — RSA-decrypted PAN/CVC reveal
/api/adyen/checkout/client-key            — expose client key
/api/adyen/checkout/sessions              — Drop-in session
/api/adyen/checkout/payments              — manual payment fallback
/api/adyen/checkout/payments/details      — 3DS / additional details
/api/adyen/checkout/payment-methods       — payment methods list
/api/adyen/checkout/topup                 — BA top-up via checkout
/api/adyen/sweeps                         — list/create sweeps
/api/adyen/transfers                      — initiate transfers
/api/adyen/reports/account-holder         — Reports AH (from env)
/api/adyen/reports/balance-accounts       — Reports AH balance accounts
```

---

## File Structure

```
card-portal/
├── app/
│   ├── layout.js, page.js (login), globals.css
│   ├── (dashboard)/
│   │   ├── layout.js, DashboardShell.js
│   │   ├── account/        (→ home/)
│   │   ├── home/           Account dashboard
│   │   ├── onboarding/
│   │   ├── cards/
│   │   ├── checkout/
│   │   ├── sweeps/         (→ payouts/)
│   │   ├── payouts/        Payouts component + sweep config
│   │   ├── reports/
│   │   ├── apihistory/     (→ api-history/)
│   │   └── api-history/
│   └── api/
│       ├── login/
│       └── adyen/
│           ├── sessions, hosted-onboarding, account-overview, transfers, sweeps
│           ├── legal-entity/ (+ business-lines/)
│           ├── cards/ (+ reveal/)
│           ├── checkout/ (sessions, payments[/details], payment-methods, client-key, topup)
│           └── reports/ (account-holder, balance-accounts)
├── components/
│   ├── Sidebar, DashboardShell, AppProviders, PageHeader
│   ├── LoginForm
│   ├── BalanceAccountCard, MainAccountTransfer
│   ├── CardsContent, CardVisual, CardWalletViewer, CardNetworkLogos
│   ├── OnboardingContent
│   ├── ApiHistoryContent, MethodBadge, StatusBadge
│   ├── AdyenComponentMount               — Platform Experience wrapper (loading/error/cleanup)
│   ├── Toast, ConfirmDialog, CopyButton
│   ├── LoadingSkeleton, EmptyState, SmokeBackground
├── context/
│   ├── AuthContext.js                    — user session + localStorage rehydration
│   └── ApiHistoryContext.js              — trackedFetch + log store + extractDetail
├── lib/
│   ├── adyen.js                          — 6 domain helpers
│   ├── accountHolderSession.js           — login / provision orchestration
│   ├── apiError.js                       — getApiErrorMessage
│   ├── constants.js                      — NAV_ITEMS, TIMEZONES
│   └── utils.js                          — formatCurrency, formatDate, generateOrderReference, extractDetail
```

---

## Conventions

- **No TypeScript** — `.js` everywhere.
- **No persistent server state** — derive from Adyen on every request. The only in-memory state on the server is the login route's rate-limit / lockout maps, which are intentionally ephemeral.
- **API proxy pattern** — never call Adyen from the browser; always proxy through `/app/api/...` so the API key stays server-side. The one exception is Drop-in / Platform Experience components, which use scoped session tokens generated by `/api/adyen/sessions`.
- **All client-side fetches use `trackedFetch`** from `ApiHistoryContext` so they show up in the API History tab.
- **Tailwind brand palette**: `adyen.green`, `adyen.darkGreen`, `adyen.black`, `adyen.navy`, `adyen.gray.*`.
- **Currency**: Adyen returns minor units (÷100). Format via `formatCurrency` in `lib/utils.js`.
- **Session tokens** for embedded components are minted per-mount via `/api/adyen/sessions` with `accountHolderId` (or `legalEntityId` for onboarding) and role list. `allowOrigin` is `NEXT_PUBLIC_APP_URL`.
