# MetaRacing — Work Progress

**Branch:** `lohith-backend-deployment`  
**Latest stable commit:** `1916d80` — `chore: remove MQTT and stabilize backend`

Use this document as the running development log. Update it after each meaningful checkpoint.

## Status Legend

- ✅ Done
- 🟡 In progress
- ⬜ Pending
- 🔴 Blocked

---

# Completed

## MQTT removal — ✅

- Deleted `server/mqtt.ts`
- Removed MQTT import/startup from `server/index.ts`
- Confirmed no active MQTT usage remained in application source
- Express/HTTP is now the application communication layer

Important: `.local/.../mastra/inngest/index.ts` contains `fetch()` for Inngest/Mastra forwarding and is unrelated to MQTT.

## Backend TypeScript stabilization — ✅

Fixed Express middleware typing by adding `next: NextFunction`.

JWT configuration now requires:

```env
JWT_SECRET=...
```

instead of a development fallback.

Verification:

```powershell
npm run check
```

Result: no TypeScript errors.

## Admin credential configuration — ✅

Removed hardcoded admin credentials.

Expected configuration:

```env
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

## Booking endpoint security — ✅

`GET /api/bookings` now requires admin authentication.

Frontend inspection showed customer booking uses:

```text
POST /api/bookings
```

and does not depend on public `GET /api/bookings`.

## Git checkpoint — ✅

```text
1916d80 — chore: remove MQTT and stabilize backend
```

Branch:

```text
lohith-backend-deployment
```

Branch was successfully pushed to the remote repository.

Do not merge yet.

---

# Confirmed Requirements

## Customer

- One primary/responsible customer per booking
- Keep customer history
- Phone can be stored without verification
- Email should be retained
- Email verification is configurable

## Companions

Only store a count.

Example:

```text
Customer: Lohith
Party size: 3
```

No companion names/details.

## Resources

Initial known resources:

```text
SIM: 4 (1 triple-screen + 3 single-screen)
VR: 2
RC: to be finalized
```

Resources need database-driven configuration.

## Booking conflict

Same resource + overlapping active time = reject.

Different resources + same time = allowed.

## Admin availability

Admin-only tab showing:

- Available
- Occupied
- Maintenance
- Inactive
- Occupied booking end time/countdown

## Email verification

Configuration:

```env
EMAIL_VERIFICATION_REQUIRED=true|false
```

Use a central config layer.

---

# Work Queue

## 1. Inspect API routes — 🟡 Next

Map `server/routes.ts` against:
- Current schema
- Current storage methods
- Frontend API calls
- New resource requirements

No schema edit until this mapping is complete.

## 2. Resource database model — ⬜

Add/design:
- resources
- resource type
- status
- max people
- booking/resource relationship
- booking time model

## 3. Booking conflict prevention — ⬜

Backend must prevent overlapping active bookings for the same resource.

## 4. Resource availability API — ⬜

Admin API to determine current state and booking end time.

## 5. Admin resource management — ⬜

Configure:
- Active/inactive
- Maintenance
- Maximum people
- Resource details

## 6. Admin Resource Availability tab — ⬜

Show live/current resource status and end times.

## 7. Email verification — ⬜

Implement configurable email verification and review/remove legacy phone OTP.

## 8. Offers — ⬜

Database-driven offers, admin CRUD, website display, booking price integration.

## 9. Billing — ⬜

Pricing, payment, receipt/bill, print, email.

## 10. Daily closing report — ⬜

Initial target: 9:00 PM. Generate and email report.

## 11. Production deployment — ⬜

Docker, AWS, environment variables, existing domain, HTTPS, production storage/database, backups, logging.

---

# Development Checklist

After backend changes:

```powershell
npm run check
git diff --check
git status
```

Before a coherent commit:

```powershell
git add <specific files>
git commit -m "<clear message>"
git push
```

Avoid unrelated files in feature commits.

---

# Decision Log

## D-001 — MQTT

**Decision:** Remove MQTT and use Express/HTTP.

**Status:** Accepted / implemented.

## D-002 — Configurable email verification

**Decision:** Business behavior controlled by:

```env
EMAIL_VERIFICATION_REQUIRED=true|false
```

**Status:** Accepted / implementation pending.

## D-003 — Companion details

**Decision:** Store party count only; no companion identities.

**Status:** Accepted.

## D-004 — Resource-specific booking

**Decision:** Every resource-bookable booking must identify its resource internally.

**Status:** Accepted / implementation pending.

## D-005 — Admin resource availability

**Decision:** Add admin-only Resource Availability tab showing current status and booking end time.

**Status:** Accepted / implementation pending.

---

# Latest Next Action

Inspect the current `server/routes.ts` before editing the database.

Do not make a large rewrite. Work incrementally and create a Git checkpoint after each stable feature.
