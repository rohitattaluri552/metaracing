import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").default(""),
  password: text("password").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").default(""),
  experience: text("experience").notNull(),
  plan: text("plan").notNull(),
  date: text("date").notNull(),
  timeSlot: text("time_slot").notNull().default(""),
  guests: text("guests").notNull(),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("confirmed"),
  customerId: integer("customer_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export const scheduleOverrides = sqliteTable("schedule_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  closed: integer("closed", { mode: "boolean" }).notNull().default(false),
  openTime: text("open_time").default("09:00"),
  closeTime: text("close_time").default("21:00"),
  maxGuestsPerSlot: integer("max_guests_per_slot").default(5),
  blockedSlots: text("blocked_slots").default(""),  // comma-separated: "10:00,14:00"
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertScheduleOverrideSchema = createInsertSchema(scheduleOverrides).omit({
  id: true,
  createdAt: true,
});
export type InsertScheduleOverride = z.infer<typeof insertScheduleOverrideSchema>;
export type ScheduleOverride = typeof scheduleOverrides.$inferSelect;
