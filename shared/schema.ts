import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").default(""),
  experienceLevel: text("experience_level").notNull().default("rookie"),
  password: text("password").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;


export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // sim | vr | rc
  status: text("status").notNull().default("active"), // active | maintenance | inactive
  maxPeople: integer("max_people").notNull().default(1),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
});
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resources.$inferSelect;

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
  checkinVerified: integer("checkin_verified", { mode: "boolean" }).notNull().default(false),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentAmount: integer("payment_amount").default(0),
  paymentMode: text("payment_mode").default(""),
  customerId: integer("customer_id"),
  resourceId: integer("resource_id"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  partySize: integer("party_size").notNull().default(1),
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

export const pricing = sqliteTable("pricing", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  experienceType: text("experience_type").notNull(), // sim | vr | rc
  resourceCategory: text("resource_category"), // single_screen | triple_screen
  durationMinutes: integer("duration_minutes").notNull(),
  price: integer("price").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertPricingSchema = createInsertSchema(pricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPricing = z.infer<typeof insertPricingSchema>;
export type Pricing = typeof pricing.$inferSelect;

export const offers = sqliteTable("offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull(), // percentage | fixed
  discountValue: integer("discount_value").notNull(),
  experienceType: text("experience_type").notNull(), // sim | vr | rc
  resourceCategory: text("resource_category"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  startDate: text("start_date"),
  endDate: text("end_date"),
  marketingText: text("marketing_text").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offers.$inferSelect;
