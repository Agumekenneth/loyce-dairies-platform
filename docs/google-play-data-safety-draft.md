# Loyce Dairies — Google Play Data Safety assessment (draft)

**App:** Loyce Dairies · Android package `com.loycedairies.app`  
**As-of date:** 17 November 2026  
**Status:** **DRAFT / DO NOT SUBMIT** until open checks are completed and answers are independently reviewed.

This document maps the existing source code, signed Android bundle inspection and vendor guidance to Play Console's Data Safety questions. It **does not certify** actual runtime network traffic, vendors' contract terms, legal retention periods or Google Play approval.

## Authoritative references

- Google Play Data Safety requirements and definitions: https://support.google.com/googleplay/android-developer/answer/10787469
- Account-deletion web/in-app requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Privacy policy requirements: https://support.google.com/googleplay/android-developer/answer/10144311
- Firebase SDK disclosure guide: https://firebase.google.com/docs/android/play-data-disclosure
- Firebase installations: https://firebase.google.com/docs/projects/manage-installations

## Application URLs (previously inspected in production)

- Public privacy policy: https://loyce-api-production.up.railway.app/privacy-policy
- Public account-deletion page: https://loyce-api-production.up.railway.app/account-deletion

The pages returned HTTP 200 and relevant text was confirmed in the production JavaScript bundle. The deletion page presents a sign-in path, password re-verification, and submission form. **Submitting a request does not automatically fulfil it.** Manual fulfilment code has passed local tests, but the production operating procedure has not been approved. Re-test the complete authenticated flow before submitting the form.

## General Play Console questions

| Play Console prompt | Working answer | Evidence / remaining condition |
|---|---|---|
| Does your app collect or share required user data types? | **Yes: collects user data.** | Registration, checkout and FCM transmissions. Do not answer "No". |
| Is all collected user data encrypted in transit? | **Likely Yes — verify before submission.** | Bundled native API client enforces an HTTPS /api base URL; email/FCM clients use HTTPS/TLS. Check complete release traffic, SDK transport, and every API endpoint in a real device test. |
| Can users request that their data be deleted? | **Request mechanism: Yes. Fulfilment compliance: OPEN.** | Public and in-app deletion path, authenticated API, manual database-erasure processor. Business approval, retention, external provider processing, and customer completion communications remain open. |
| Does the app permit account creation? | **Yes.** | Customer registration supported in application. |
| Is user data shared with third parties? | **Undetermined from code alone.** | Google Play may exempt transfers to a true service provider acting on the developer's behalf. Do not equate every Neon/Railway/Resend/FCM processing transfer with reportable "sharing"; inspect contracts, SDK-specific use and any other transfers. |

## Candidate data types to select under "Data types"

**"Collected" means transferred off the device**, including via SDKs and controlled WebViews. This table concerns the application as a whole, not just anonymous visitors or staff accounts. The final answer for "required versus optional" depends on whether users can reasonably use the relevant function without submitting that type and how Google Play presents the exact form question.

| Google Play category and type | Working collection assessment | Why / code evidence | Main purpose candidates | Required/optional decision |
|---|---|---|---|---|
| **Personal info → Name** | **Collected: Yes** | Customer full name on account registration; recipient name at checkout. `server/src/routes/auth.ts`, `server/src/routes/orders.ts`. | Account management; App functionality | Required for registration/checkout; browsing does not require it. Review exact Play interpretation. |
| **Personal info → Email address** | **Collected: Yes** | Registration/login identity; email verification and password recovery; Resend transactional email. | Account management; App functionality | Required to register/sign in; optional for browsing. |
| **Personal info → Phone number** | **Collected: Yes** | Optional customer phone field; checkout contact phone required for orders. | App functionality; Account management | Optional for account creation; required for order placement, including pickup. |
| **Personal info → Address** | **Collected: Yes** | Customer-provided delivery address on delivery checkout; pickup path doesn't need address. | App functionality | Optional for pickup/browsing, required for delivery. |
| **Personal info → User IDs** | **Collected: Yes** | Customer ID, session/account linkage, and internal authenticated order ownership. | Account management; App functionality; Security and compliance (only if applicable) | Authenticated operations use an account ID; anonymous product browsing does not. |
| **Financial info → Purchase history** | **Collected: Yes** | Order quantities/products/prices, payment method/status and order history in Neon. | App functionality; Account management | Only generated if an order is placed. Review form definition before marking optional. |
| **Device or other IDs → Device or other IDs** | **Collected: Yes, based on SDK documentation** | Firebase Messaging and Firebase Installations SDKs generate/transmit installation identifiers; app registers staff FCM tokens in Neon. | App functionality (staff notifications) | **VERIFY** SDK auto-initialization for non-staff users and app launch; don't assume optional merely because staff grants notification permission. |
| **App info and performance → Crash logs/Diagnostics** | **Unverified** | Firebase Messaging dependency / Android libraries and server logs alone do not establish exact app-level diagnostic collection. | App functionality / Analytics if observed | Inspect full SDK dependency graph and device network trace. |
| **App activity → App interactions** | **Unverified** | Do not infer Firebase Analytics merely from resources named `client_analytics.proto` or Firebase libraries. | Analytics only if confirmed | Inspect exact release dependency graph and automatic initialization. |
| **Financial info → User payment info** | **Not shown in current checkout code** | Current backend checkout accepts cash on delivery and cash on pickup; no card/bank numbers are collected there. | — | Reassess if payments are added before release. |

