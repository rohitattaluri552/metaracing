import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, gte, sql, like, or } from "drizzle-orm";
import {
  users,
  bookings,
  scheduleOverrides,
  pricing,
  offers,
  type User,
  type InsertUser,
  type Booking,
  type InsertBooking,
  type ScheduleOverride,
  type InsertScheduleOverride,
  type Pricing,
  type InsertPricing,
  type Offer,
  type InsertOffer,
} from "@shared/schema";
import path from "path";
import fs from "fs";

import {
  insertResourceSchema,
  resources,
  type Resource,
  type InsertResource,
} from "@shared/schema";


// Ensure data directory exists
const dataDir = path.resolve("data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(path.join(dataDir, "metaracing.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    experience_level TEXT NOT NULL DEFAULT 'rookie',
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    experience TEXT NOT NULL,
    plan TEXT NOT NULL,
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL DEFAULT '',
    guests TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'confirmed',
    checkin_verified INTEGER NOT NULL DEFAULT 0,
    customer_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS schedule_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    closed INTEGER NOT NULL DEFAULT 0,
    open_time TEXT DEFAULT '09:00',
    close_time TEXT DEFAULT '21:00',
    max_guests_per_slot INTEGER DEFAULT 5,
    blocked_slots TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- sim | vr | rc
    status TEXT NOT NULL DEFAULT 'active', -- active | maintenance | inactive
    max_people INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experience_type TEXT NOT NULL,
    resource_category TEXT,
    duration_minutes INTEGER NOT NULL,
    price INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(experience_type, resource_category, duration_minutes)
  );
  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL,
    discount_value INTEGER NOT NULL,
    experience_type TEXT NOT NULL,
    resource_category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    start_date TEXT,
    end_date TEXT,
    marketing_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate: add missing columns to existing tables
