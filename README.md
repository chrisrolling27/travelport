# Travelport

**[travelport.dev](https://travelport.dev)**

A demo environment for exploring Adyen's Balance Platform and Card Issuing APIs end-to-end. Sign up, complete hosted onboarding, issue virtual cards, spend them through a checkout flow, configure sweeps, and watch every underlying API call in real time.

## What you can do

- **Hosted Onboarding** — run through Adyen's KYC/KYB flow for a legal entity
- **Issue Cards** — create virtual Visa and Mastercard payment instruments
- **Spend Cards** — pay with your issued cards via an Adyen Drop-in checkout
- **Sweeps & Payouts** — configure push/pull sweeps and view payout activity
- **Capital & Reports** — explore embedded Adyen Platform Experience components
- **API History** — every Adyen request and response, logged with status, detail, and full payloads

## Run locally

```bash
npm install
npm run dev
```

For HTTPS (recommended when testing Drop-in / card autofill):

```bash
npm run dev:https
```

Copy `.env.example` to `.env.local` and fill in your Adyen test credentials.

## References

- Live app: **[travelport.dev](https://travelport.dev)**
- [Adyen API Explorer](https://docs.adyen.com/api-explorer/)