**Do not select unrelated categories without evidence:** precise/approximate device location, contacts/address book, photos, audio, messages, health, sexual orientation, browsing history, ad identifiers and credit-card numbers are not established by the inspected app code and permissions. This is not a claim that there is no further SDK collection; that remains a test requirement.

### Third-party transmission and the "sharing" distinction

- **Neon:** app-controlled customer, session and order database through the Railway backend. Processor/contract terms require verification.
- **Railway:** application hosting and network/diagnostic logs; production plan and export retention unverified.
- **Resend:** email addresses and transactional email contents for verification/reset. Already transmitted messages cannot be erased by deleting a Neon Customer row alone.
- **Firebase:** messaging/installation identifiers and notification payloads. Payload currently includes an order number, order ID and staff-navigation route, **not** recipient phone/address. ID linkage may still be sensitive.
- **Other SDKs/recipients:** not excluded until complete dependency and traffic review.

Google Play defines **reportable sharing** separately from **collection**. A qualifying service-provider transfer is an exception, but it is not automatic: assess the relationship, contractual processing, and any independent use of data. Do not mark a type "shared" or "not shared" solely based on whether a vendor name appears in the privacy policy.

### Security and deletion caveats

- Native authentication tokens use Android Keystore-backed secure storage; website sessions use HTTP-only cookies and the API enforces HTTPS for native release.
- Updated signed Android bundle was rebuilt with `allowBackup=false`, `fullBackupContent=false` and `dataExtractionRules` exclusions for cloud backups/device transfers. The bundled XML and manifest were inspected. Backup settings **do not** guarantee deletion of data already present in cloud services.
- The manual erasure service passed local service, operator and concurrency checks; finished transactions are retained as de-identified accounting records where eligible. Never call such records irreversibly anonymous without assessing linkage risks.
- Neon production restore history was observed as **six hours** with no visible snapshots or schedule. Rollback may resurrect erased records and remove database audit evidence; keep an independent, access-controlled deletion register and require restore reconciliation.
- Production verification showed **zero** pending deletion requests and **zero** completed erasure audits at inspection. These are point-in-time facts, not service-level guarantees.
- Missing operational sign-off, third-party cleanup procedures and a supervised end-to-end deletion test must be resolved before publication.

## Release dependency audit — run locally (read-only)

From `client/android`:

```bash
./gradlew :app:dependencies --configuration releaseRuntimeClasspath \
  > /tmp/loyce-release-dependencies.txt

/usr/bin/grep -Ei \
  'firebase|analytics|crashlytics|play-services|google-mobile-ads|datatransport' \
  /tmp/loyce-release-dependencies.txt \
  | /usr/bin/head -n 80
```

Review presence/absence of `firebase-analytics`, `firebase-crashlytics`, `firebase-installations`, `firebase-messaging`, and related transitive SDKs. This is **library inventory only**, not a substitute for observing app network traffic.

## Remaining approval checklist

- [ ] Obtain and review the filtered release dependencies output above.
- [ ] Examine app initialization on a clean Android install without signing in; check FCM installation/token and SDK network activity.
- [ ] Test a new registered customer and a staff notification session; document actual data sent to each destination.
- [ ] Confirm Firebase analytics/crash collection is absent or declare the correct categories and purposes.
- [ ] Confirm all actual off-device data transmissions use encryption in transit.
- [ ] Make the **required/optional** and **collected/shared** decisions per Google Play's exact options, incorporating vendor contract terms.
- [ ] Approve the retention schedule, deletion ownership, external provider handling and independent restore register.
- [ ] Exercise the complete deletion request-and-fulfilment workflow on disposable accounts in a controlled environment.
- [ ] Ensure the live privacy policy discloses all actual vendor processing and retention accurately, including Neon.
- [ ] Have an accountable developer review the final Google Play Console Data safety and Account deletion selections before submission.

**No changes to production, Play Console, app source or the already signed Android bundle are authorized by this document.**
