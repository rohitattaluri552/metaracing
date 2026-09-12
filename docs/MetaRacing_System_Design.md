# MetaRacing — System Design & Requirements

**Project:** MetaRacing  
**Branch:** `lohith-backend-deployment`  
**Latest stable commit:** `1916d80` — `chore: remove MQTT and stabilize backend`

## 1. Objective

MetaRacing is a full-stack racing/entertainment booking system with a customer website, admin/reception interface, Express backend, SQLite/Drizzle database, JWT authentication, resource-based booking, payments, offers, reporting, and future Docker/AWS deployment.

The backend is the source of truth for customers, bookings, resources, availability, payments, and operational data.

## 2. Architecture

```text
Customer Website / Admin / Future Mobile App
                    |
                 HTTP API
                    |
               Express Server
             /       |       \
        routes.ts  storage.ts  config
                    |
               Drizzle ORM
                    |
                  SQLite
```

- Actual Express entrypoint: `server/index.ts`
- API routes: `server/routes.ts`
- Database operations: `server/storage.ts`
- Schema: `shared/schema.ts`
- MQTT has been removed. Use Express/HTTP for application communication.
- The `.local/.../mastra/inngest/index.ts` `fetch()` is unrelated to MQTT and should not be removed as MQTT cleanup.

## 3. Customer Requirements

A booking has one primary/responsible customer.

Retain customer history such as:
- Name
- Email
- Phone
- Visit/booking dates and times
- Number of people
- Experiences/resources used
- Payment information where appropriate

Phone may be collected as contact information but does not need verification.

### Companions

A customer can bring friends. Do **not** collect companion names/details.

Example:

```text
Customer: Lohith
Party size: 3
```

Store only the count. Prefer `partySize` to mean total people using the resource.

## 4. Email Verification

Email verification must be configurable because business approval is not finalized.

```env
EMAIL_VERIFICATION_REQUIRED=true
```

means verification is required.

```env
EMAIL_VERIFICATION_REQUIRED=false
```

means verification is skipped.

Email being required and email verification being required are separate concepts. Email should normally remain a required customer field.

Use a central config layer:

```text
Environment → config → application logic
```

Do not scatter `process.env` checks throughout the application.

## 5. Resources

Resources must be database-driven, not hardcoded.

Initial known inventory:

- SIM: 4 rigs — 1 triple-screen, 3 single-screen
- VR: 2 stations
- RC: inventory to be finalized

A resource should eventually contain properties such as:

```text
id
name
type
active
maintenance
maxPeople
```

Example:

| Resource | Type | Max People | Status |
|---|---|---:|---|
| SIM-01 | Triple Screen | 3 | Active |
| SIM-02 | Single Screen | 2 | Active |
| SIM-03 | Single Screen | 2 | Active |
| SIM-04 | Single Screen | 2 | Active |
| VR-01 | VR | 2 | Active |
| VR-02 | VR | 2 | Active |

Admin should be able to change resource status and maximum capacity.

## 6. Booking Rules

A booking should conceptually contain:

```text
customer
resource
date
start time
end time
party size
experience/plan
status
payment
created timestamp
```

Core rule:

> One resource cannot have overlapping active bookings.

Different resources may be booked at the same time.

Example:

```text
SIM-01 → Lohith
SIM-02 → Rahul
VR-01  → Priya
```

is valid.

Backend conflict prevention is mandatory; frontend checks alone are insufficient.

## 7. Admin Resource Availability

Add an admin-only website tab:

**Resource Availability**

Example:

| Resource | Type | Status | Current Booking | Ends |
|---|---|---|---|---|
| SIM-01 | Triple Screen | Available | — | — |
| SIM-02 | Single Screen | Occupied | Customer | 6:45 PM |
| SIM-03 | Single Screen | Available | — | — |
| SIM-04 | Single Screen | Maintenance | — | — |
| VR-01 | VR | Occupied | Customer | 7:15 PM |
| VR-02 | VR | Available | — | — |

Occupied resources should show:

```text
Occupied — ends in 23 min
```

or:

```text
Occupied — ends at 7:15 PM
```

End time must be calculated from booking data.

Resource states:
- Available
- Occupied
- Maintenance
- Inactive

## 8. Admin / Reception

Reception and online customers use the same backend and booking database.

```text
Customer Website ─┐
                  ├→ Express API → Database
Reception/Admin ──┘
```

This prevents separate booking systems from becoming inconsistent.

## 9. Offers

Admins should eventually create/change offers from the website.

```text
Admin → Offer → Database → Website
                     ↓
               Booking price
                     ↓
                  Billing
```

Offers should be database-driven.

## 10. Payments & Billing

Current code already has basic payment fields and a backend operation for marking payment complete.

Future requirements:
- Price calculation
- Payment integration
- Bill/receipt generation
- Printing
- Emailing receipt/bill
- Offer-aware pricing

Audit the existing implementation before claiming the complete billing workflow is finished.

## 11. Daily Closing Report

Initial requirement:

```text
Daily report: 9:00 PM
```

Future flow:

```text
Daily operations → 9 PM → Generate report → Email configured recipient
```

Potential contents:
- Bookings
- Visits/customers
- Resource usage
- Revenue/payment summary
- Cancellations
- Other operational metrics defined later

Time and recipient should eventually be configurable.

## 12. Food

Food is intentionally future scope. Do not prioritize it before the booking/resource foundation.

## 13. Security

Known requirements:
- JWT secret from environment configuration
- Admin credentials from environment configuration
- Correct authorization on admin/customer endpoints
- No public exposure of all bookings
- Secure email verification when enabled
- Review/remove legacy phone OTP flow when email verification replaces it
- Review password handling
- Validate input
- Enforce booking conflicts in backend

## 14. Current Database

Current tables:

```text
users
bookings
schedule_overrides
```

The current schema does not yet have a proper `resources` table or resource assignment.

Current slot counting is global by date/time and is insufficient for resource-specific occupancy.

## 15. Planned Development Order

1. Inspect current routes against the new requirements.
2. Design resource database model.
3. Add booking/resource relationship and time model.
4. Implement backend overlap prevention.
5. Implement resource availability API.
6. Implement admin resource management.
7. Implement admin Resource Availability tab.
8. Implement configurable email verification.
9. Implement offers.
10. Implement billing/receipt flow.
11. Implement daily report.
12. Docker/AWS/domain/HTTPS production work.

## 16. Development Rules

- Inspect actual current files before modifying them.
- Make small coherent changes.
- Run `npm run check` after backend changes.
- Run `git diff --check`.
- Commit stable features separately.
- Do not merge the deployment branch prematurely.
- Do not assume old ZIP/source versions match the current project.

## 17. Open Decisions

- Exact booking duration/start-end model
- Initial RC inventory
- Email verification provider
- Payment provider
- Invoice format
- Daily report contents
- Report recipient
- Production database/storage strategy
- Resource management UI details

## 18. Current Next Step

Inspect `server/routes.ts` and map current booking/auth/admin endpoints against the new resource model before modifying the schema.
