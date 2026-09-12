# MetaRacing — Claude Code Handoff Report

## Purpose
This document captures the real working state of the repo so another machine can continue without guessing. Use it as the source of truth for the current branch, files, database state, and completed work.

## Current repo state
- Workspace path: E:\metaracing
- Branch: lohith-backend-deployment
- Remote tracking: origin/lohith-backend-deployment
- HEAD: a873ac4 — feat: add resource based booking schema
- Current repo status: dirty working tree; do not assume a clean checkout
- No commit should be made automatically from this point unless explicitly requested

## Working tree summary
The repo is in active feature development. The current working tree includes both modified tracked files and new untracked admin pages.

Modified tracked files:
- .local/skills/artifacts/artifacts/automation/files/src/mastra/inngest/index.ts
- client/src/App.tsx
- client/src/components/BookingSection.tsx
- client/src/components/PricingSection.tsx
- client/src/pages/admin-dashboard.tsx
- client/src/pages/dashboard.tsx
- data/metaracing.db
- data/metaracing.db-shm
- data/metaracing.db-wal
- server/routes.ts
- server/storage.ts
- shared/schema.ts

Untracked files created during this work:
- README.md
- client/src/pages/admin-customers.tsx
- client/src/pages/admin-pricing.tsx
- client/src/pages/admin-resource-availability.tsx
- client/src/pages/admin-resources.tsx
- docs/
- server/Test/

## What has been implemented and verified so far
The repo has moved from the older single-booking flow to a resource-based booking model.

Completed work includes:
- Resource-based booking flow for customer booking
- Exact booking durations and time range handling
- Resource availability checks
- Resource capacity checks
- Overlap protection on bookings
- Resource status management
- Admin Resource Availability page
- Admin Resources CRUD page
- Admin Customers read-only page with list + detail view
- Existing admin JWT auth pattern preserved for admin-only endpoints

## Current database and business state
Present in the current database:
- 35 bookings
- 6 resources
  - 4 SIM
  - 2 VR
  - 0 RC

The current data model is not redesigning customer record creation. It reuses the existing users table and keeps booking identity linked through customer_id where available.

## Existing customer/user data model in use
The working model is intentionally minimal and already exists:

users table fields:
- id
- name
- email
- phone
- experience_level
- password
- created_at

bookings table fields relevant to customer history:
- id
- name
- email
- phone
- experience
- plan
- date
- time_slot
- guests
- status
- payment_status
- payment_amount
- payment_mode
- customer_id
- resource_id
- start_time
- end_time
- party_size
- created_at

Important rule in practice:
- One booking represents one primary customer.
- Friends/companions should not become separate customer records.
- partySize is the total number of people in the booking.
- Legacy bookings without customer_id must not be fabricated into customer records.

## Important architecture notes
- Frontend: React + Vite
- Backend: Express + TypeScript
- Persistence: SQLite + Drizzle
- Auth: JWT-based customer/admin tokens stored in localStorage (`mr_customer_token`, `mr_admin_token`)
- Admin auth should continue using bearer JWT checks and admin-role enforcement.
- The project still contains older compatibility fields on bookings for existing flows and legacy displays; do not remove these casually.

## Files relevant to this work
Key file paths:
- [server/storage.ts](../server/storage.ts)
- [server/routes.ts](../server/routes.ts)
- [shared/schema.ts](../shared/schema.ts)
- [client/src/App.tsx](../client/src/App.tsx)
- [client/src/pages/admin-dashboard.tsx](../client/src/pages/admin-dashboard.tsx)
- [client/src/pages/admin-customers.tsx](../client/src/pages/admin-customers.tsx)
- [client/src/components/BookingSection.tsx](../client/src/components/BookingSection.tsx)

## Current implementation status by feature
### Resource booking flow
Status: implemented and active
Notes:
- Booking flow is aligned with resource records instead of legacy rig references.
- One booking is tied to one resource and uses start/end time plus partySize.

### Admin resources
Status: implemented
Notes:
- Admin can view/manage resources and availability.
- Resource CRUD and availability checks are in place.

### Admin customers
Status: in progress / implemented as a read-only view
Notes:
- Customer directory is present in [client/src/pages/admin-customers.tsx](../client/src/pages/admin-customers.tsx).
- Customer list, search, and detail history are expected to use the existing user + booking tables rather than creating new customer records.
- Bookings without customerId are not fabricated into customer rows.

### Auth and security
Status: protected and maintained
Notes:
- Existing admin JWT authorization is the base requirement.
- Do not weaken it while continuing work.

## Current working assumptions for continuation
When continuing on another machine:
1. Start by checking git status and branch state.
2. Preserve the existing SQLite database and avoid destructive migrations.
3. Reuse the current users + bookings data instead of adding a separate customer table.
4. Keep booking logic stable; do not touch overlap, duration, or resource availability logic unless the task is directly about that feature.
5. Do not create sample customers or bookings during development.
6. Before calling work complete, run `npm run check`.

## Handoff instructions for Claude Code
- Read the current git status before editing.
- Prefer the existing schema and storage methods instead of creating a new customer model.
- Admin-only customer endpoints should use the same JWT guard pattern as the current admin routes.
- When joining customer and booking data, only show customers who already exist in users and who can be linked through customer_id.
- For booking history, sort newest first.
- For search, match name, email, and phone using the current database/storage layer.
- Leave bookings untouched; no rewriting or deletion of active data.

## Known constraints
- Do not add marketing automation, offers targeting, or email campaign features.
- Do not add customer editing, deletion, or new customer fields.
- Do not touch booking overlap logic, duration logic, pricing logic, or resource availability rules.
- Do not change payment, OTP, authentication, or schedule logic unless the task specifically requires it.

