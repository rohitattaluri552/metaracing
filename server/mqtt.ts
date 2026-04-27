import mqtt from "mqtt";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { log } from "./index";

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

// ── MQTT Topics ──
// Subscribed (incoming from mobile app):
const TOPIC_LOGIN_REQUEST = "metarace/auth/login";
const TOPIC_REGISTER_REQUEST = "metarace/auth/register";
const TOPIC_LOGOUT_REQUEST = "metarace/auth/logout";
const TOPIC_BOOKING_CREATE = "metarace/bookings/ticketbooking";
const TOPIC_BOOKING_CANCEL = "metarace/bookings/ticketcancellation";
const TOPIC_BOOKING_VIEW = "metarace/bookings/viewbookings";

// Published (responses back to mobile app):
const TOPIC_LOGIN_ACK = "metarace/auth/login/ack";
const TOPIC_REGISTER_ACK = "metarace/auth/register/ack";
const TOPIC_LOGOUT_ACK = "metarace/auth/logout/ack";
const TOPIC_BOOKING_CREATE_ACK = "metarace/bookings/ticketbooking/ack";
const TOPIC_BOOKING_CANCEL_ACK = "metarace/bookings/ticketcancellation/ack";
const TOPIC_BOOKING_VIEW_ACK = "metarace/bookings/viewbookings/ack";

let client: mqtt.MqttClient | null = null;

export function setupMqtt(brokerUrl: string) {
  client = mqtt.connect(brokerUrl, {
    clientId: `metarace_server_${Date.now()}`,
    clean: true,
    keepalive: 20,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    log("Connected to MQTT broker", "mqtt");

    // Subscribe to all incoming topics
    const topics = [
      TOPIC_LOGIN_REQUEST,
      TOPIC_REGISTER_REQUEST,
      TOPIC_LOGOUT_REQUEST,
      TOPIC_BOOKING_CREATE,
      TOPIC_BOOKING_CANCEL,
      TOPIC_BOOKING_VIEW,
    ];

    topics.forEach((topic) => {
      client!.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          log(`Failed to subscribe to ${topic}: ${err.message}`, "mqtt");
        } else {
          log(`Subscribed to ${topic}`, "mqtt");
        }
      });
    });
  });

  client.on("message", async (topic, message) => {
    let payload: any;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      log(`Invalid JSON on topic ${topic}`, "mqtt");
      return;
    }

    log(`Received on ${topic}: ${message.toString()}`, "mqtt");

    switch (topic) {
      case TOPIC_LOGIN_REQUEST:
        await handleLogin(payload);
        break;
      case TOPIC_REGISTER_REQUEST:
        await handleRegister(payload);
        break;
      case TOPIC_LOGOUT_REQUEST:
        await handleLogout(payload);
        break;
      case TOPIC_BOOKING_CREATE:
        await handleBookingCreate(payload);
        break;
      case TOPIC_BOOKING_CANCEL:
        await handleBookingCancel(payload);
        break;
      case TOPIC_BOOKING_VIEW:
        await handleBookingView(payload);
        break;
      default:
        log(`Unhandled topic: ${topic}`, "mqtt");
    }
  });

  client.on("error", (err) => {
    log(`MQTT error: ${err.message}`, "mqtt");
  });

  client.on("reconnect", () => {
    log("Reconnecting to MQTT broker...", "mqtt");
  });

  client.on("offline", () => {
    log("MQTT client offline", "mqtt");
  });
}

function publish(topic: string, payload: object) {
  if (client && client.connected) {
    client.publish(topic, JSON.stringify(payload), { qos: 1 });
    log(`Published to ${topic}`, "mqtt");
  }
}

// ── Handlers ──

