# Backend Security and Auth Checklist (MetaRacing)

Date: 2026-04-28

This is the backend implementation checklist for production-grade security.

## Phase 1 Status (Implemented Now)

- [x] JWT-based auth issued for:
	- customer register/login/OTP verify
	- admin login
- [x] Route protection middleware added:
	- customer routes require customer JWT
	- admin routes require admin JWT
- [x] Authorization tightened:
	- customer ownership enforced on profile/bookings/check-in routes
	- admin header trust (`x-admin-email`) removed
	- booking identity mismatch checks added for authenticated customers
- [x] Basic security middleware enabled:
	- `helmet`
	- `cors`
- [x] Frontend API auth wiring:
	- customer/admin bearer token storage and propagation
	- admin dashboard migrated to bearer token requests

## Remaining Items (To Do)

- [ ] Add login/OTP rate limits and brute-force controls
- [ ] Add OTP retry caps and abuse throttling
- [ ] Add refresh token rotation / revocation strategy
- [ ] Tighten CORS to explicit allowlist (replace permissive config)
- [ ] Add route-level schema validation for all critical APIs
- [ ] Add CSRF strategy if moving to cookie-based auth
- [ ] Add audit logging for admin security-sensitive actions
- [ ] Add idempotency keys for booking/payment mutation endpoints
- [ ] Add auth/authz and abuse-focused automated tests

## 1. Authentication Foundation

1. Decide auth model: `JWT` (short-lived access + refresh) or `server sessions` (httpOnly cookie).
2. Remove client-trusted identity patterns (no direct trust on `customerId` from body/path).
3. Add centralized auth middleware to verify identity for protected routes.
4. Add role-aware middleware (`customer`, `admin`) and apply per route.
5. Ensure all auth failures return consistent `401/403` responses.

## 2. JWT / Session Hardening

1. If using JWT: use signed tokens with strong secret/keys and algorithm pinning.
2. If using JWT: implement refresh token rotation and revocation on logout.
3. If using JWT: include minimal claims only (`sub`, `role`, `exp`, `iat`, `jti`).
4. If using sessions: store session IDs in secure cookies (`httpOnly`, `secure`, `sameSite`).
5. Set strict token/session TTL policies and idle timeout.

## 3. Password and Login Security

1. Keep bcrypt with strong cost factor; periodically revisit cost settings.
2. Add login rate-limiting per IP and per account identifier.
3. Add account lockout or progressive delay after repeated failures.
4. Add optional email/phone verification before high-risk actions.
5. Add password reset flow with one-time expiring tokens.

## 4. OTP Security

1. Rate-limit OTP send and verify endpoints.
2. Add retry limits per OTP session and per phone.
3. Store hashed OTP values server-side (not raw OTP in memory).
4. Add stricter OTP expiry and single-use enforcement.
5. Add anti-abuse checks for repeated OTP requests.

## 5. API Authorization Rules

1. Protect all customer endpoints with auth middleware.
2. Enforce ownership checks server-side using authenticated user id only.
3. Protect all admin endpoints with real admin auth, not custom header checks.
4. Remove `x-admin-email` trust model and replace with signed identity.
5. Add explicit authorization tests for each protected route.

## 6. Input Validation and Sanitization

1. Validate request bodies using schema validation at route boundaries.
2. Validate and normalize query/path params consistently.
3. Reject unknown/unexpected fields for sensitive routes.
4. Sanitize strings used in logs or UI echoes.
5. Return safe, non-sensitive error messages in production.

## 7. Transport and HTTP Security

1. Enforce HTTPS in production.
2. Add `helmet` security headers.
3. Configure strict CORS (allowlist known origins only).
4. Add CSRF protection if cookie-based auth is used.
5. Set secure cache headers for auth-related responses.

## 8. Data Protection and Privacy

1. Minimize sensitive data in responses.
2. Never log plaintext passwords, OTPs, or tokens.
3. Encrypt secrets at rest and load via environment variables.
4. Add data retention and cleanup policy for OTP/session artifacts.
5. Add audit logs for admin actions (verify, payment, cancel, schedule changes).

## 9. Booking and Payment Integrity

1. Tie booking creation to authenticated identity where applicable.
2. Validate payment method state transitions server-side.
3. Add idempotency key handling for booking/payment actions.
4. Add server-side checks for race conditions on slot booking.
5. Add tamper-safe event trail for booking status updates.

## 10. Operational Controls

1. Add global request rate-limiter and burst controls.
2. Add structured logging with request IDs.
3. Add monitoring and alerting for auth failures and abuse patterns.
4. Add dependency audit checks in CI.
5. Add security-focused tests in CI (authz, rate limits, token expiry).

## 11. Immediate Priority Order (Recommended)

1. Replace admin header auth with real auth middleware.
2. Protect customer routes with authenticated identity checks.
3. Add route-level validation schemas and consistent error handling.
4. Add login/OTP rate limiting and brute-force protection.
5. Implement JWT/session model with secure cookie or token policy.

## 12. Done Definition (Backend Security Milestone)

1. No protected route can be accessed without verified identity.
2. No user can access or mutate another user’s data by changing IDs.
3. Admin routes require verified admin role from trusted auth context.
4. OTP and login endpoints are abuse-resistant under repeated attempts.
5. Security tests for auth/authz pass in CI and are documented.
