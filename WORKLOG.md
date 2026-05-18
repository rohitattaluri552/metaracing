# MetaRacing – Work Log

---

## 16 April 2026

### 1. Server Startup Fixes (Windows)
- Fixed `NODE_ENV` syntax to `set NODE_ENV=development&&` in package.json
- Removed `reusePort: true` from server/index.ts (unsupported on Windows)

### 2. SQLite Database Migration
- Migrated from PostgreSQL/in-memory storage to SQLite (better-sqlite3 + Drizzle ORM)
- Updated shared/schema.ts with `sqliteTable` definitions
- Created SqliteStorage class in server/storage.ts with auto-migration for missing columns
- Updated drizzle.config.ts to SQLite dialect
- DB file location: `data/metaracing.db`

### 3. Users Table
- Fields: id, name, email (unique), phone (optional), password (bcrypt hashed), created_at
- Duplicate email check on registration

### 4. Bookings Table
- Fields: id, name, email, phone, experience, plan, date, guests, message, status (default: confirmed), customer_id, created_at
- Booking cancellation support via PATCH /api/bookings/:id/cancel

### 5. MQTT Server Integration
- Created server/mqtt.ts – connects to broker at 192.168.0.193:1883
- 6 topic handlers: login, register, logout, ticket booking, ticket cancellation, view bookings
- Each handler publishes acknowledgment on `<topic>/ack`
- Updated mqtt_service.dart for mobile app sync

### 6. Validation Fixes (15 issues)
- **Client side**: Date must be today or future, experience/plan enum checks, guests 1–20, phone optional, email normalization, name regex (letters + spaces only), password min 6 + confirm match
- **Server routes**: Same validations on all POST endpoints + duplicate email check
- **MQTT handlers**: Same validations mirrored for mobile app

### 7. Booking Enhancements
- Linked customerId from logged-in user to bookings
- "Book Now" button visible in Navbar for logged-in users
- Booking cancellation support added

### 8. Admin Panel
- **Login page**: client/src/pages/admin-login.tsx → route `/admin`
- **Dashboard page**: client/src/pages/admin-dashboard.tsx → route `/admin/dashboard`
- **Credentials**: admin@metaracing.in / MetaRacing@2026
- **API routes**: POST /api/admin/login, GET /api/admin/stats
- **Storage methods**: getTotalBookings, getTodayBookings, getActiveSlots, getTotalUsers
- **Dashboard displays**: Total Bookings, Active Slots Today, Today's Revenue, Total Revenue, Total Users, Recent Bookings table
- **Revenue calculation**: plan prices × guests (starter=₹449, racer=₹549, champion=₹749, squad=₹499, tournament=₹999)
- Admin session stored separately in localStorage (mr_admin)

---Credentials: admin@metaracing.in / MetaRacing@2026

---

## 28 April 2026

### 9. Route Protection and Authorization (Phase 1)
- Added JWT-based authorization guards in backend routes
- Protected customer routes using role-aware middleware
- Protected admin routes using role-aware middleware
- Removed legacy header-trust admin auth dependency (`x-admin-email`)
- Enforced customer ownership checks on customer profile/booking endpoints

### 10. JWT Authentication Rollout (Self-hosted)
- Added JWT token issuance on:
	- customer register/login
	- customer OTP verify
	- admin login
- Added backend token verification helpers and bearer token parsing
- Updated frontend auth state and token persistence:
	- customer token: `mr_customer_token`
	- admin token: `mr_admin_token`
- Updated shared fetch/query logic to attach correct bearer token automatically for customer/admin APIs

### 11. Booking Integrity and Identity Hardening
- Public booking endpoint now validates authenticated identity when bearer token is present
- Prevented customer ID spoofing by rejecting identity mismatches
- Rejected non-customer JWT roles on customer/public booking creation flow

### 12. Basic Security Middleware
- Enabled `helmet` in Express server setup
- Enabled `cors` middleware in Express server setup

### 13. Validation and Documentation Updates
- TypeScript/JWT typing fixes completed in backend route helpers
- Admin schedule date parameter typing hardened for strict TS checks
- `npm run check` completed successfully after security migration fixes
- Updated backend security checklist with:
	- implemented now (Phase 1)
	- remaining tasks for next phase