function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c: any) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing("bookings", "status", "TEXT NOT NULL DEFAULT 'confirmed'");
addColumnIfMissing("bookings", "checkin_verified", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("bookings", "payment_status", "TEXT NOT NULL DEFAULT 'pending'");
addColumnIfMissing("bookings", "payment_amount", "INTEGER DEFAULT 0");
addColumnIfMissing("bookings", "payment_mode", "TEXT DEFAULT ''");
addColumnIfMissing("bookings", "customer_id", "INTEGER");
addColumnIfMissing("bookings", "time_slot", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("bookings", "resource_id", "INTEGER");
addColumnIfMissing("bookings", "start_time", "TEXT");
addColumnIfMissing("bookings", "end_time", "TEXT");
addColumnIfMissing("bookings", "party_size", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("users", "phone", "TEXT DEFAULT ''");
addColumnIfMissing("users", "experience_level", "TEXT NOT NULL DEFAULT 'rookie'");
addColumnIfMissing("resources", "status", "TEXT NOT NULL DEFAULT 'active'");
addColumnIfMissing("resources", "max_people", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("resources", "display_order", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("resources", "created_at", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("pricing", "resource_category", "TEXT");
addColumnIfMissing("pricing", "duration_minutes", "INTEGER NOT NULL DEFAULT 30");
addColumnIfMissing("pricing", "price", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("pricing", "active", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("pricing", "created_at", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("pricing", "updated_at", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("offers", "discount_type", "TEXT NOT NULL DEFAULT 'percentage'");
addColumnIfMissing("offers", "discount_value", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("offers", "experience_type", "TEXT NOT NULL DEFAULT 'sim'");
addColumnIfMissing("offers", "resource_category", "TEXT");
addColumnIfMissing("offers", "active", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("offers", "start_date", "TEXT");
addColumnIfMissing("offers", "end_date", "TEXT");
addColumnIfMissing("offers", "marketing_text", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("offers", "created_at", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("offers", "updated_at", "TEXT NOT NULL DEFAULT ''");

// Seed only the agreed SIM inventory. Each insert is guarded by its stable name
// so startup remains idempotent and never modifies existing resource rows.
const simResourceSeeds = [
  { name: "Triple Screen SIM", maxPeople: 3, displayOrder: 1 },
  { name: "Single Screen SIM 1", maxPeople: 2, displayOrder: 2 },
  { name: "Single Screen SIM 2", maxPeople: 2, displayOrder: 3 },
  { name: "Single Screen SIM 3", maxPeople: 2, displayOrder: 4 },
];
const vrResourceSeeds = [
  { name: "VR Station 1", maxPeople: 2, displayOrder: 10 },
  { name: "VR Station 2", maxPeople: 2, displayOrder: 11 },
];

const insertResourceIfMissing = sqlite.prepare(`
  INSERT INTO resources (name, type, status, max_people, display_order, created_at)
  SELECT @name, @type, 'active', @maxPeople, @displayOrder, @createdAt
  WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name = @name)
`);

const seedSimResources = sqlite.transaction(() => {
  for (const resource of simResourceSeeds) {
    insertResourceIfMissing.run({ ...resource, type: "sim", createdAt: new Date().toISOString() });
  }
  for (const resource of vrResourceSeeds) {
    insertResourceIfMissing.run({ ...resource, type: "vr", createdAt: new Date().toISOString() });
  }
});
seedSimResources();

const initialPricingSeeds = [
  { experienceType: "sim", resourceCategory: "single_screen", durationMinutes: 30, price: 300 },
  { experienceType: "sim", resourceCategory: "single_screen", durationMinutes: 60, price: 500 },
  { experienceType: "sim", resourceCategory: "triple_screen", durationMinutes: 30, price: 350 },
  { experienceType: "sim", resourceCategory: "triple_screen", durationMinutes: 60, price: 600 },
  { experienceType: "rc", resourceCategory: null, durationMinutes: 20, price: 180 },
  { experienceType: "vr", resourceCategory: null, durationMinutes: 15, price: 180 },
];
const insertPricingIfMissing = sqlite.prepare(`
  INSERT INTO pricing (experience_type, resource_category, duration_minutes, price, active, created_at, updated_at)
  SELECT @experienceType, @resourceCategory, @durationMinutes, @price, 1, @createdAt, @createdAt
  WHERE NOT EXISTS (
    SELECT 1 FROM pricing
    WHERE experience_type = @experienceType
      AND ifnull(resource_category, '') = ifnull(@resourceCategory, '')
      AND duration_minutes = @durationMinutes
  )
`);
const insertLaunchOfferIfMissing = sqlite.prepare(`
  INSERT INTO offers (name, discount_type, discount_value, experience_type, resource_category, active, start_date, end_date, marketing_text, created_at, updated_at)
  SELECT 'Launch Offer', 'percentage', 20, 'sim', NULL, 1, NULL, NULL,
    '20% OFF ON SIM RACING ONLY - LIMITED TIME ONLY', @createdAt, @createdAt
  WHERE NOT EXISTS (SELECT 1 FROM offers WHERE name = 'Launch Offer')
`);
const seedPricingAndOffers = sqlite.transaction(() => {
  const createdAt = new Date().toISOString();
  for (const seed of initialPricingSeeds) {
    insertPricingIfMissing.run({ ...seed, createdAt });
  }
  insertLaunchOfferIfMissing.run({ createdAt });
});
seedPricingAndOffers();

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, data: { name: string; email: string; phone: string; experienceLevel: string }): Promise<User | undefined>;
  syncBookingIdentityForCustomer(customerId: number, data: { name: string; email: string; phone: string }): Promise<void>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  getBookingsByCustomer(customerId: number): Promise<Booking[]>;
  getBookingById(id: number): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<Booking | undefined>;
  expireBooking(id: number): Promise<Booking | undefined>;
  markCheckinVerified(id: number): Promise<Booking | undefined>;
  markPaymentDone(id: number, amount: number, mode: string): Promise<Booking | undefined>;
  // Admin
  getTotalBookings(): Promise<number>;
  getTodayBookings(): Promise<Booking[]>;
  getActiveSlots(): Promise<number>;
  getTotalUsers(): Promise<number>;
  getAdminCustomers(search?: string): Promise<AdminCustomerSummary[]>;
  getAdminCustomerById(id: number): Promise<AdminCustomerSummary | undefined>;
  getAdminBookingsByCustomer(customerId: number): Promise<AdminCustomerBooking[]>;
  // Slot availability
  getSlotGuestCount(date: string, timeSlot: string): Promise<number>;
  getSlotAvailability(date: string): Promise<{ slot: string; bookedGuests: number }[]>;
  // Schedule overrides
  getScheduleOverride(date: string): Promise<ScheduleOverride | undefined>;
  getClosedScheduleDates(): Promise<string[]>;
  upsertScheduleOverride(data: InsertScheduleOverride): Promise<ScheduleOverride>;
  deleteScheduleOverride(date: string): Promise<void>;
  // Search
  searchBookings(query: string, status?: string, page?: number, perPage?: number): Promise<{ bookings: Booking[]; total: number }>;

  // Resources
  getResources(): Promise<Resource[]>;
  getResourceById(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, data: { name: string; type: string; status: string; maxPeople: number; displayOrder: number }): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<void>;
  getPricing(activeOnly?: boolean): Promise<Pricing[]>;
  getPricingById(id: number): Promise<Pricing | undefined>;
  updatePricing(id: number, data: { price?: number; active?: boolean }): Promise<Pricing | undefined>;
  getOffers(activeOnly?: boolean): Promise<Offer[]>;
  getOfferById(id: number): Promise<Offer | undefined>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOffer(id: number, data: Partial<InsertOffer>): Promise<Offer | undefined>;
    getAvailableResources(
    type: string,
    date: string,
    startTime: string,
    endTime: string,
    partySize: number,
  ): Promise<Resource[]>;

  isResourceAvailable(
    resourceId: number,
    date: string,
    startTime: string,
    endTime: string,
    partySize: number,
  ): Promise<boolean>;
  createResourceBooking(
    type: string,
    booking: Omit<InsertBooking, "resourceId" | "startTime" | "endTime" | "partySize"> & {
      startTime: string;
      endTime: string;
      partySize: number;
    },
    resourceId?: number,
  ): Promise<Booking | undefined>;
}

export interface AdminCustomerSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  experienceLevel: string;
  createdAt: string;
  totalBookings: number;
  lastBookingDate: string | null;
}

export interface AdminCustomerBooking extends Booking {
  resourceName: string | null;
}

export class SqliteStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = db.select().from(users).where(eq(users.email, email)).all();
    return results[0];
  }

  async getUserById(id: number): Promise<User | undefined> {
    const results = db.select().from(users).where(eq(users.id, id)).all();
    return results[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const results = db.insert(users).values(user).returning().all();
    return results[0];
  }

  async updateUserProfile(id: number, data: { name: string; email: string; phone: string; experienceLevel: string }): Promise<User | undefined> {
    const results = db
      .update(users)
      .set({ name: data.name, email: data.email, phone: data.phone, experienceLevel: data.experienceLevel })
      .where(eq(users.id, id))
      .returning()
      .all();
    return results[0];
  }

  async syncBookingIdentityForCustomer(customerId: number, data: { name: string; email: string; phone: string }): Promise<void> {
    db
      .update(bookings)
      .set({ name: data.name, email: data.email, phone: data.phone })
      .where(eq(bookings.customerId, customerId))
      .run();
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const results = db.insert(bookings).values(booking).returning().all();
    return results[0];
  }

  async getBookings(): Promise<Booking[]> {
    return db.select().from(bookings).all();
  }

  async getBookingsByCustomer(customerId: number): Promise<Booking[]> {
    return db
      .select()
      .from(bookings)
      .where(and(eq(bookings.customerId, customerId), eq(bookings.status, "confirmed")))
      .all();
  }

  async getBookingById(id: number): Promise<Booking | undefined> {
    const results = db.select().from(bookings).where(eq(bookings.id, id)).all();
    return results[0];
  }

  async cancelBooking(id: number): Promise<Booking | undefined> {
    const results = db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id)).returning().all();
    return results[0];
  }

  async expireBooking(id: number): Promise<Booking | undefined> {
    const results = db.update(bookings).set({ status: "expired" }).where(eq(bookings.id, id)).returning().all();
    return results[0];
  }

  async markCheckinVerified(id: number): Promise<Booking | undefined> {
    const results = db
      .update(bookings)
      .set({ checkinVerified: true })
      .where(eq(bookings.id, id))
      .returning()
      .all();
    return results[0];
  }

  async markPaymentDone(id: number, amount: number, mode: string): Promise<Booking | undefined> {
    const results = db
      .update(bookings)
      .set({ paymentStatus: "done", paymentAmount: amount, paymentMode: mode })
      .where(eq(bookings.id, id))
      .returning()
      .all();
    return results[0];
  }

  async getTotalBookings(): Promise<number> {
    const result = db.select({ count: sql<number>`count(*)` }).from(bookings).all();
    return result[0]?.count ?? 0;
  }

  async getTodayBookings(): Promise<Booking[]> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return db.select().from(bookings).where(eq(bookings.date, today)).all();
  }

  async getActiveSlots(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const result = db.select({ count: sql<number>`count(*)` }).from(bookings)
      .where(and(eq(bookings.date, today), eq(bookings.status, "confirmed")))
      .all();
    return result[0]?.count ?? 0;
  }

  async getTotalUsers(): Promise<number> {
    const result = db.select({ count: sql<number>`count(*)` }).from(users).all();
    return result[0]?.count ?? 0;
  }

  async getAdminCustomers(search = ""): Promise<AdminCustomerSummary[]> {
    const customerRows = db.select().from(users).all();
    const bookingRows = db.select().from(bookings).all();
    const normalizedSearch = search.trim().toLowerCase();

    return customerRows
      .filter((customer) => !normalizedSearch
        || customer.name.toLowerCase().includes(normalizedSearch)
        || customer.email.toLowerCase().includes(normalizedSearch)
        || (customer.phone || "").toLowerCase().includes(normalizedSearch))
      .map((customer) => {
        const customerBookings = bookingRows.filter((booking) => booking.customerId === customer.id);
        const newestBooking = [...customerBookings].sort((a, b) => this.compareBookingRecency(a, b))[0];
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "",
          experienceLevel: customer.experienceLevel || "rookie",
          createdAt: customer.createdAt,
          totalBookings: customerBookings.length,
          lastBookingDate: newestBooking?.date || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAdminCustomerById(id: number): Promise<AdminCustomerSummary | undefined> {
    const customers = await this.getAdminCustomers();
    return customers.find((customer) => customer.id === id);
  }

  async getAdminBookingsByCustomer(customerId: number): Promise<AdminCustomerBooking[]> {
    const resourceRows = db.select().from(resources).all();
    return db
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, customerId))
      .all()
      .map((booking) => ({
        ...booking,
        resourceName: resourceRows.find((resource) => resource.id === booking.resourceId)?.name || null,
      }))
      .sort((a, b) => this.compareBookingRecency(a, b));
  }

  private compareBookingRecency(a: Booking, b: Booking): number {
    const aValue = `${a.date}T${a.startTime || a.timeSlot || "00:00"}`;
    const bValue = `${b.date}T${b.startTime || b.timeSlot || "00:00"}`;
    return bValue.localeCompare(aValue) || b.createdAt.localeCompare(a.createdAt);
  }

  async getSlotGuestCount(date: string, timeSlot: string): Promise<number> {
    const result = db
      .select({ total: sql<number>`coalesce(sum(cast(guests as integer)), 0)` })
      .from(bookings)
      .where(and(eq(bookings.date, date), eq(bookings.timeSlot, timeSlot), eq(bookings.status, "confirmed")))
      .all();
    return result[0]?.total ?? 0;
  }

  async getSlotAvailability(date: string): Promise<{ slot: string; bookedGuests: number }[]> {
    const rows = db
      .select({
        slot: bookings.timeSlot,
        bookedGuests: sql<number>`coalesce(sum(cast(guests as integer)), 0)`,
      })
      .from(bookings)
      .where(and(eq(bookings.date, date), eq(bookings.status, "confirmed")))
      .groupBy(bookings.timeSlot)
      .all();
    return rows;
  }

  async getScheduleOverride(date: string): Promise<ScheduleOverride | undefined> {
    const results = db.select().from(scheduleOverrides).where(eq(scheduleOverrides.date, date)).all();
    return results[0];
  }

  async getClosedScheduleDates(): Promise<string[]> {
    return db
      .select({ date: scheduleOverrides.date })
      .from(scheduleOverrides)
      .where(eq(scheduleOverrides.closed, true))
      .all()
      .map((row) => row.date);
  }

  async upsertScheduleOverride(data: InsertScheduleOverride): Promise<ScheduleOverride> {
    // Try update first
    const existing = await this.getScheduleOverride(data.date!);
    if (existing) {
      const results = db.update(scheduleOverrides).set(data).where(eq(scheduleOverrides.date, data.date!)).returning().all();
      return results[0];
    }
    const results = db.insert(scheduleOverrides).values(data).returning().all();
    return results[0];
  }

  async deleteScheduleOverride(date: string): Promise<void> {
    db.delete(scheduleOverrides).where(eq(scheduleOverrides.date, date)).run();
  }

  async searchBookings(query: string, status?: string, page = 1, perPage = 20): Promise<{ bookings: Booking[]; total: number }> {
    let allResults: Booking[];
    if (query) {
      const q = `%${query}%`;
      allResults = db.select().from(bookings)
        .where(or(like(bookings.name, q), like(bookings.email, q), like(bookings.date, q)))
        .all();
    } else {
      allResults = db.select().from(bookings).all();
    }
    if (status && status !== "all") {
      allResults = allResults.filter((b) => b.status === status);
    }
    const total = allResults.length;
    const start = (page - 1) * perPage;
    const paginated = allResults.reverse().slice(start, start + perPage);
    return { bookings: paginated, total };}

  async getResources(): Promise<Resource[]> {
    return db
      .select()
      .from(resources)
      .orderBy(resources.displayOrder)
      .all();
  }

  async getResourceById(id: number): Promise<Resource | undefined> {
    const results = db
      .select()
      .from(resources)
      .where(eq(resources.id, id))
      .all();

    return results[0];
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const results = db
      .insert(resources)
      .values(resource)
      .returning()
      .all();

    return results[0];
  }

  async updateResource(
    id: number,
    updates: Partial<InsertResource>,
  ): Promise<Resource | undefined> {
    const results = db
      .update(resources)
      .set(updates)
      .where(eq(resources.id, id))
      .returning()
      .all();

    return results[0];
  }

  async deleteResource(id: number): Promise<void> {
    db
      .delete(resources)
      .where(eq(resources.id, id))
      .run();
  }

  async getPricing(activeOnly = false): Promise<Pricing[]> {
    const query = db.select().from(pricing);
    return activeOnly
      ? query.where(eq(pricing.active, true)).all()
      : query.all();
  }

  async getPricingById(id: number): Promise<Pricing | undefined> {
    return db.select().from(pricing).where(eq(pricing.id, id)).all()[0];
  }

  async updatePricing(id: number, data: { price?: number; active?: boolean }): Promise<Pricing | undefined> {
    return db
      .update(pricing)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(pricing.id, id))
      .returning()
      .all()[0];
  }

  async getOffers(activeOnly = false): Promise<Offer[]> {
    const query = db.select().from(offers);
    return activeOnly
      ? query.where(eq(offers.active, true)).all()
      : query.all();
  }

  async getOfferById(id: number): Promise<Offer | undefined> {
    return db.select().from(offers).where(eq(offers.id, id)).all()[0];
  }

  async createOffer(offer: InsertOffer): Promise<Offer> {
    return db.insert(offers).values({ ...offer, updatedAt: new Date().toISOString() }).returning().all()[0];
  }

  async updateOffer(id: number, data: Partial<InsertOffer>): Promise<Offer | undefined> {
    return db
      .update(offers)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(offers.id, id))
      .returning()
      .all()[0];
  }

    async getAvailableResources(
    type: string,
    date: string,
    startTime: string,
    endTime: string,
    partySize: number,
  ): Promise<Resource[]> {
    const activeResources = db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.type, type),
          eq(resources.status, "active"),
        ),
      )
      .orderBy(resources.displayOrder)
      .all()
      .filter((resource) => resource.maxPeople >= partySize);

    return activeResources.filter((resource) => {
      const conflictingBooking = db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.resourceId, resource.id),
            eq(bookings.date, date),
            eq(bookings.status, "confirmed"),
            sql`${bookings.startTime} IS NOT NULL`,
            sql`${bookings.endTime} IS NOT NULL`,
            sql`${bookings.startTime} < ${endTime}`,
            sql`${bookings.endTime} > ${startTime}`,
          ),
        )
        .get();

      return !conflictingBooking;
    });

  }
  async isResourceAvailable(
    resourceId: number,
    date: string,
    startTime: string,
    endTime: string,
    partySize: number,
  ): Promise<boolean> {
    const resource = await this.getResourceById(resourceId);

    if (!resource) {
      return false;
    }

    if (resource.status !== "active") {
      return false;
    }

    if (partySize < 1 || partySize > resource.maxPeople) {
      return false;
    }

    const conflictingBooking = db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.resourceId, resourceId),
          eq(bookings.date, date),
          eq(bookings.status, "confirmed"),
          sql`${bookings.startTime} IS NOT NULL`,
          sql`${bookings.endTime} IS NOT NULL`,
          sql`${bookings.startTime} < ${endTime}`,
          sql`${bookings.endTime} > ${startTime}`,
        ),
      )
      .get();

    return !conflictingBooking;
  }

  async createResourceBooking(
    type: string,
    booking: Omit<InsertBooking, "resourceId" | "startTime" | "endTime" | "partySize"> & {
      startTime: string;
      endTime: string;
      partySize: number;
    },
    resourceId?: number,
  ): Promise<Booking | undefined> {
    // Acquire the SQLite write lock before selecting a resource, so a concurrent
    // resource booking cannot be inserted between this conflict check and insert.
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      let candidates = db
        .select()
        .from(resources)
        .where(and(
          eq(resources.type, type),
          eq(resources.status, "active"),
          gte(resources.maxPeople, booking.partySize),
        ))
        .orderBy(resources.displayOrder)
        .all();
      if (resourceId !== undefined) {
        candidates = candidates.filter((resource) => resource.id === resourceId);
      }

      for (const resource of candidates) {
        const conflict = db
          .select({ id: bookings.id })
          .from(bookings)
          .where(and(
            eq(bookings.resourceId, resource.id),
            eq(bookings.date, booking.date),
            eq(bookings.status, "confirmed"),
            sql`${bookings.startTime} IS NOT NULL`,
            sql`${bookings.endTime} IS NOT NULL`,
            sql`${bookings.startTime} < ${booking.endTime}`,
            sql`${bookings.endTime} > ${booking.startTime}`,
          ))
          .get();

        if (!conflict) {
          const created = db
            .insert(bookings)
            .values({ ...booking, resourceId: resource.id })
            .returning()
            .all()[0];
          sqlite.exec("COMMIT");
          return created;
        }
      }

      sqlite.exec("COMMIT");
      return undefined;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

export const storage = new SqliteStorage();
