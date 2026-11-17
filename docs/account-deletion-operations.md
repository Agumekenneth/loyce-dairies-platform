# Loyce Dairies — Account-deletion operations (draft)

**Status:** Operational review required before live account erasure.  
**Scope:** Customer account deletion through the authenticated website/Android request flow, Neon PostgreSQL, Railway application hosting, and supporting service providers.  
**Last reviewed:** 17 November 2026.

## Verified baseline

- Requests are submitted through `/account-deletion`; the API is `/api/account-deletion`.
- A request **does not immediately erase** the account. The `AccountDeletionRequest` row remains pending.
- The local erasure service and guarded CLI passed disposal-only tests (4/4 service cases, 5/5 CLI checks, plus pending-order protection). Two local checkout/deletion concurrency tests passed.
- Successful local erasure is designed to delete the original account and customer sessions, anonymize eligible retained order data, and create an `AccountErasureAudit` row atomically.
- The production Neon database has both `20261117120000_account_deletion_requests` and `20261117130000_account_erasure_audit` marked applied.
- On 17 November 2026 the production database showed **0** pending requests and **0** completed erasure audit rows.
- Neon Backup & Restore displayed a **6-hour history window** for the production branch, with **no snapshots and no snapshot schedule displayed**. This describes user-facing point-in-time restore capability, **not** all provider-managed storage, logs, external backups, or retention.

These observations are point-in-time only and must be rechecked before live operations.

## Responsibilities and approval

1. Assign a named, authorized privacy/deletion operator and a separate reviewer. Do not make a customer-facing request automatically execute erasure.
2. Record the request ID, date/time, order state, reason for any retention or delay, operator, reviewer, completion timestamp, and follow-up status **in an access-controlled operational register stored outside the Neon database branch being restored**. This register may contain personal data and must have restricted access and its own retention schedule.
3. Verify that the request genuinely belongs to the customer (authenticated password-confirmed API request or separately documented identity verification); do not accept an email or message alone as proof.
4. Check current orders, settlement/refunds, disputes and any legal/accounting obligations before approving deletion.
5. Maintain a written response procedure for informing the requester and handling disputes, subject to the applicable privacy requirements.

**Do not store customer IDs, request IDs, passwords, contact data, database URLs, secret tokens, or screenshots containing such information in this Git repository.**

## Read-only inspection

From `server/`, with an explicitly verified `DATABASE_URL` that points to the **intended environment**:

```bash
npx tsx scripts/reviewAccountDeletionRequests.ts
```

To review a specific request, without executing deletion:

```bash
npx tsx scripts/processAccountDeletionRequest.ts --request-id '<request-id>'
```

This second command is a dry run by default. Do **not** set `ALLOW_ACCOUNT_ERASURE` or `ALLOW_REMOTE_ACCOUNT_ERASURE` during ordinary reviews. Never paste connection credentials into tickets or chat.

## Before a live deletion

**Production execution is not yet authorized by this document.** Before introducing a production runbook for execution:

- Independently review the source, authorization model, transaction/locking behavior, schema dependencies, and local tests.
- Reconfirm exact account/request IDs through the secure register; require two-person approval of any irreversible deletion.
- Establish how to notify customers of completion, delays, and permitted retention exceptions.
- Verify any personally identifying data in stored orders, audit events, logs, exported reports, third-party email or messaging tools, support tickets, object storage, analytics, and caches. The database erasure service does not erase these automatically.
- Confirm applicable obligations and set a retention schedule with accountable owners. Do not claim a fixed provider retention period without written evidence.
- Verify how source-of-truth erasure evidence is stored **outside** the database restore boundary, including access controls, tamper resistance, recovery and expiry.
- Test a restoration drill on an isolated disposable database or branch, **never** the production branch, before relying on the procedure.

## Restore and deleted-data resurrection safeguard

Neon offers a six-hour production point-in-time restore window as observed on 17 November 2026. A restore to a timestamp before an account deletion can bring back the erased customer, sessions, contact details and orders. It can also remove `AccountErasureAudit` rows written after the restore timestamp; therefore **the audit table inside Neon is not by itself sufficient to reconcile past deletions after a restore**.

Mandatory procedure for any production restore:

1. **Freeze customer traffic and staff writes** before restoring; do not let a restored database serve live customers until reconciliation is complete.
2. Preserve a secure, access-controlled list of fulfilled deletions from the external operational register, plus any new requests and other post-restore actions that must be reconciled.
3. Restore into an isolated environment/branch when feasible, and compare the restored state with the external record before switching production connections.
4. Reapply or safely reconcile erasure for records resurrected by the restore, considering unresolved orders and legal retention rules; don't blindly run deletion scripts against unknown records.
5. Verify sessions and account status, order anonymization, deletion completion evidence, application behavior, and provider-side follow-ups.
6. Obtain independent approval and only then restore production access. Log the restoration and reconciliation separately outside the restored database.

**Never use the presence or absence of `AccountErasureAudit` after a restore as the sole proof that previously completed erasures were preserved.**

## Backup and vendor follow-ups

- **Neon:** six-hour visible PITR history window; check whether additional branches, snapshots, provider backups, or storage processes contain recoverable user data and document their retention.
- **Railway:** establish actual deployment/runtime log retention, exports and any database backups handled outside Neon; do not assume the Railway API service itself holds a Postgres backup.
- **Email provider:** determine handling and deletion of transactional email content and delivery logs.
- **Firebase:** determine retention for staff push tokens and message/delivery metadata.
- **Devices and exports:** include customer-local data, staff exports, support files and operational snapshots when applicable.
- **Retention vs recovery:** increasing Neon history/snapshot retention improves disaster recovery but also lengthens the time deleted data may be recoverable. Choose the policy explicitly; do not change it merely to make deletion appear immediate.

## Release gate

Production account erasure remains **manual and disabled by default**. Do not claim complete Google Play account-deletion compliance merely because public pages, migrations and local tests passed. Complete operational ownership, retention disclosures, backup/restore reconciliation, third-party handling and a supervised end-to-end dry run before approving live use.

## Reference

Neon documentation on branch restoration and snapshots: https://neon.com/blog/announcing-neon-snapshots-a-smoother-path-to-recovery