## Recommended next actions on the next machine
1. Verify repo cleanliness and branch state.
2. Review [server/storage.ts](../server/storage.ts) and [server/routes.ts](../server/routes.ts) for the current admin/customers implementation.
3. Check whether the customer pages are wired into the router and admin navigation.
4. Run `npm run check` and fix anything blocking the router or route logic.
5. Validate the full admin flow manually:
   - admin login works
   - customer list loads
   - search works
   - customer detail opens
   - booking history is visible and sorted newest first
   - bookings without customerId are handled safely

## Final note
This repo is currently in a resource-based booking and admin-management branch, with a dirty working tree and multiple active feature additions. The safest continuation path is to preserve the current schema, reuse existing user/booking links, and avoid introducing large new data models or migrations without a clear, necessary reason.

Do not rewrite the slot-selection algorithm unless explicitly requested.

## Working Functionality — Do Not Break
Preserve:
- authentication
- phone OTP
- calendar
- closed dates
- slot loading/availability
- time range selection
- plan selection
- payment/QR
- dashboard navigation
- booking confirmation
- current venue check-in verification

Do not rewrite these during resource work.

## Email Verification — Future Requirement
Business may move from phone OTP to email verification.

Desired configuration concept:
```text
EMAIL_VERIFICATION_REQUIRED=true
```

When enabled, email verification is required. When disabled, it is not.

Keep `EMAIL_REQUIRED` and `EMAIL_VERIFICATION_REQUIRED` conceptually separate.

Use a central typed config layer rather than scattered `process.env` checks.

Do not implement until business approval is confirmed.

## Customer History
Retain customer/booking history useful for future offers/marketing:
- customer
- booking date/time
- resource/experience
- party size
- payment status
- attendance/check-in where available

## Admin Resource Availability — Future
Admin-only tab: **Resource Availability**

Show each resource:
- Available
- Occupied
- Maintenance
- Inactive

When occupied, show:
- booking/customer
- end time
- countdown if useful
- party size

Derive occupancy from DB bookings/resources rather than manually maintaining a second occupancy state.

Future admin resource management:
- add
- edit
- activate/deactivate
- maintenance
- max people
- display order

## Reception/Admin Booking — Future
Customers can self-book online.
Reception/admin can also create bookings.
Both must use the same backend booking model and booking records.

## Offers — Future
Admin should be able to:
- create offer
- edit offer
- activate/deactivate offer

Active offers should automatically appear on the website.
Later integrate offers into booking price calculation and billing.

## Food — Later
Do not work on food now.

## Billing — Future
Desired:
- bill calculation
- receipt/invoice
- printing
- email receipt/bill

Inspect current implementation before claiming it is complete.

## Daily Closing Report — Future
Initial report time: 9:00 PM.

Future:
- generate daily report
- email configured recipient
- eventually make report time configurable

Potential data:
- bookings
- check-ins
- revenue/payment status
- resource utilization
- cancellations

## Deployment — Future
Target:
```text
Docker → AWS → existing domain → HTTPS
```

Do not prioritize deployment before core booking/resource behavior is stable.

## Current Local Startup Blocker
`npm run dev` currently stops because environment configuration is not being recognized.

First error:
```text
Error: JWT_SECRET environment variable is required
```

Then, after setting:
```powershell
$env:JWT_SECRET="metaracing-local-dev-secret-change-this"
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="change-this-local-password"
```

startup still failed with:
```text
Error: Admin credentials are required
```

Do NOT weaken/remove validation in `server/routes.ts`.
Do NOT hardcode secrets.
Inspect actual expected variable names and existing `.env`/config loading first.

Inspect:
- `package.json`
- `server/routes.ts`
- `server/index.ts`
- `.env`
- `.env.example`
- other environment configuration

## Testing
After relevant changes:

```powershell
npm run check
git diff --check
```

Resource endpoint test example:
```text
GET /api/resources/available?type=sim&date=FUTURE_DATE&startTime=18:00&endTime=19:00&partySize=1
```

Also test party sizes 2, 3, and 4.

Frontend Network tab should show `/api/resources/available` and should not use `/api/rigs` for new resource selection.

## Current Known Checkpoint
After resource migration:
- Backend resource DB/migration: implemented
- Resource availability storage: implemented
- GET resource availability endpoint: implemented
- Frontend resource wiring: implemented
- `npm run check`: passed
- `git diff --check`: passed
- Local UI runtime verification: blocked by environment configuration
- No commit made for the current resource work yet

## Recommended Work Order
1. Fix/verify local environment configuration.
2. Start Express + frontend and runtime-test resource booking.
3. Verify booking POST and DB fields:
   - resourceId
   - resourceType
   - date
   - startTime
   - endTime
   - partySize
4. Verify overlap protection.
5. Only then clean up legacy compatibility.
6. Build admin resource management/availability tab.
7. Implement email verification after business approval.
8. Implement offers.
9. Implement billing/receipt.
10. Implement daily report.
11. Docker/AWS/domain/HTTPS deployment.

## Do Not Do
- Do not reintroduce MQTT.
- Do not remove the Mastra/Inngest `fetch()`.
- Do not break OTP/check-in.
- Do not invent API endpoints.
- Do not duplicate storage SQL in routes.
- Do not hardcode resources when DB data exists.
- Do not introduce multi-resource booking without approval.
- Do not hardcode JWT/admin secrets.
- Do not bypass environment validation.
- Do not add dependencies without need.
- Do not modify unrelated files.
- Do not commit automatically.
- Do not use the original ZIP as the source of truth.

## Final Rule
Treat this document as a handoff, not permission to implement every listed feature.

For every task:
1. Inspect current files.
2. Make the smallest correct change.
3. Preserve working logic.
4. Run relevant checks.
5. Report exactly what changed.
6. Do not commit unless explicitly instructed.
