import type {
  AdminBookingPayload,
  AuthRequest,
  PublicBookingPayload,
  RegisterRequest,
  ScheduleOverridePayload,
  SendOtpRequest,
  VerifyOtpRequest,
} from "@/types/api";

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function buildSendOtpPayload(
  name: string,
  phone: string
): SendOtpRequest {
  return {
    name: name.trim(),
    phone: normalizePhone(phone),
  };
}

export function buildVerifyOtpPayload(
  sessionId: string,
  otp: string
): VerifyOtpRequest {
  return {
    sessionId: sessionId.trim(),
    otp: otp.trim(),
  };
}

export function buildAuthLoginPayload(
  email: string,
  password: string
): AuthRequest {
  return {
    email: email.trim().toLowerCase(),
    password,
  };
}

export function buildRegisterPayload(
  name: string,
  email: string,
  phone: string,
  password: string
): RegisterRequest {
  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: normalizePhone(phone),
    password,
  };
}

export function buildPublicBookingPayload(input: {
  name: string;
  phone: string;
  email?: string | null;
  resourceType: string;
  resourceId: number | null;
  experience: string;
  plan: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  timeSlots: string[];
  guests: string | number;
  message?: string;
  customerId?: number | null;
  paymentMethod?: "pay_at_venue" | "qr";
  otpToken?: string;
}): PublicBookingPayload {
  return {
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: input.email ?? null,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    experience: input.experience,
    plan: input.plan,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    partySize: input.partySize,
    timeSlots: input.timeSlots,
    guests: input.guests,
    message: input.message ?? "",
    customerId: input.customerId ?? null,
    paymentMethod: input.paymentMethod,
    otpToken: input.otpToken,
  };
}

export function buildAdminBookingPayload(input: {
  name: string;
  email: string;
  phone: string;
  experience: string;
  plan: string;
  date: string;
  timeSlot: string;
  guests: string | number;
  message?: string;
}): AdminBookingPayload {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    experience: input.experience,
    plan: input.plan,
    date: input.date,
    timeSlot: input.timeSlot,
    guests: input.guests,
    message: input.message ?? "",
  };
}

export function buildScheduleOverridePayload(
  input: ScheduleOverridePayload
): ScheduleOverridePayload {
  return {
    ...input,
    blockedSlots: input.blockedSlots ?? "",
  };
}
