import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_EXPERIENCE_LEVELS = ["rookie", "veteran"];
const VALID_EXPERIENCES = ["sim", "fpv", "both"];
const VALID_PLANS = ["starter", "racer", "squad", "tournament", "champion"];
const VALID_RESOURCE_TYPES = ["sim", "vr", "rc"];
const VALID_RESOURCE_STATUSES = ["active", "maintenance", "inactive"];
const VALID_PRICING_CATEGORIES = ["single_screen", "triple_screen"];
const VALID_DISCOUNT_TYPES = ["percentage", "fixed"];
const MAX_GUESTS_PER_SLOT = 5;
const PUBLIC_SLOT_LOCKS_AFTER_FIRST_BOOKING = true;
const SLOT_INTERVAL_MINUTES = 30;
const MIN_BOOKING_BLOCKS = 1;
const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_EXPIRES_IN = "12h";

const RIGS = [
  { id: "rig-1", name: "3 Screen Monitor Rig 1" },
  { id: "rig-2", name: "3 Screen Monitor Rig 2" },
  { id: "rig-3", name: "Single Screen Monitor Rig 1" },
  { id: "rig-4", name: "Single Screen Monitor Rig 2" },
  { id: "rig-5", name: "Single Screen Monitor Rig 3" },
  { id: "rig-6", name: "Single Screen Monitor Rig 4" },
];

type OtpSession = {
  name: string;
  phone: string;
  otp: string;
  expiresAt: number;
};

const otpSessions = new Map<string, OtpSession>();
const verifiedOtpTokens = new Map<string, { name: string; phone: string; expiresAt: number }>();

type AuthRole = "customer" | "admin";
type AuthTokenPayload = {
  sub: number;
  role: AuthRole;
  email: string;
  name: string;
};

type AuthenticatedRequest = Request & { auth?: AuthTokenPayload };

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function createToken(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function getOtpLoginEmail(phone: string): string {
  return `${phone}@otp.metaracing.local`;
}

function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown;
    if (!decoded || typeof decoded !== "object") return null;
    const payload = decoded as Partial<AuthTokenPayload>;
    if (typeof payload.sub !== "number") return null;
    if (payload.role !== "customer" && payload.role !== "admin") return null;
    if (typeof payload.email !== "string" || typeof payload.name !== "string") return null;
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}

