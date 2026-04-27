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
