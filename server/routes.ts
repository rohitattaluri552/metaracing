import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_EXPERIENCES = ["sim", "fpv", "both"];
const VALID_PLANS = ["starter", "racer", "champion", "squad"];
const MAX_GUESTS_PER_SLOT = 5;
const ALL_TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

function getTimeSlotsForRange(openTime: string, closeTime: string): string[] {
  return ALL_TIME_SLOTS.filter((slot) => slot >= openTime && slot < closeTime);
}

function isDateTodayOrFuture(dateStr: string): boolean {
  const selected = new Date(dateStr);
  if (isNaN(selected.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected >= today;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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
      return res.status(201).json({
        customer: { id: user.id, name: user.name, email: user.email, phone: user.phone },
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
      return res.json({
        customer: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // --- Booking routes ---
  app.post("/api/bookings", async (req, res) => {
    try {
      const { name, phone, experience, plan, date, timeSlot, guests, message, customerId } = req.body;
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!name || !email || !experience || !plan || !date || !timeSlot || !guests) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (!VALID_EXPERIENCES.includes(experience)) {
        return res.status(400).json({ error: "Invalid experience. Must be: sim, fpv, or both" });
      }
      if (!VALID_PLANS.includes(plan)) {
        return res.status(400).json({ error: "Invalid plan. Must be: starter, racer, champion, or squad" });
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
      const validSlots = getTimeSlotsForRange(openTime, closeTime);
      if (!validSlots.includes(timeSlot)) {
        return res.status(400).json({ error: "This time slot is not available for the selected date" });
      }
      if (blockedSlots.includes(timeSlot)) {
        return res.status(409).json({ error: "This time slot is blocked" });
      }
      const guestsNum = Number(guests);
      if (isNaN(guestsNum) || guestsNum < 1 || guestsNum > maxGuests) {
        return res.status(400).json({ error: `Guests must be between 1 and ${maxGuests}` });
      }
      // Check slot capacity
      const currentGuests = await storage.getSlotGuestCount(date, timeSlot);
      if (currentGuests + guestsNum > maxGuests) {
        const remaining = maxGuests - currentGuests;
        return res.status(409).json({
          error: remaining <= 0
            ? "This time slot is fully booked"
            : `Only ${remaining} spot(s) left in this slot`,
        });
      }
      const booking = await storage.createBooking({
        name, email, phone: phone || "", experience, plan, date, timeSlot,
        guests: String(guests),
        message: message || "",
        status: "confirmed",
        customerId: customerId ? Number(customerId) : null,
      });
      return res.status(201).json(booking);
    } catch (err) {
      console.error("Booking error:", err);
      return res.status(500).json({ error: "Failed to create booking" });
    }
  });

  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await storage.getBookings();
      return res.json(bookings);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch bookings" });
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
      const activeSlots = getTimeSlotsForRange(openTime, closeTime);
      const booked = await storage.getSlotAvailability(date);
      const bookedMap: Record<string, number> = {};
      for (const row of booked) {
        bookedMap[row.slot] = row.bookedGuests;
      }
      const slots = activeSlots.map((slot) => {
        const blocked = blockedSlots.includes(slot);
        const used = bookedMap[slot] || 0;
        return {
          time: slot,
          bookedGuests: used,
          availableSpots: blocked ? 0 : Math.max(0, maxGuests - used),
          full: blocked || used >= maxGuests,
          blocked,
          maxGuests,
        };
      });
      return res.json({ date, closed: false, slots });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch slot availability" });
    }
  });

  // --- Customer bookings ---
  app.get("/api/customers/:id/bookings", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }
      const bookings = await storage.getBookingsByCustomer(id);
      return res.json(bookings);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch customer bookings" });
    }
  });

  // --- Admin ---
  const ADMIN_EMAIL = "admin@metaracing.in";
  const ADMIN_PASSWORD = "MetaRacing@2026";

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
      return res.json({ admin: { email: ADMIN_EMAIL, role: "admin" } });
    } catch (err) {
      return res.status(500).json({ error: "Admin login failed" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }

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
        recentBookings: allBookings.slice(-10).reverse(),
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      return res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // Admin: slot details for a given date
  app.get("/api/admin/slots", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
          .map((b) => ({ id: b.id, name: b.name, email: b.email, guests: b.guests }));
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
  app.post("/api/admin/bookings", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      if (!ALL_TIME_SLOTS.includes(timeSlot)) {
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
  app.patch("/api/admin/bookings/:id/cancel", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
      const cancelled = await storage.cancelBooking(id);
      return res.json(cancelled);
    } catch (err) {
      return res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // Admin: schedule overrides CRUD
  app.get("/api/admin/schedule/:date", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const override = await storage.getScheduleOverride(req.params.date);
      return res.json({ override: override || null });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.put("/api/admin/schedule", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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

  app.delete("/api/admin/schedule/:date", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.deleteScheduleOverride(req.params.date);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // Admin: search & filter bookings
  app.get("/api/admin/bookings", async (req, res) => {
    try {
      const adminEmail = req.headers["x-admin-email"];
      if (adminEmail !== ADMIN_EMAIL) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
