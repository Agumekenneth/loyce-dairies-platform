# Loyce Dairies — Milestone 4.6.3: delivery-zone backend hardening

Source of truth: `loyce-delivery-backend-review.zip` submitted by the user. This patch replaces exactly the three named source files and adds **one new Prisma migration directory**. It does not change the existing endpoints or frontend request payload shapes.

## Scope and behavior

- GET `/api/delivery-zones`: active zones only, no caching.
- POST `/api/admin/delivery-zones`: staff only, creates inactive zone + CREATED audit atomically.
- PATCH `/api/admin/delivery-zones/:zoneId`: staff only, edits **inactive zones only**; 409 when active; records UPDATED audit atomically. Unchanged submissions return 200 without writing an audit event.
- PATCH `/api/admin/delivery-zones/:zoneId/activation`: staff only; activating still requires `confirmation: "ZONE_AND_FEE_APPROVED"`; activation/deactivation and audit commit atomically.
- GET `/api/admin/delivery-zones/:zoneId/audit`: staff only, newest 100 events including actor name and before/after snapshots.
- POST `/api/orders/checkout`: active-zone lookup is locked with PostgreSQL `FOR SHARE` until the transaction creates the order; server calculates and stores the fee, not browser input.
- Existing customer authorization, order views, order status workflow and payment status handling stay unchanged.

## Important caveat

The activation confirmation remains a staff *acknowledgement*, **not** independent proof that Loyce Dairies approved the location and fee. Do not activate `Development Test Zone Updated`. Records created before this migration have no historical audit events (no backfill). Audit events are application-written; database administrators could still change or delete records, so this is not a tamper-proof compliance ledger. GET audit returns up to 100 most recent events, not complete pagination.

## Install (Mac Terminal)

1. Stop backend server and take a database backup if this is valuable data. Keep Docker PostgreSQL running.
2. Extract the patch ZIP in Downloads, which produces a folder named `loyce-delivery-security-patch`.
3. From project root, copy the three source files and the migration into the matching paths (examples below). The copied migration directory must not overwrite an existing migration with the same name; rename it to a later unique timestamp if necessary, before applying.

```sh
cd /Users/agumekenneth/Documents/loyce-dairies-platform/loyce-dairies-platform
cp ~/Downloads/loyce-delivery-security-patch/server/src/routes/adminDeliveryZones.ts server/src/routes/adminDeliveryZones.ts
cp ~/Downloads/loyce-delivery-security-patch/server/src/routes/orders.ts server/src/routes/orders.ts
cp ~/Downloads/loyce-delivery-security-patch/server/prisma/schema.prisma server/prisma/schema.prisma
cp -R ~/Downloads/loyce-delivery-security-patch/server/prisma/migrations/20261110180000_delivery_zone_audit server/prisma/migrations/
cd server
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run typecheck
npm run build
```

4. If validation/migration/typecheck fails, **stop before testing**. Never use `prisma migrate reset` on a database containing orders. If `prisma migrate dev` wants to reset data due to drift, stop and inspect it first.
5. Restart backend and keep frontend running.

## Safe verification sequence (NO activation of development test zone)

- As staff, GET `/api/admin/delivery-zones`, confirm zone 1 `isActive: false`.
- As staff, GET `/api/admin/delivery-zones/1/audit`. Existing zone likely returns empty array initially; migration does not invent history.
- PATCH `/api/admin/delivery-zones/1` with `{"name":"Development Test Zone Updated"}` when it is already that value: returns 200, no new event.
- PATCH same inactive zone with a *real* name change (`{"name":"Development Test Zone Audit Check"}`), expect 200; audit gets UPDATED with staff actor, before/after. Then change name back (another UPDATED event).
- PATCH `/api/admin/delivery-zones/1/activation` with `{"isActive":true}`, no confirmation: 400 and no audit change.
- GET `/api/delivery-zones`: `{"success":true,"count":0,"data":[]}` while there are no other active zones.
- GET admin audit as an ordinary customer: 403; unauthenticated: 401.
- To test the 409 active-zone editing rule **without activating any development zone**, use a disposable test database or an already approved active real zone; never activate a dummy in your working database merely for a test.

Postman staff mutation headers: `Origin: http://localhost:5173`, `X-Loyce-Request: 1`, `Content-Type: application/json`, valid staff session cookie.

## Checkout verification

- A `DELIVERY` checkout with inactive zone id 1 must produce 422 (with a valid signed-in customer and valid available product input).
- `PICKUP` with `CASH_ON_PICKUP` must continue to work.
- Only after a **real fee is approved** should a genuine zone be activated and its fee tested in a delivery order.

## Pre-commit review

```sh
cd /Users/agumekenneth/Documents/loyce-dairies-platform/loyce-dairies-platform
git diff --check
git status -sb
git diff --stat
```

Do not commit `.env`, secrets, generated Prisma client, or database backup dumps.