function parseTimeToMinutes(time: string): number | null {
  const [h, m] = time.split(":").map((v) => Number(v));
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isValidBookingDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isValidResourceBookingTime(time: string): boolean {
  return /^\d{2}:\d{2}$/.test(time) && parseTimeToMinutes(time) !== null;
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isHalfHourSlot(time: string): boolean {
  const mins = parseTimeToMinutes(time);
  return mins !== null && mins % SLOT_INTERVAL_MINUTES === 0;
}

function serializeCustomer(user: { id: number; name: string; email: string; phone: string | null; experienceLevel: string | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    experienceLevel: user.experienceLevel || "rookie",
  };
}

function getTimeSlotsForRange(openTime: string, closeTime: string): string[] {
  const openMins = parseTimeToMinutes(openTime);
  const closeMins = parseTimeToMinutes(closeTime);
  if (openMins === null || closeMins === null || openMins >= closeMins) return [];
  const slots: string[] = [];
  for (let t = openMins; t < closeMins; t += SLOT_INTERVAL_MINUTES) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

function getBookableSlotsForDate(dateStr: string, openTime: string, closeTime: string): string[] {
  const slots = getTimeSlotsForRange(openTime, closeTime);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr !== todayStr) return slots;
  return slots.filter((slot) => {
    const slotStart = parseSlotStart(dateStr, slot);
    return slotStart ? slotStart.getTime() > now.getTime() : false;
  });
}

function isDateTodayOrFuture(dateStr: string): boolean {
  const selected = new Date(dateStr);
  if (isNaN(selected.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected >= today;
}

function parseOfferInput(input: any): { value: any } | { error: string } {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const discountType = typeof input?.discountType === "string" ? input.discountType.trim().toLowerCase() : "";
  const discountValue = Number(input?.discountValue);
  const experienceType = typeof input?.experienceType === "string" ? input.experienceType.trim().toLowerCase() : "";
  const resourceCategory = input?.resourceCategory ? String(input.resourceCategory).trim().toLowerCase() : null;
  const active = input?.active === undefined ? true : input.active;
  const startDate = input?.startDate ? String(input.startDate).trim() : null;
  const endDate = input?.endDate ? String(input.endDate).trim() : null;
  const marketingText = typeof input?.marketingText === "string" ? input.marketingText.trim() : "";

  if (!name) return { error: "Offer name is required" };
  if (!VALID_DISCOUNT_TYPES.includes(discountType)) {
    return { error: "Discount type must be percentage or fixed" };
  }
  if (!Number.isInteger(discountValue) || discountValue <= 0
    || (discountType === "percentage" && discountValue > 100)) {
    return { error: "Discount value must be a positive amount (percentage max 100)" };
  }
  if (!VALID_RESOURCE_TYPES.includes(experienceType)) {
    return { error: "Experience type must be sim, vr, or rc" };
  }
  if (resourceCategory !== null && !VALID_PRICING_CATEGORIES.includes(resourceCategory)) {
    return { error: "Resource category must be single_screen or triple_screen" };
  }
  if (active !== true && active !== false) return { error: "Active must be true or false" };
  if (startDate && !isValidBookingDate(startDate)) return { error: "Start date must be YYYY-MM-DD" };
  if (endDate && !isValidBookingDate(endDate)) return { error: "End date must be YYYY-MM-DD" };
  if (startDate && endDate && startDate > endDate) return { error: "Start date must be before end date" };

  return {
    value: {
      name,
      discountType,
      discountValue,
      experienceType,
      resourceCategory,
      active,
      startDate,
      endDate,
      marketingText,
    },
  };
}

async function validateResourceSchedule(date: string, startMinutes: number, endMinutes: number): Promise<string | null> {
  const override = await storage.getScheduleOverride(date);
  if (override?.closed) return "The selected date is closed";

  const openMinutes = parseTimeToMinutes(override?.openTime || "09:00");
  const closeMinutes = parseTimeToMinutes(override?.closeTime || "21:00");
  if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes
    || startMinutes < openMinutes || endMinutes > closeMinutes) {
    return "The requested time is outside venue operating hours";
  }
  return null;
}

function parseSlotStart(dateStr: string, timeSlot: string): Date | null {
  const [h, m] = timeSlot.split(":").map((v) => Number(v));
  const parts = dateStr.split("-").map((v) => Number(v));
  if (parts.length !== 3 || isNaN(h) || isNaN(m)) return null;
  const [year, month, day] = parts;
  const slotStart = new Date(year, month - 1, day, h, m, 0, 0);
  if (isNaN(slotStart.getTime())) return null;
  return slotStart;
}

function generateCheckinOtp(bookingId: number, date: string, timeSlot: string): string {
  const seed = `${bookingId}:${date}:${timeSlot}:metaracing-checkin`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const otpNum = (Math.abs(hash) % 900000) + 100000;
  return String(otpNum);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const expireUnverifiedPastBookings = async () => {
    const allBookings = await storage.getBookings();
    const now = new Date();
    for (const booking of allBookings) {
      if (booking.status !== "confirmed" || booking.checkinVerified) continue;
      const slotStart = parseSlotStart(booking.date, booking.timeSlot || "");
      if (!slotStart) continue;
      const slotEnd = new Date(slotStart.getTime() + SLOT_INTERVAL_MINUTES * 60 * 1000);
      if (now > slotEnd) {
        await storage.expireBooking(booking.id);
      }
    }
  };

  const requireAuth = (role?: AuthRole) => {
   return (req: Request, res: Response, next: NextFunction) => {
        const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const decoded = verifyAuthToken(token);
      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      if (role && decoded.role !== role) {
        return res.status(403).json({ error: "Forbidden" });
      }
      (req as AuthenticatedRequest).auth = decoded;
      return next();
    };
  };

  const tryGetAuth = (req: Request): AuthTokenPayload | null => {
    const token = extractBearerToken(req);
    if (!token) return null;
    return verifyAuthToken(token);
  };

  // --- Mock OTP routes ---
  app.post("/api/otp/send", async (req, res) => {
    try {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const phone = cleanPhone(typeof req.body.phone === "string" ? req.body.phone : "");
      if (!name || !phone || phone.length < 10) {
        return res.status(400).json({ error: "Valid name and phone are required" });
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const sessionId = createToken();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      otpSessions.set(sessionId, { name, phone, otp, expiresAt });

      console.log(`[MOCK OTP] phone=${phone} otp=${otp} session=${sessionId}`);

      return res.json({
        sessionId,
        expiresInSeconds: 300,
        mockOtp: otp,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/otp/verify", async (req, res) => {
    try {
      const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : "";
      const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";
      const session = otpSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: "OTP session not found" });
      }
      if (Date.now() > session.expiresAt) {
        otpSessions.delete(sessionId);
        return res.status(410).json({ error: "OTP expired" });
      }
      if (session.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      otpSessions.delete(sessionId);
      const otpToken = createToken();
      verifiedOtpTokens.set(otpToken, {
        name: session.name,
        phone: session.phone,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      const placeholderEmail = getOtpLoginEmail(session.phone);
      let user = await storage.getUserByEmail(placeholderEmail);
      if (!user) {
        const hashedPassword = await bcrypt.hash(createToken(), 10);
        user = await storage.createUser({
          name: session.name,
          email: placeholderEmail,
          phone: session.phone,
          password: hashedPassword,
        });
      }

      const token = signAuthToken({
        sub: user.id,
        role: "customer",
        email: user.email,
        name: user.name,
      });

      return res.json({
        otpToken,
        name: session.name,
        phone: session.phone,
        customer: serializeCustomer(user),
        token,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // --- Auth routes ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, phone, password } = req.body;
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ name, email, phone: phone || "", password: hashedPassword });
      const token = signAuthToken({
        sub: user.id,
        role: "customer",
        email: user.email,
        name: user.name,
      });
      return res.status(201).json({
        customer: serializeCustomer(user),
        token,
      });
    } catch (err) {
      console.error("Registration error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { password } = req.body;
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const token = signAuthToken({
        sub: user.id,
        role: "customer",
        email: user.email,
        name: user.name,
      });
      return res.json({
        customer: serializeCustomer(user),
        token,
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  app.patch("/api/customers/:id/profile", requireAuth("customer"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const auth = (req as AuthenticatedRequest).auth;
      if (!auth || auth.sub !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const phone = cleanPhone(typeof req.body.phone === "string" ? req.body.phone : "");
      const experienceLevel = typeof req.body.experienceLevel === "string" ? req.body.experienceLevel.trim().toLowerCase() : "";

      if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }
      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (!VALID_EXPERIENCE_LEVELS.includes(experienceLevel)) {
        return res.status(400).json({ error: "Select your racing experience level" });
      }

      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const emailOwner = await storage.getUserByEmail(email);
      if (emailOwner && emailOwner.id !== id) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const updated = await storage.updateUserProfile(id, { name, email, phone, experienceLevel });
      if (!updated) {
        return res.status(500).json({ error: "Failed to update profile" });
      }
      await storage.syncBookingIdentityForCustomer(id, { name, email, phone });

      return res.json({
        customer: serializeCustomer(updated),
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // --- Booking routes ---
  app.post("/api/bookings", async (req, res) => {
    try {
      const { experience, plan, date, timeSlot, timeSlots, guests, message, customerId, otpToken, paymentMethod } = req.body;
      const resourceType = typeof req.body.resourceType === "string" ? req.body.resourceType.trim().toLowerCase() : "";
      const startTime = typeof req.body.startTime === "string" ? req.body.startTime.trim() : "";
      const endTime = typeof req.body.endTime === "string" ? req.body.endTime.trim() : "";
      const requestedResourceId = req.body.resourceId === undefined ? undefined : Number(req.body.resourceId);
      const hasResourceBookingFields = ["resourceType", "startTime", "endTime", "partySize"]
        .some((field) => req.body[field] !== undefined);
      let name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const rawPhone = typeof req.body.phone === "string" ? req.body.phone : "";
      let phone = cleanPhone(rawPhone);
      const rawEmail = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      let email = rawEmail || `${phone || "guest"}@book.local`;
      if (!experience || !plan || !date || !guests) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      let authenticatedCustomer = undefined;
      const auth = tryGetAuth(req);
      const parsedCustomerId = Number(customerId);
      if (auth && auth.role !== "customer") {
        return res.status(403).json({ error: "Only customer accounts can create public bookings" });
      }
      if (auth?.role === "customer") {
        if (!isNaN(parsedCustomerId) && parsedCustomerId > 0 && parsedCustomerId !== auth.sub) {
          return res.status(403).json({ error: "Customer identity mismatch" });
        }
        authenticatedCustomer = await storage.getUserById(auth.sub);
        if (!authenticatedCustomer) {
          return res.status(401).json({ error: "Invalid authenticated customer" });
        }
      } else if (!isNaN(parsedCustomerId) && parsedCustomerId > 0) {
        authenticatedCustomer = await storage.getUserById(parsedCustomerId);
      }

      if (authenticatedCustomer) {
        // Trust logged-in customer profile and normalize booking identity from server side.
        name = authenticatedCustomer.name;
        phone = cleanPhone(authenticatedCustomer.phone || phone);
        email = authenticatedCustomer.email || email;
      } else {
        if (!name || !phone) {
          return res.status(400).json({ error: "Name and phone are required" });
        }
        const verified = typeof otpToken === "string" ? verifiedOtpTokens.get(otpToken) : undefined;
        if (!verified || Date.now() > verified.expiresAt) {
          return res.status(401).json({ error: "OTP verification required" });
        }
        if (verified.phone !== phone || verified.name.toLowerCase() !== name.toLowerCase()) {
          return res.status(401).json({ error: "OTP details do not match booking details" });
        }
      }

      if (paymentMethod && !["pay_at_venue", "qr"].includes(paymentMethod)) {
        return res.status(400).json({ error: "Payment method must be pay_at_venue or qr" });
      }

      if (hasResourceBookingFields) {
        const partySize = Number(req.body.partySize);
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);

        if (!resourceType || !startTime || !endTime || req.body.partySize === undefined) {
          return res.status(400).json({ error: "resourceType, startTime, endTime, and partySize are required" });
        }
        if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
          return res.status(400).json({ error: "Resource type must be sim, vr, or rc" });
        }
        if (!isValidBookingDate(date) || !isDateTodayOrFuture(date)) {
          return res.status(400).json({ error: "Date must be valid and today or in the future" });
        }
        if (!isValidResourceBookingTime(startTime) || !isValidResourceBookingTime(endTime)
          || startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
          return res.status(400).json({ error: "startTime and endTime must be HH:MM values with startTime before endTime" });
        }
        const scheduleError = await validateResourceSchedule(date, startMinutes, endMinutes);
        if (scheduleError) {
          return res.status(400).json({ error: scheduleError });
        }
        if (!Number.isInteger(partySize) || partySize < 1) {
          return res.status(400).json({ error: "partySize must be an integer of at least 1" });
        }
        if (req.body.resourceId !== undefined
          && (!Number.isInteger(requestedResourceId) || (requestedResourceId as number) < 1)) {
          return res.status(400).json({ error: "resourceId must be a valid resource ID" });
        }
        if (requestedResourceId !== undefined) {
          const requestedResource = await storage.getResourceById(requestedResourceId);
          if (!requestedResource) {
            return res.status(400).json({ error: "resourceId does not identify an existing resource" });
          }
          if (requestedResource.type !== resourceType) {
            return res.status(400).json({ error: "resourceId does not match resourceType" });
          }
        }

        const booking = await storage.createResourceBooking(resourceType, {
          name,
          email,
          phone,
          // These legacy fields remain populated for compatibility with existing
          // booking displays and check-in behavior; availability does not use them.
          experience: typeof experience === "string" && experience.trim() ? experience : resourceType,
          plan: typeof plan === "string" && plan.trim() ? plan : "resource",
          date,
          timeSlot: startTime,
          guests: String(partySize),
          message: message || "Pay at Venue",
          status: "confirmed",
          customerId: authenticatedCustomer ? authenticatedCustomer.id : null,
          startTime,
          endTime,
          partySize,
        }, requestedResourceId);

        if (!booking) {
          return res.status(409).json({ error: "No matching resource is available for this time" });
        }
        if (typeof otpToken === "string") {
          verifiedOtpTokens.delete(otpToken);
        }
        return res.status(201).json(booking);
      }

      if (!VALID_EXPERIENCES.includes(experience)) {
        return res.status(400).json({ error: "Invalid experience. Must be: sim, fpv, or both" });
      }
      if (!VALID_PLANS.includes(plan)) {
        return res.status(400).json({ error: "Invalid plan. Must be: starter, racer, squad, or tournament" });
      }
      if (!isDateTodayOrFuture(date)) {
        return res.status(400).json({ error: "Date must be today or in the future" });
      }
      // Check schedule override
      const override = await storage.getScheduleOverride(date);
      if (override?.closed) {
        return res.status(409).json({ error: "Bookings are closed for this date" });
      }
      const openTime = override?.openTime || "09:00";
      const closeTime = override?.closeTime || "21:00";
      const maxGuests = override?.maxGuestsPerSlot || MAX_GUESTS_PER_SLOT;
      const blockedSlots = override?.blockedSlots ? override.blockedSlots.split(",").map(s => s.trim()) : [];
      const validSlots = getBookableSlotsForDate(date, openTime, closeTime);
      const requestedSlots = Array.isArray(timeSlots)
        ? timeSlots.filter((s: unknown): s is string => typeof s === "string")
        : typeof timeSlot === "string" && timeSlot
          ? [timeSlot]
          : [];
      if (!requestedSlots.length) {
        return res.status(400).json({ error: "At least one time slot is required" });
      }
      const guestsNum = Number(guests);
      if (isNaN(guestsNum) || guestsNum < 1 || guestsNum > maxGuests) {
        return res.status(400).json({ error: `Guests must be between 1 and ${maxGuests}` });
      }

      const uniqueSlots = Array.from(new Set(requestedSlots));
      const slotMinutes = uniqueSlots
        .map((slot) => ({ slot, minutes: parseTimeToMinutes(slot) }))
        .sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
      if (slotMinutes.some((s) => s.minutes === null || !isHalfHourSlot(s.slot))) {
        return res.status(400).json({ error: "Time slots must be in 30-minute format (HH:MM)" });
      }
      if (slotMinutes.length < MIN_BOOKING_BLOCKS) {
        return res.status(400).json({ error: "Duration must be at least 30 minutes" });
      }
      for (let i = 1; i < slotMinutes.length; i++) {
        const prev = slotMinutes[i - 1].minutes as number;
        const curr = slotMinutes[i].minutes as number;
        if (curr - prev !== SLOT_INTERVAL_MINUTES) {
          return res.status(400).json({ error: "Selected slots must be consecutive 30-minute blocks" });
        }
      }

      for (const slot of uniqueSlots) {
        if (!validSlots.includes(slot)) {
          return res.status(400).json({ error: `Time slot ${slot} is not available for booking` });
        }
        if (blockedSlots.includes(slot)) {
          return res.status(409).json({ error: `Time slot ${slot} is blocked` });
        }
        const currentGuests = await storage.getSlotGuestCount(date, slot);
        if (PUBLIC_SLOT_LOCKS_AFTER_FIRST_BOOKING && currentGuests > 0) {
          return res.status(409).json({ error: `Time slot ${slot} is already booked` });
        }
        if (currentGuests + guestsNum > maxGuests) {
          const remaining = maxGuests - currentGuests;
          return res.status(409).json({
            error: remaining <= 0
              ? `Time slot ${slot} is fully booked`
              : `Only ${remaining} spot(s) left in slot ${slot}`,
          });
        }
      }

      const createdBookings = [];
      for (const slot of uniqueSlots) {
        const booking = await storage.createBooking({
          name,
          email,
          phone,
          experience,
          plan,
          date,
          timeSlot: slot,
          guests: String(guests),
          message: message || "Pay at Venue",
          status: "confirmed",
          customerId: authenticatedCustomer ? authenticatedCustomer.id : null,
        });
        createdBookings.push(booking);
      }
      if (typeof otpToken === "string") {
        verifiedOtpTokens.delete(otpToken);
      }
      return res.status(201).json(createdBookings.length === 1 ? createdBookings[0] : { bookings: createdBookings });
    } catch (err) {
      console.error("Booking error:", err);
      return res.status(500).json({ error: "Failed to create booking" });
    }
  });

    app.get("/api/bookings", requireAuth("admin"), async (req, res) => {
      try {
        const bookings = await storage.getBookings();
        return res.json(bookings);
      } catch (err) {
        return res.status(500).json({ error: "Failed to fetch bookings" });
      }
    });

  // --- Resource availability ---
  app.get("/api/resources/available", async (req, res) => {
    try {
      const type = typeof req.query.type === "string" ? req.query.type.trim().toLowerCase() : "";
      const date = typeof req.query.date === "string" ? req.query.date.trim() : "";
      const startTime = typeof req.query.startTime === "string" ? req.query.startTime.trim() : "";
      const endTime = typeof req.query.endTime === "string" ? req.query.endTime.trim() : "";
      const partySize = typeof req.query.partySize === "string" ? Number(req.query.partySize) : Number.NaN;
      const startMinutes = parseTimeToMinutes(startTime);
      const endMinutes = parseTimeToMinutes(endTime);

      if (!VALID_RESOURCE_TYPES.includes(type)) {
        return res.status(400).json({ error: "Resource type must be sim, vr, or rc" });
      }
      if (!isValidBookingDate(date) || !isDateTodayOrFuture(date)) {
        return res.status(400).json({ error: "Date must be valid and today or in the future" });
      }
      if (!isValidResourceBookingTime(startTime) || !isValidResourceBookingTime(endTime)
        || startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        return res.status(400).json({ error: "startTime and endTime must be valid HH:MM values with startTime before endTime" });
      }
      const scheduleError = await validateResourceSchedule(date, startMinutes, endMinutes);
      if (scheduleError) {
        return res.status(400).json({ error: scheduleError });
      }
      if (!Number.isInteger(partySize) || partySize < 1) {
        return res.status(400).json({ error: "partySize must be an integer of at least 1" });
      }

      const resources = await storage.getAvailableResources(type, date, startTime, endTime, partySize);
      return res.json({ resources });
    } catch (err) {
      console.error("Resource availability error:", err);
      return res.status(500).json({ error: "Failed to fetch available resources" });
    }
  });

  // --- Slot availability ---
  app.get("/api/slots", async (req, res) => {
    try {
      const date = typeof req.query.date === "string" ? req.query.date : "";
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Date query param required (YYYY-MM-DD)" });
      }
      const override = await storage.getScheduleOverride(date);
      if (override?.closed) {
        return res.json({ date, closed: true, slots: [] });
      }
      const openTime = override?.openTime || "09:00";
      const closeTime = override?.closeTime || "21:00";
      const maxGuests = override?.maxGuestsPerSlot || MAX_GUESTS_PER_SLOT;
      const blockedSlots = override?.blockedSlots ? override.blockedSlots.split(",").map(s => s.trim()) : [];
      const activeSlots = getBookableSlotsForDate(date, openTime, closeTime);
      const booked = await storage.getSlotAvailability(date);
      const bookedMap: Record<string, number> = {};
      for (const row of booked) {
        bookedMap[row.slot] = row.bookedGuests;
      }
      const slots = activeSlots.map((slot) => {
        const blocked = blockedSlots.includes(slot);
        const used = bookedMap[slot] || 0;
        const publicLocked = PUBLIC_SLOT_LOCKS_AFTER_FIRST_BOOKING && used > 0;
        return {
          time: slot,
          bookedGuests: used,
          availableSpots: blocked || publicLocked ? 0 : Math.max(0, maxGuests - used),
          full: blocked || publicLocked || used >= maxGuests,
          blocked,
          maxGuests,
        };
      });
      return res.json({ date, closed: false, slots });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch slot availability" });
    }
  });

  app.get("/api/schedule/closed-dates", async (_req, res) => {
    try {
      const dates = await storage.getClosedScheduleDates();
      return res.json({ dates });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch closed dates" });
    }
  });

  // --- Customer bookings ---
  app.get("/api/customers/:id/bookings", requireAuth("customer"), async (req, res) => {
    try {
      await expireUnverifiedPastBookings();
      const id = Number(req.params.id);
      const auth = (req as AuthenticatedRequest).auth;
      if (!auth || auth.sub !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }
      const bookings = await storage.getBookingsByCustomer(id);
      return res.json(bookings);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch customer bookings" });
    }
  });

  app.get("/api/customers/:id/bookings/:bookingId/checkin", requireAuth("customer"), async (req, res) => {
    try {
      const customerId = Number(req.params.id);
      const auth = (req as AuthenticatedRequest).auth;
      if (!auth || auth.sub !== customerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const bookingId = Number(req.params.bookingId);
      if (isNaN(customerId) || customerId < 1 || isNaN(bookingId) || bookingId < 1) {
        return res.status(400).json({ error: "Invalid customer or booking ID" });
      }

      const booking = await storage.getBookingById(bookingId);
      if (!booking || booking.customerId !== customerId) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (booking.status !== "confirmed") {
        return res.status(400).json({ error: "Check-in OTP is only available for confirmed bookings" });
      }

      const slotStart = parseSlotStart(booking.date, booking.timeSlot || "");
      if (!slotStart) {
        return res.status(400).json({ error: "Booking slot is invalid" });
      }

      const now = new Date();
      const msUntilSlot = slotStart.getTime() - now.getTime();
      const minutesUntilSlot = Math.ceil(msUntilSlot / 60000);
      const otpVisible = minutesUntilSlot <= 15;

      return res.json({
        bookingId: booking.id,
        otpVisible,
        otp: otpVisible ? generateCheckinOtp(booking.id, booking.date, booking.timeSlot || "") : null,
        minutesUntilSlot,
        paymentDone: booking.paymentStatus === "done",
        paymentAmount: booking.paymentAmount ?? 0,
        paymentMode: booking.paymentMode ?? "",
        arriveEarlyMinutes: 30,
        message: "Please arrive 30 minutes before your slot to complete payment and in-person verification.",
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch check-in details" });
    }
  });

  // --- Rig availability ---
  app.get("/api/rigs", async (req, res) => {
    try {
      const date = typeof req.query.date === "string" ? req.query.date : "";
      const timeSlot = typeof req.query.timeSlot === "string" ? req.query.timeSlot : "";
      if (!date || !timeSlot) {
        return res.status(400).json({ error: "date and timeSlot query params are required" });
      }

      const bookedGuests = await storage.getSlotGuestCount(date, timeSlot);
      const takenCount = Math.max(0, Math.min(RIGS.length, bookedGuests));
      const rigs = RIGS.map((rig, idx) => ({
        ...rig,
        available: idx >= takenCount,
      }));

      return res.json({
        date,
        timeSlot,
        totalRigs: RIGS.length,
        availableRigs: rigs.filter((r) => r.available).length,
        rigs,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch rigs" });
    }
  });

  // --- Public active pricing and offers ---
  app.get("/api/pricing", async (_req, res) => {
    try {
      const [pricing, offers] = await Promise.all([
        storage.getPricing(true),
        storage.getOffers(true),
      ]);
      return res.json({ pricing, offers });
    } catch (err) {
      console.error("Pricing read error:", err);
      return res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  // --- Admin ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Admin credentials are required");
}

  // Plan price map (hourly rate in INR)
  const PLAN_PRICES: Record<string, number> = {
    starter: 449,
    racer: 549,
    champion: 749,
    squad: 499,
    tournament: 999,
  };

  app.post("/api/admin/login", async (req, res) => {
    try {
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const { password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Invalid admin credentials" });
      }
      const token = signAuthToken({
        sub: 1,
        role: "admin",
        email: ADMIN_EMAIL,
        name: "MetaRacing Admin",
      });
      return res.json({ admin: { email: ADMIN_EMAIL, role: "admin" }, token });
    } catch (err) {
      return res.status(500).json({ error: "Admin login failed" });
    }
  });

  app.get("/api/admin/resource-availability", requireAuth("admin"), async (req, res) => {
    try {
      const date = typeof req.query.date === "string" ? req.query.date.trim() : "";
      if (!isValidBookingDate(date)) {
        return res.status(400).json({ error: "Valid date required (YYYY-MM-DD)" });
      }

      const [resources, bookings] = await Promise.all([
        storage.getResources(),
        storage.getBookings(),
      ]);
      const resourceBookings = bookings
        .filter((booking) => booking.date === date && booking.status === "confirmed" && booking.resourceId !== null)
        .map((booking) => ({
          id: booking.id,
          resourceId: booking.resourceId,
          customerName: booking.name,
          partySize: booking.partySize || Number(booking.guests) || 1,
          startTime: booking.startTime || booking.timeSlot || "",
          endTime: booking.endTime || "",
          status: booking.status,
        }));

      return res.json({
        date,
        serverNow: new Date().toISOString(),
        resources,
        bookings: resourceBookings,
      });
    } catch (err) {
      console.error("Resource availability admin error:", err);
      return res.status(500).json({ error: "Failed to fetch resource availability" });
    }
  });

  app.get("/api/admin/resources", requireAuth("admin"), async (_req, res) => {
    try {
      return res.json({ resources: await storage.getResources() });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  app.post("/api/admin/resources", requireAuth("admin"), async (req, res) => {
    try {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const type = typeof req.body?.type === "string" ? req.body.type.trim().toLowerCase() : "";
      const maxPeople = Number(req.body?.maxPeople);
      const requestedDisplayOrder = req.body?.displayOrder === undefined ? undefined : Number(req.body.displayOrder);
      const resources = await storage.getResources();
      const displayOrder = requestedDisplayOrder === undefined
        ? (resources.reduce((max, resource) => Math.max(max, resource.displayOrder), -1) + 1)
        : requestedDisplayOrder;

      if (!name) return res.status(400).json({ error: "Resource name is required" });
      if (!VALID_RESOURCE_TYPES.includes(type)) return res.status(400).json({ error: "Resource type must be sim, vr, or rc" });
      if (!Number.isInteger(maxPeople) || maxPeople < 1) return res.status(400).json({ error: "maxPeople must be a positive integer" });
      if (!Number.isInteger(displayOrder) || displayOrder < 0) return res.status(400).json({ error: "displayOrder must be a non-negative integer" });

      const resource = await storage.createResource({
        name,
        type,
        maxPeople,
        status: "active",
        displayOrder,
      });
      return res.status(201).json(resource);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create resource" });
    }
  });

  app.patch("/api/admin/resources/:id", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid resource ID" });
      const existing = await storage.getResourceById(id);
      if (!existing) return res.status(404).json({ error: "Resource not found" });

      const name = typeof req.body?.name === "string" ? req.body.name.trim() : existing.name;
      const type = typeof req.body?.type === "string" ? req.body.type.trim().toLowerCase() : existing.type;
      const maxPeople = req.body?.maxPeople === undefined ? existing.maxPeople : Number(req.body.maxPeople);
      const status = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : existing.status;
      const displayOrder = req.body?.displayOrder === undefined ? existing.displayOrder : Number(req.body.displayOrder);

      if (!name) return res.status(400).json({ error: "Resource name is required" });
      if (!VALID_RESOURCE_TYPES.includes(type)) return res.status(400).json({ error: "Resource type must be sim, vr, or rc" });
      if (!Number.isInteger(maxPeople) || maxPeople < 1) return res.status(400).json({ error: "maxPeople must be a positive integer" });
      if (!VALID_RESOURCE_STATUSES.includes(status)) return res.status(400).json({ error: "Resource status must be active, maintenance, or inactive" });
      if (!Number.isInteger(displayOrder) || displayOrder < 0) return res.status(400).json({ error: "displayOrder must be a non-negative integer" });

      const updated = await storage.updateResource(id, { name, type, maxPeople, status, displayOrder });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Failed to update resource" });
    }
  });

  app.delete("/api/admin/resources/:id", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid resource ID" });
      const resource = await storage.getResourceById(id);
      if (!resource) return res.status(404).json({ error: "Resource not found" });

      const bookings = await storage.getBookings();
      if (bookings.some((booking) => booking.resourceId === id)) {
        return res.status(409).json({ error: "Resource cannot be deleted because existing bookings reference it" });
      }

      await storage.deleteResource(id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete resource" });
    }
  });

  app.get("/api/admin/pricing", requireAuth("admin"), async (_req, res) => {
    try {
      return res.json({ pricing: await storage.getPricing(false) });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  app.patch("/api/admin/pricing/:id", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const price = req.body?.price === undefined ? undefined : Number(req.body.price);
      const active = req.body?.active === undefined ? undefined : req.body.active;
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: "Invalid pricing ID" });
      }
      if (price !== undefined && (!Number.isInteger(price) || price <= 0)) {
        return res.status(400).json({ error: "Price must be a positive whole number" });
      }
      if (active !== undefined && typeof active !== "boolean") {
        return res.status(400).json({ error: "Active must be true or false" });
      }
      if (price === undefined && active === undefined) {
        return res.status(400).json({ error: "Price or active status is required" });
      }
      const existing = await storage.getPricingById(id);
      if (!existing) return res.status(404).json({ error: "Pricing entry not found" });
      const updated = await storage.updatePricing(id, { price, active });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Failed to update pricing" });
    }
  });

  app.get("/api/admin/offers", requireAuth("admin"), async (_req, res) => {
    try {
      return res.json({ offers: await storage.getOffers(false) });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  app.post("/api/admin/offers", requireAuth("admin"), async (req, res) => {
    try {
      const offer = parseOfferInput(req.body);
      if ("error" in offer) return res.status(400).json({ error: offer.error });
      return res.status(201).json(await storage.createOffer(offer.value));
    } catch (err) {
      return res.status(500).json({ error: "Failed to create offer" });
    }
  });

  app.patch("/api/admin/offers/:id", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: "Invalid offer ID" });
      }
      const existing = await storage.getOfferById(id);
      if (!existing) return res.status(404).json({ error: "Offer not found" });
      const parsed = parseOfferInput({ ...existing, ...req.body });
      if ("error" in parsed) return res.status(400).json({ error: parsed.error });
      const updated = await storage.updateOffer(id, parsed.value);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Failed to update offer" });
    }
  });

  app.get("/api/admin/stats", requireAuth("admin"), async (_req, res) => {
    try {
      await expireUnverifiedPastBookings();

      const totalBookings = await storage.getTotalBookings();
      const activeSlots = await storage.getActiveSlots();
      const todayBookings = await storage.getTodayBookings();
      const totalUsers = await storage.getTotalUsers();
      const allBookings = await storage.getBookings();

      // Calculate today's revenue from confirmed bookings today
      const todayRevenue = todayBookings
        .filter((b) => b.status === "confirmed")
        .reduce((sum, b) => {
          const guests = Number(b.guests) || 1;
          const price = PLAN_PRICES[b.plan] || 0;
          return sum + price * guests;
        }, 0);

      // Calculate total revenue from all confirmed bookings
      const totalRevenue = allBookings
        .filter((b) => b.status === "confirmed")
        .reduce((sum, b) => {
          const guests = Number(b.guests) || 1;
          const price = PLAN_PRICES[b.plan] || 0;
          return sum + price * guests;
        }, 0);

      return res.json({
        totalBookings,
        activeSlots,
        todayBookings: todayBookings.length,
        todayRevenue,
        totalRevenue,
        totalUsers,
        recentBookings: allBookings.slice(-10).reverse().map((b) => ({
          ...b,
          otpVerified: !!b.checkinVerified,
        })),
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      return res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/customers", requireAuth("admin"), async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : "";
      return res.json({ customers: await storage.getAdminCustomers(search) });
    } catch (err) {
      console.error("Admin customers error:", err);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/admin/customers/:id", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid customer ID" });
      const customer = await storage.getAdminCustomerById(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      return res.json({ customer });
    } catch (err) {
      console.error("Admin customer detail error:", err);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.get("/api/admin/customers/:id/bookings", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid customer ID" });
      const customer = await storage.getAdminCustomerById(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      return res.json({ bookings: await storage.getAdminBookingsByCustomer(id) });
    } catch (err) {
      console.error("Admin customer bookings error:", err);
      return res.status(500).json({ error: "Failed to fetch customer bookings" });
    }
  });

  // Admin: slot details for a given date
  app.get("/api/admin/slots", requireAuth("admin"), async (req, res) => {
    try {
      await expireUnverifiedPastBookings();
      const date = typeof req.query.date === "string" ? req.query.date : "";
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Date query param required (YYYY-MM-DD)" });
      }
      const override = await storage.getScheduleOverride(date);
      const openTime = override?.openTime || "09:00";
      const closeTime = override?.closeTime || "21:00";
      const maxGuests = override?.maxGuestsPerSlot || MAX_GUESTS_PER_SLOT;
      const blockedSlots = override?.blockedSlots ? override.blockedSlots.split(",").map(s => s.trim()) : [];
      const activeSlots = getTimeSlotsForRange(openTime, closeTime);
      const booked = await storage.getSlotAvailability(date);
      const bookedMap: Record<string, number> = {};
      for (const row of booked) {
        bookedMap[row.slot] = row.bookedGuests;
      }

      const allBookings = await storage.getBookings();
      const dateBookings = allBookings.filter(
        (b) => b.date === date && b.status === "confirmed"
      );

      const slots = activeSlots.map((slot) => {
        const blocked = blockedSlots.includes(slot);
        const used = bookedMap[slot] || 0;
        const members = dateBookings
          .filter((b) => b.timeSlot === slot)
          .map((b) => {
            const slotStart = parseSlotStart(b.date, b.timeSlot || "");
            const minutesUntilSlot = slotStart
              ? Math.ceil((slotStart.getTime() - Date.now()) / 60000)
              : null;
            const checkinOtpVisible = minutesUntilSlot !== null ? minutesUntilSlot <= 15 : false;
            return {
              id: b.id,
              name: b.name,
              email: b.email,
              phone: b.phone,
              guests: b.guests,
              checkinVerified: !!b.checkinVerified,
              checkinOtpVisible,
              checkinOtp: checkinOtpVisible ? generateCheckinOtp(b.id, b.date, b.timeSlot || "") : null,
              minutesUntilSlot,
              paymentStatus: b.paymentStatus ?? "pending",
              paymentAmount: b.paymentAmount ?? 0,
              paymentMode: b.paymentMode ?? "",
            };
          });
        return {
          time: slot,
          bookedGuests: used,
          availableSpots: blocked ? 0 : Math.max(0, maxGuests - used),
          full: blocked || used >= maxGuests,
          blocked,
          maxGuests,
          members,
        };
      });
      return res.json({ date, closed: !!override?.closed, override: override || null, slots });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch admin slots" });
    }
  });

  // Admin: book ticket (no guest limit per slot)
  app.post("/api/admin/bookings", requireAuth("admin"), async (req, res) => {
    try {
      const { name, phone, experience, plan, date, timeSlot, guests, message } = req.body;
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!name || !email || !experience || !plan || !date || !timeSlot || !guests) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (!VALID_EXPERIENCES.includes(experience)) {
        return res.status(400).json({ error: "Invalid experience" });
      }
      if (!VALID_PLANS.includes(plan)) {
        return res.status(400).json({ error: "Invalid plan" });
      }
      if (!isHalfHourSlot(timeSlot)) {
        return res.status(400).json({ error: "Invalid time slot" });
      }
      const guestsNum = Number(guests);
      if (isNaN(guestsNum) || guestsNum < 1) {
        return res.status(400).json({ error: "Guests must be at least 1" });
      }
      const booking = await storage.createBooking({
        name, email, phone: phone || "", experience, plan, date, timeSlot,
        guests: String(guestsNum),
        message: message || "",
        status: "confirmed",
        customerId: null,
      });
      return res.status(201).json(booking);
    } catch (err) {
      console.error("Admin booking error:", err);
      return res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // Admin: cancel any booking
  app.patch("/api/admin/bookings/:id/cancel", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: "Invalid booking ID" });
      }
      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (booking.status === "cancelled") {
        return res.status(400).json({ error: "Booking is already cancelled" });
      }
      if (booking.checkinVerified && booking.paymentStatus === "done") {
        return res.status(400).json({ error: "Cannot cancel after verification and payment" });
      }
      const cancelled = await storage.cancelBooking(id);
      return res.json(cancelled);
    } catch (err) {
      return res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  app.patch("/api/admin/bookings/:id/verify-checkin", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
      if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: "Invalid booking ID" });
      }
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: "A valid 6-digit OTP is required" });
      }
      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (booking.status !== "confirmed") {
        return res.status(400).json({ error: "Only confirmed bookings can be verified" });
      }
      if (booking.checkinVerified) {
        return res.status(400).json({ error: "OTP already verified for this booking" });
      }

      const slotStart = parseSlotStart(booking.date, booking.timeSlot || "");
      if (!slotStart) {
        return res.status(400).json({ error: "Booking slot is invalid" });
      }
      const minutesUntilSlot = Math.ceil((slotStart.getTime() - Date.now()) / 60000);
      if (minutesUntilSlot > 15) {
        return res.status(400).json({ error: "OTP can only be verified in the last 15 minutes before slot" });
      }

      const expectedOtp = generateCheckinOtp(booking.id, booking.date, booking.timeSlot || "");
      if (otp !== expectedOtp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      const updated = await storage.markCheckinVerified(id);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Failed to verify check-in" });
    }
  });

  app.patch("/api/admin/bookings/:id/payment", requireAuth("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: "Invalid booking ID" });
      }
      const amount = Number(req.body?.amount);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ error: "A valid payment amount is required" });
      }
      const mode = typeof req.body?.mode === "string" ? req.body.mode.trim() : "cash";
      const allowedModes = ["cash", "card", "upi"];
      if (!allowedModes.includes(mode)) {
        return res.status(400).json({ error: "Payment mode must be cash, card, or upi" });
      }
      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (!booking.checkinVerified) {
        return res.status(400).json({ error: "OTP must be verified before marking payment" });
      }
      const updated = await storage.markPaymentDone(id, amount, mode);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Failed to mark payment" });
    }
  });

  // Admin: schedule overrides CRUD
  app.get("/api/admin/schedule/:date", requireAuth("admin"), async (req, res) => {
    try {
      const dateParam = String(req.params.date);
      const override = await storage.getScheduleOverride(dateParam);
      return res.json({ override: override || null });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.put("/api/admin/schedule", requireAuth("admin"), async (req, res) => {
    try {
      const { date, closed, openTime, closeTime, maxGuestsPerSlot, blockedSlots } = req.body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Valid date required (YYYY-MM-DD)" });
      }
      if (openTime && closeTime && openTime >= closeTime) {
        return res.status(400).json({ error: "Open time must be before close time" });
      }
      const override = await storage.upsertScheduleOverride({
        date,
        closed: closed ?? false,
        openTime: openTime || "09:00",
        closeTime: closeTime || "21:00",
        maxGuestsPerSlot: maxGuestsPerSlot ?? 5,
        blockedSlots: blockedSlots || "",
      });
      return res.json(override);
    } catch (err) {
      return res.status(500).json({ error: "Failed to save schedule" });
    }
  });

  app.delete("/api/admin/schedule/:date", requireAuth("admin"), async (req, res) => {
    try {
      const dateParam = String(req.params.date);
      await storage.deleteScheduleOverride(dateParam);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // Admin: search & filter bookings
  app.get("/api/admin/bookings", requireAuth("admin"), async (req, res) => {
    try {
      await expireUnverifiedPastBookings();
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const status = typeof req.query.status === "string" ? req.query.status : "all";
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 20));
      const result = await storage.searchBookings(query, status, page, perPage);
      return res.json({ ...result, page, perPage });
    } catch (err) {
      return res.status(500).json({ error: "Failed to search bookings" });
    }
  });

  return httpServer;
}
