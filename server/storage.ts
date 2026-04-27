import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, gte, sql, like, or } from "drizzle-orm";
import {
  users, bookings, scheduleOverrides,
  type User, type InsertUser,
  type Booking, type InsertBooking,
  type ScheduleOverride, type InsertScheduleOverride,
} from "@shared/schema";
import path from "path";
import fs from "fs";

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
`);

// Migrate: add missing columns to existing tables
function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c: any) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing("bookings", "status", "TEXT NOT NULL DEFAULT 'confirmed'");
addColumnIfMissing("bookings", "customer_id", "INTEGER");
addColumnIfMissing("bookings", "time_slot", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("users", "phone", "TEXT DEFAULT ''");

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  getBookingsByCustomer(customerId: number): Promise<Booking[]>;
  getBookingById(id: number): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<Booking | undefined>;
  // Admin
  getTotalBookings(): Promise<number>;
  getTodayBookings(): Promise<Booking[]>;
  getActiveSlots(): Promise<number>;
  getTotalUsers(): Promise<number>;
  // Slot availability
  getSlotGuestCount(date: string, timeSlot: string): Promise<number>;
  getSlotAvailability(date: string): Promise<{ slot: string; bookedGuests: number }[]>;
  // Schedule overrides
  getScheduleOverride(date: string): Promise<ScheduleOverride | undefined>;
  upsertScheduleOverride(data: InsertScheduleOverride): Promise<ScheduleOverride>;
  deleteScheduleOverride(date: string): Promise<void>;
  // Search
  searchBookings(query: string, status?: string, page?: number, perPage?: number): Promise<{ bookings: Booking[]; total: number }>;
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

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const results = db.insert(bookings).values(booking).returning().all();
    return results[0];
  }

  async getBookings(): Promise<Booking[]> {
    return db.select().from(bookings).all();
  }

  async getBookingsByCustomer(customerId: number): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.customerId, customerId)).all();
  }

  async getBookingById(id: number): Promise<Booking | undefined> {
    const results = db.select().from(bookings).where(eq(bookings.id, id)).all();
    return results[0];
  }

  async cancelBooking(id: number): Promise<Booking | undefined> {
    const results = db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id)).returning().all();
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
    return { bookings: paginated, total };
  }
}

export const storage = new SqliteStorage();
