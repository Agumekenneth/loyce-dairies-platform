# Loyce Dairies — cash, MTN MoMo, Airtel Money and international cards

Status: **implementation on `feature/payment-options`, NOT deployed or approved for real payments.**

## Technical choice

Pesapal API 3.0 hosted checkout is the single gateway for online transactions, with cash-on-pickup and cash-on-delivery retained. It supports Ugandan payment rails and card processing, subject to the exact merchant agreement, KYC, settlement setup, and availability per customer/card. See https://www.pesapal.com/ug and https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest .

The buyer selects a **preferred** option: MTN MoMo, Airtel Money, or debit/credit card. Pesapal's hosted page displays actual available methods. Our selection is not a guarantee that Pesapal enforces the same choice. Customer PINs and card numbers are handled on Pesapal, **never on our React app or Express server**.

Google Play's billing system is not required for physical dairy products/food delivery (https://support.google.com/googleplay/android-developer/answer/9858738).

## Implemented on the feature branch

- Existing transactional checkout still calculates authoritative prices, validates zones, locks customer eligibility, deducts available stock, and records orders and inventory events.
- Cash remains enabled by default.
- Online checkout is explicitly disabled by default and unavailable in the UI without a configured server.
- `GET /api/payments/config` publishes only availability and sandbox/live mode — never merchant secrets.
- `POST /api/orders/checkout` accepts MTN_MOMO, AIRTEL_MONEY or CARD only when gateway settings pass validation; orders initially have `PENDING` payment status.
- `POST /api/payments/orders/:orderId/start` starts hosted payment for the **authenticated owner** of the order. It locks initiation to prevent parallel duplicate provider checkouts and retains the provider redirect URL and tracking ID.
- Pesapal `GET/POST /api/payments/pesapal/ipn` and `GET /api/payments/pesapal/callback` recheck payment status directly against Pesapal. **Neither caller-supplied callback fields nor mere return to the site mark an order paid.** A completed payment must match the recorded reference, UGX currency and exact total.
- `GET /api/payments/orders/:orderId/status` gives the signed-in customer an order-specific server status refresh.
- Staff cannot move unpaid online orders into fulfilment; cancellation remains available. Refunds/reversals require separate operational handling.
- Approved erasure clears stored payment-provider tracking IDs, merchant references and old checkout URLs in de-identified account-ledger records.

## Required preparation before ANY payment enablement

1. **Business and merchant account.** Complete Pesapal's merchant verification and confirm its current Uganda eligibility, acceptable business type (individual vs registered company), fees, settlement bank/mobile wallet, mobile networks, supported card regions, refunds and chargebacks. Loyce Dairies is not yet registered; Pesapal approval must not be assumed.
2. **Developer checks.** Pull `feature/payment-options` to a disposable local/staging environment, run `npx prisma validate`, `npx prisma migrate deploy`, server `npm run typecheck && npm run build`, client `npm run build`. Do not apply migrations on the production Neon database until reviewed.
3. **Register an IPN with Pesapal** for `https://YOUR-HTTPS-API/api/payments/pesapal/ipn` using `GET` or `POST`, then record the returned `ipn_id`. It is a public callback endpoint, not a secret. Pesapal sends hints; the backend queries payment status itself.
4. **Configure STAGING server environment** (not `client/.env` and never GitHub): `LOYCE_PESAPAL_ENABLED=1`, `LOYCE_PESAPAL_MODE=sandbox`, `LOYCE_PESAPAL_LIVE_APPROVED=0`, `LOYCE_PESAPAL_CONSUMER_KEY`, `LOYCE_PESAPAL_CONSUMER_SECRET`, `LOYCE_PESAPAL_IPN_ID`, `LOYCE_PAYMENT_PUBLIC_URL=https://YOUR-HTTPS-API`, and existing `CLIENT_URL`.
5. **Only synthetic/disposable test data.** Verify pickup/delivery cash still function, method selection, order total, Pesapal redirect, successful/failed/pending/reversed status, callback/IPN duplicate delivery, repeated initiation, short network outages, provider error, mobile browser return path, staff cancellation and refunds. The frontend currently opens the hosted URL in an external tab: Android/iOS resume/deep-link UX must be verified before mobile release.
6. **Business process.** Resolve what to do when order placement succeeds but Pesapal initiation is uncertain (`INITIATION_REVIEW_REQUIRED`). Do not create a second order or assume a failed charge. Establish manual reconciliation, settlement export, refunds/chargebacks, timeout/abandoned checkout and inventory release procedures before launch.
7. **Privacy and data handling.** Update public privacy policy, Data Safety form, retention register and account-deletion flow to disclose Pesapal and processing of contact details, order references, amounts, card/mobile payment metadata where applicable. Confirm vendor terms and retention.
8. **Approval gate.** Live only after signed business approval: `LOYCE_PESAPAL_MODE=live`, `LOYCE_PESAPAL_LIVE_APPROVED=1` and `LOYCE_PESAPAL_ENABLED=1` with production credentials. Never enable these on production merely to see buttons.

## Existing constraints / future work

- **This feature is untested.** Connector changes are committed but no local compilation, Prisma migration, external provider call, or release build has been performed here.
- New order alerts may arrive while payment is still pending; staff fulfilment is blocked but alerts currently do not explicitly distinguish cash vs unpaid online orders.
- An initiated online order reserves stock even if the user never completes payment. Add an expiring reservation/cancellation policy with careful inventory and concurrency safeguards.
- A Pesapal status response can use the customer's **actual** payment method, which may differ from the preferred method saved on checkout. An audited payment-attempt ledger will be useful when adding refunds and more gateways.
- The one-shot session initiation deliberately refuses to retry an ambiguous provider call automatically. Implement supervised reconciliation before offering self-service retry.
- A production hardening review should add authenticated/validated reconciliation audit history, dead-letter processing for provider verification failures, and operational payment alarms before taking real money.

## Primary API docs

- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication
- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl
- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest
- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus
