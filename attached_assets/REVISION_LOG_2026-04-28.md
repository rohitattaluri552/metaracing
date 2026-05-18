# MetaRacing Revision Log - 2026-04-28

This document summarizes all edits completed in this chat session, including:
- features added
- behavior/flow changes
- files modified
- line-level change references (from git diff hunks)

## 1) Features Added

### A. OTP Check-in + Payment Confirmation Lifecycle
- Admin can verify booking check-in OTP.
- After verification, admin is prompted to record payment amount and payment mode.
- Payment mode supported: cash, card, upi.
- Booking stores payment state and amount.
- Admin slot cards show:
  - OTP Verified + Payment Pending
  - OTP Verified + amount paid + payment mode
- User ticket dialog hides OTP after payment is marked done and shows completion message.

### B. Cancellation Lock After Verification + Payment
- Cancel is now blocked if booking has:
  - checkin_verified = true
  - payment_status = done
- Backend enforces this rule.
- Admin UI disables cancel and shows Locked state.
- Locked state includes tooltip explanation.

### C. Multi-hour Booking via Double-Handle Horizontal Slider
- Booking page now supports selecting a start and end slot on one horizontal track.
- Two pointers/handles select min and max time.
- Duration is computed and displayed.
- Booking submit sends all selected hourly slots in one request.
- Backend creates one booking per selected slot.

### D. Booking Plan Pricing Visibility
- Plan selection changed from simple dropdown to visual cards showing rates.
- Starter / Racer / Squad / Tournament rates are visible in booking flow.

### E. Contact Section on Homepage
- Contact anchor now points to dedicated contact block.
- Added contact cards under booking area with:
  - contact name
  - phone
  - email
  - location

### F. Logged-in Booking Route + Auth Improvements
- Added dedicated logged-in booking route/page.
- Auth context extended to support directly setting authenticated customer after OTP verify.

### G. Profile Completion Page + Racer Experience Category
- Added a dedicated profile page for logged-in customers.
- Users can now complete or update:
  - name
  - email
  - phone number
  - racing experience category
- Experience category options added:
  - Rookie = first-timer / new to sim racing
  - Veteran = already experienced
- OTP-created users can replace placeholder contact details later without losing access.
- Updated profile data is written back into customer-linked booking identity fields for consistency.

## 2) Website Flow Changes

### Public Booking Flow (Before -> After)
- Before: single-slot selection only.
- After:
  1. Date selection
  2. Two-handle horizontal time range selection
  3. Rig selection
  4. Plan card selection with pricing
  5. Payment summary
  6. Submit creates booking(s) for all selected slots

### Check-in / Ticket Visibility Flow
- Before: OTP shown in last 15 mins and remained visible as normal.
- After:
  1. OTP shown only in allowed time window.
  2. Admin verifies OTP.
  3. Admin records payment amount + mode.
  4. User ticket switches to payment-complete status and OTP is no longer shown.

### Admin Cancellation Flow
- Before: confirmed bookings could be cancelled directly from admin UI.
- After: cancellation is blocked once verification and payment are completed.

### Profile Completion Flow
- Before: dashboard showed a profile-pending message, but there was no real page to complete details later.
- After:
  1. User opens profile page from dashboard.
  2. User updates contact details and selects experience category.
  3. Backend saves profile and returns updated customer data.
  4. Frontend refreshes local authenticated customer state.
  5. Dashboard profile badge reflects Rookie or Veteran.

## 3) Files Changed (Code)

## 3.1 client/src/App.tsx
- Purpose of change:
  - Added dashboard/book route wiring updates.
  - Added profile route wiring.
- Hunk references:
  - around L12
  - around L23

## 3.2 client/src/contexts/AuthContext.tsx
- Purpose of change:
  - Added authenticated customer setter support for OTP login flow.
  - Extended customer shape to include experience category.
- Hunk references:
  - around L14
  - around L65
  - around L76

## 3.3 client/src/components/BookingSection.tsx
- Purpose of change:
  - Major booking flow redesign.
  - Plan pricing cards.
  - Multi-hour range selection using dual-handle slider.
  - Submit all selected slots.
  - Payment summary updates.
- Hunk references (major):
  - around L9, L15, L28, L48, L64, L83, L130, L160
  - around L184, L219, L236, L265, L360, L382, L422
  - around L467, L510, L531, L584

## 3.4 client/src/components/ui/slider.tsx
- Purpose of change:
  - Enhanced slider to support multi-thumb rendering (dual-handle range behavior).
- Hunk references:
  - around L9-L30

## 3.5 client/src/components/Navbar.tsx
- Purpose of change:
  - Nav updates including contact anchor mapping changes.
- Hunk references:
  - around L10
  - around L13
  - around L26
  - around L102
  - around L159

## 3.6 client/src/pages/admin-dashboard.tsx
- Purpose of change:
  - OTP verify UI wiring.
  - Payment capture dialog (amount + mode).
  - Payment status badges.
  - Cancel lock handling + tooltip for locked state.
- Hunk references (major):
  - around L39, L59, L68, L70, L108, L125
  - around L165, L177, L358, L472
  - around L643, L670, L684, L790
  - around L796, L877, L1068, L1178
  - around L1298

## 3.7 client/src/pages/dashboard.tsx
- Purpose of change:
  - Ticket dialog check-in state enhancements.
  - Payment-complete message and payment mode display.
  - OTP hidden when payment is done.
  - Added profile-completion entry points.
  - Racer profile badge now reflects saved experience category.
- Hunk references:
  - around L8, L29, L73, L95, L176
  - around L211, L233, L242, L260, L305, L329

## 3.8 client/src/pages/profile.tsx
- Purpose of change:
  - Added customer profile completion page.
  - Added experience category selection with Rookie/Veteran options.
  - Saves updated customer state and redirects back to dashboard.
- Hunk references:
  - new file

## 3.9 client/src/pages/home.tsx
- Purpose of change:
  - Added/updated sections including contact block under booking and homepage section updates.
- Hunk references:
  - around L11
  - around L46
  - around L194
  - around L248
  - around L351
  - around L358

## 3.10 server/routes.ts
- Purpose of change:
  - Extended booking API to support multi-slot create (timeSlots array).
  - Added/updated OTP verification/payment routes.
  - Added cancellation guard for verified+paid bookings.
  - Added payment fields in check-in/admin responses.
  - Added customer profile update endpoint.
  - Standardized returned customer payload to include experience category.
- Hunk references (major):
  - around L10, L16, L51, L70, L91
  - around L234, L243, L246, L292, L305, L343, L345
  - around L379, L388, L392, L404, L416, L428, L529
  - around L566, L580, L611, L708, L718, L854

## 3.11 server/storage.ts
- Purpose of change:
  - Added migrations for payment columns.
  - Added/updated storage contract for payment updates.
  - Added markPaymentDone with mode support.
  - Added user profile update support.
  - Added user experience_level persistence.
  - Added booking identity sync after profile updates.
- Hunk references:
  - around L46
  - around L70
  - around L87
  - around L100
  - around L133
  - around L150
  - around L225

## 3.12 shared/schema.ts
- Purpose of change:
  - Added booking fields for payment status/amount/mode.
  - Added user experience_level field.
- Hunk references:
  - around L33

## 4) Non-code Runtime Files Changed

- data/metaracing.db-shm
- data/metaracing.db-wal

These are SQLite runtime state files, not source-code feature edits.

## 5) API/Contract Notes for Future Revisit

### Booking creation
- Endpoint: POST /api/bookings
- New behavior: accepts either one slot or multiple slots.
- Multi-slot input: timeSlots: string[]
- Response:
  - single booking object when one slot selected
  - { bookings: Booking[] } when multiple slots selected

### Admin payment update
- Endpoint: PATCH /api/admin/bookings/:id/payment
- Body:
  - amount: number
  - mode: cash | card | upi

### Customer profile update
- Endpoint: PATCH /api/customers/:id/profile
- Body:
  - name: string
  - email: string
  - phone: string
  - experienceLevel: rookie | veteran
- Response:
  - customer object with updated name, email, phone, and experienceLevel

### Cancel guard
- Endpoint: PATCH /api/admin/bookings/:id/cancel
- Guard:
  - reject cancellation if checkinVerified and paymentStatus=done

## 6) Quick Revision Checklist

- [ ] Verify booking range slider UI on mobile and desktop
- [ ] Verify multi-slot booking response handling in all clients
- [ ] Verify OTP disappears after payment completion in ticket dialog
- [ ] Verify cancel action is locked after verified+paid
- [ ] Verify contact section anchor and content on homepage
- [ ] Verify profile completion page updates dashboard badge and stored customer state

---
Generated in chat session on 2026-04-28.