async function handleLogin(payload: any) {
  try {
    const { data } = payload;
    const email = (data?.email_id || data?.email || "").trim().toLowerCase();
    const password = data?.password;

    if (!email || !password) {
      publish(TOPIC_LOGIN_ACK, {
        success: false,
        error: "Email and password are required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      publish(TOPIC_LOGIN_ACK, {
        success: false,
        error: "Invalid email format",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      publish(TOPIC_LOGIN_ACK, {
        success: false,
        error: "Invalid email or password",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      publish(TOPIC_LOGIN_ACK, {
        success: false,
        error: "Invalid email or password",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    publish(TOPIC_LOGIN_ACK, {
      success: true,
      customer: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    publish(TOPIC_LOGIN_ACK, {
      success: false,
      error: "Login failed",
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleRegister(payload: any) {
  try {
    const { data } = payload;
    const name = data?.name;
    const email = (data?.email_id || data?.email || "").trim().toLowerCase();
    const phone = data?.phone || "";
    const password = data?.password;

    if (!name || !email || !password) {
      publish(TOPIC_REGISTER_ACK, {
        success: false,
        error: "Name, email, and password are required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      publish(TOPIC_REGISTER_ACK, {
        success: false,
        error: "Invalid email format",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (typeof password !== "string" || password.length < 6) {
      publish(TOPIC_REGISTER_ACK, {
        success: false,
        error: "Password must be at least 6 characters",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      publish(TOPIC_REGISTER_ACK, {
        success: false,
        error: "An account with this email already exists",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ name, email, phone, password: hashedPassword });

    publish(TOPIC_REGISTER_ACK, {
      success: true,
      customer: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    publish(TOPIC_REGISTER_ACK, {
      success: false,
      error: "Registration failed",
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleLogout(payload: any) {
  try {
    const { data } = payload;
    const userId = data?.user_id || data?.id;

    // Server-side logout is a no-op for stateless auth,
    // but we acknowledge it so the app can clear local state.
    publish(TOPIC_LOGOUT_ACK, {
      success: true,
      user_id: userId,
      message: "Logged out successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    publish(TOPIC_LOGOUT_ACK, {
      success: false,
      error: "Logout failed",
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleBookingCreate(payload: any) {
  try {
    const { data } = payload;
    const name = data?.name;
    const email = (data?.email_id || data?.email || "").trim().toLowerCase();
    const phone = data?.phone || "";
    const experience = data?.experience;
    const plan = data?.plan;
    const date = data?.date;
    const timeSlot = data?.time_slot || data?.timeSlot || "";
    const guests = data?.guests;
    const message = data?.message || "";
    const customerId = data?.customer_id || data?.customerId || null;

    if (!name || !email || !experience || !plan || !date || !timeSlot || !guests) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "Missing required booking fields (name, email, experience, plan, date, timeSlot, guests)",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "Invalid email format",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!VALID_EXPERIENCES.includes(experience)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "Invalid experience. Must be: sim, fpv, or both",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!VALID_PLANS.includes(plan)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "Invalid plan. Must be: starter, racer, champion, or squad",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!ALL_TIME_SLOTS.includes(timeSlot)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "Invalid time slot",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!isDateTodayOrFuture(date)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "Date must be today or in the future",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check schedule overrides
    const override = await storage.getScheduleOverride(date);
    if (override?.closed) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "This date is closed for bookings",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const openTime = override?.openTime || "09:00";
    const closeTime = override?.closeTime || "21:00";
    const validSlots = getTimeSlotsForRange(openTime, closeTime);
    if (!validSlots.includes(timeSlot)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: `This slot is outside operating hours (${openTime}–${closeTime})`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const blockedSlots = override?.blockedSlots ? override.blockedSlots.split(",").map(s => s.trim()) : [];
    if (blockedSlots.includes(timeSlot)) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: "This time slot is blocked",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const maxGuests = override?.maxGuestsPerSlot || MAX_GUESTS_PER_SLOT;

    const guestsNum = Number(guests);
    if (isNaN(guestsNum) || guestsNum < 1 || guestsNum > maxGuests) {
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: `Guests must be between 1 and ${maxGuests}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check slot capacity
    const currentGuests = await storage.getSlotGuestCount(date, timeSlot);
    if (currentGuests + guestsNum > maxGuests) {
      const remaining = maxGuests - currentGuests;
      publish(TOPIC_BOOKING_CREATE_ACK, {
        success: false,
        error: remaining <= 0
          ? "This time slot is fully booked"
          : `Only ${remaining} spot(s) left in this slot`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const booking = await storage.createBooking({
      name,
      email,
      phone,
      experience,
      plan,
      date,
      timeSlot,
      guests: String(guests),
      message,
      status: "confirmed",
      customerId: customerId ? Number(customerId) : null,
    });

    publish(TOPIC_BOOKING_CREATE_ACK, {
      success: true,
      booking,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    publish(TOPIC_BOOKING_CREATE_ACK, {
      success: false,
      error: "Failed to create booking",
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleBookingCancel(payload: any) {
  try {
    const { data } = payload;
    const bookingId = data?.booking_id || data?.id;

    if (!bookingId) {
      publish(TOPIC_BOOKING_CANCEL_ACK, {
        success: false,
        error: "Booking ID is required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const existing = await storage.getBookingById(Number(bookingId));
    if (!existing) {
      publish(TOPIC_BOOKING_CANCEL_ACK, {
        success: false,
        error: "Booking not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (existing.status === "cancelled") {
      publish(TOPIC_BOOKING_CANCEL_ACK, {
        success: false,
        error: "Booking is already cancelled",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const cancelled = await storage.cancelBooking(Number(bookingId));

    publish(TOPIC_BOOKING_CANCEL_ACK, {
      success: true,
      booking: cancelled,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    publish(TOPIC_BOOKING_CANCEL_ACK, {
      success: false,
      error: "Failed to cancel booking",
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleBookingView(payload: any) {
  try {
    const { data } = payload;
    const customerId = data?.customer_id || data?.customerId || data?.user_id;

    if (!customerId) {
      publish(TOPIC_BOOKING_VIEW_ACK, {
        success: false,
        error: "Customer ID is required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const bookings = await storage.getBookingsByCustomer(Number(customerId));

    publish(TOPIC_BOOKING_VIEW_ACK, {
      success: true,
      bookings,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    publish(TOPIC_BOOKING_VIEW_ACK, {
      success: false,
      error: "Failed to fetch bookings",
      timestamp: new Date().toISOString(),
    });
  }
}
