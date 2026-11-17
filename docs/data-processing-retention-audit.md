# Loyce Dairies — data flows, retention and Google Play disclosure review

**Working document — not a compliance certification.**  
Reviewed: **17 November 2026**. Scope: observed source-code flows on `feature/staff-order-notifications`, publicly documented vendor handling, and the production configuration explicitly verified in the release review. No production or customer data was accessed during this code audit.

This inventory complements [account-deletion-operations.md](./account-deletion-operations.md). It deliberately distinguishes **verified application behavior**, **vendor-published general policy**, and **unknown account-specific configuration**.

## Data-flow inventory

| Data / purpose | Source and destination | Evidence in repository | Deletion or retention handling | Status |
|---|---|---|---|---|
| Customer account: name, email, optional phone, password hash | Customer registration/authentication → Neon PostgreSQL | `server/src/routes/auth.ts`; `server/prisma/schema.prisma` | Original Customer is removed on approved deletion; associated sessions and action tokens cascade. Confirm restore reconciliation and third-party traces. | Local tests passed |
| Orders: recipient, contact phone, address, instructions, products, quantities, prices, payment status | Checkout → Neon; authorized staff reads | `server/src/routes/orders.ts`; `server/prisma/schema.prisma` | Completed/cancelled eligible orders remain as **de-identified accounting records**: contact fields redacted, original Customer detached. Product and transaction snapshots remain. Assess potential re-identification through order number and external records. Unresolved orders block erasure. | Local tests passed; retention rationale pending |
| Session credentials | Browser HTTP-only cookie or native device protected storage → API; session hashes in Neon | `server/src/lib/session.ts`; `client/src/services/mobileSessionStorage.ts` | Customer delete cascades Neon sessions; device-local tokens are invalid after server deletion, but device cleanup and offline storage require separate product review. | Code reviewed |
| Email verification and password reset | Customer email address and a link with a time-limited action token → Resend Emails API | `server/src/lib/mail.ts`; `server/src/routes/emailVerification.ts`; `server/src/routes/passwordRecovery.ts` | Deleting Neon tokens does **not** retract previously sent emails or provider logs. Resend says email and logs are held for 30 days on Free/Pro/Scale (Enterprise flexible); no per-message deletion API, but early deletion can be requested from Resend using email IDs. Confirm actual account plan and procedure. | Provider policy verified; account settings unknown |
| Staff push notification tokens | Staff Android app obtains FCM token → authorized backend → Neon `StaffPushDevice` | `client/src/services/staffPushRegistration.ts`; `server/src/routes/staffPushDevices.ts` | Revocation currently deactivates a token in Neon. Confirm device/uninstall lifecycle, Firebase installation-ID deletion, and retention separately; this is **staff-device data**, not necessarily data of the customer who placed an order. | Code reviewed; lifecycle pending |
| New-order notification payload | Backend → Firebase Cloud Messaging → staff Android device | `server/src/services/staffOrderPush.ts`; push worker | Message includes an order number, order ID and navigation route; no recipient name, phone or delivery address in the application-defined FCM payload. Order identifiers can still link to private order records held elsewhere. | Code reviewed |
| Runtime API traffic and operational logs | Customer/staff app → Railway-hosted Express service | `server/src/app.ts`, application logging | HTTP requests and diagnostics may generate metadata or error logs; inspect actual log fields and external exports. Railway docs list plan-dependent log retention: Free 3 days, Trial/Hobby 7 days, Pro 30 days, Enterprise up to 90 days. **Actual Loyce plan not verified.** | Vendor policy reviewed; account configuration unknown |
| Database and restore history | API → Neon PostgreSQL; database history supports recovery | `server/src/lib/prisma.ts`; Prisma schema; Neon console | Production Neon branch showed **6-hour point-in-time restore history**, no snapshots and no scheduled snapshots visible on 17 Nov 2026. A restore can resurrect erased customer rows and roll back `AccountErasureAudit`. External register and restore reconciliation are mandatory. This does not describe all vendor-internal backups. | Production screenshot verified |
| In-app storage and cart/preferences | Browser or mobile local storage | Privacy policy and client code (full storage sweep pending) | Do not assume server-side deletion clears locally cached data. Confirm what remains after mobile logout, account erasure and uninstall. | Requires device review |

## Provider facts requiring operational handling

### Neon

- Actual production branch shown in Neon: a **6-hour history window**, no snapshots and no schedule displayed at inspection. The matching Railway hostname and two Prisma migration rows were verified separately.
- Neon's history window describes recoverable database timeline changes, **not** necessarily all data retained by Neon as a service provider. Free plans have a 6-hour maximum; paid plans may allow longer history.
- On restoration, `AccountErasureAudit` may be rolled back alongside the deletion itself. Keep independent, restricted fulfilment evidence outside this restore boundary.

Reference: https://github.com/neondatabase/website/blob/main/content/docs/postgres/backup-restore/history-window.md

### Resend

- The application sends verification and password-reset emails (address, subject, body and one-time links) through the Resend API.
- Resend states that Free/Pro/Scale accounts have **30-day** email/log retention; Enterprise may have custom retention. Resend states it has **no API endpoint** for deletion of an individual sent email; early removal requests can be made through its account support with email IDs.
- Resend states its stored email data is held in the **United States**, even when a sending region differs. Verify the Loyce Dairies plan before adopting any plan-specific statement in the public policy.
- A Neon-only account erasure does not remove already-sent messages from a recipient inbox.

Reference: https://resend.com/security/gdpr

### Firebase Cloud Messaging

- Staff Android push registration uses Firebase installation/token infrastructure, and the push payload includes the order number and internal identifiers, not a customer's address/telephone.
- Firebase states Cloud Messaging uses **Firebase installation IDs**. Deletion of the installation ID must be initiated through the relevant Firebase API; Firebase states removal from live and backup systems occurs within **180 days after that call**. Revoking only a database token does not demonstrate Firebase installation deletion.
- Confirm Android SDK initialization and the installed app's actual network behavior before completing Google Play Data safety fields. A notification permission flow alone is not proof that FCM does not initialize for non-staff users.

Reference: https://firebase.google.com/support/privacy

### Railway

- Railway hosts the Express API and compiled React website; the actual data-bearing PostgreSQL database is hosted on Neon, not presumed to be a Railway-managed Postgres volume.
- Railway documents plan-dependent log retention (Free 3 days; Trial/Hobby 7; Pro 30; Enterprise up to 90) and deployment-image retention that is separate from logs.
- Verify the actual Loyce plan, request/access logs, outbound log drains, deployment image handling and any custom diagnostics before writing fixed public retention claims.

References: https://docs.railway.com/observability/logs and https://docs.railway.com/enterprise/security

## Draft Google Play disclosure checklist — do not submit without verification

Google Play requires an in-app and web-based path for users to request deletion of app accounts and associated data, and disclosure of legitimate retention exceptions. Its Data safety classification depends on **what the production app and all SDKs actually collect**, not just what the API database schema includes.

- [x] Public privacy policy route is available and relevant content was observed in the served frontend bundle.
- [x] Public `/account-deletion` page is available, including a browser sign-in pathway and a password-confirmed request mechanism.
- [x] Request API enforces authentication; manual fulfilment code and local tests exist.
- [ ] Exercise the **end-to-end web request** in a controlled disposable environment and verify customer-facing completion handling. Do not use a real customer account.
- [ ] Assign a deletion operator and independent reviewer; set a response workflow and operational service level.
- [ ] Confirm Resend plan and decide the email-ID lookup/support procedure for exceptional early deletion.
- [ ] Confirm Railway plan and inspect real logging and log-export configuration.
- [ ] Review Firebase SDK and installation-ID deletion behavior for staff device lifecycle.
- [ ] Test native storage cleanup and inspect installed Android SDKs and permissions for Data safety categories.
- [ ] Decide order/accounting retention basis with the responsible business/legal reviewer; distinguish **de-identified** from irreversibly anonymous data.
- [ ] Establish the independent deletion register and a production restore reconciliation procedure.
- [ ] Review whether privacy policy should explicitly name **Neon** and describe restoration-history limits; avoid promising automatic or immediate erasure.
- [ ] Complete Google Play Data safety answers based on observed runtime behavior and vendor-specific processing; do not assume all processor transfers are classified as Google Play “sharing” without reviewing its definitions.

Reference: https://support.google.com/googleplay/android-developer/answer/13327111

## Release guardrail

This document authorizes **no production deletion, database restore, configuration change, or Play Console declaration**. The manual processor remains disabled by default. Do not publish personal identifiers, API keys, full database connection strings, or deletion register exports in GitHub.
