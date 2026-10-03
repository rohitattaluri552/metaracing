export type PaymentMethod = "pay_at_venue" | "qr";
export type BookingPlanOption =
  | "starter"
  | "racer"
  | "champion"
  | "squad"
  | "tournament";
export type ResourceTypeOption = "sim" | "vr" | "rc";
export type GuestCount = string | number;

export interface SendOtpRequest {
  name: string;
  phone: string;
}

export interface SendOtpResponse {
  sessionId: string;
  expiresInSeconds: number;
  mockOtp?: string;
}

export interface VerifyOtpRequest {
  sessionId: string;
  otp: string;
}

export interface VerifyOtpResponse {
  otpToken: string;
  name: string;
  phone: string;
  customer?: Record<string, unknown>;
  token: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface ScheduleOverridePayload {
  date: string;
  closed: boolean;
  openTime: string;
  closeTime: string;
  maxGuestsPerSlot: number;
  blockedSlots: string;
}

export interface PublicBookingPayload {
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
  guests: GuestCount;
  message: string;
  customerId: number | null;
  paymentMethod?: PaymentMethod;
  otpToken?: string;
}

export interface AdminBookingPayload {
  name: string;
  email: string;
  phone: string;
  experience: string;
  plan: string;
  date: string;
  timeSlot: string;
  guests: GuestCount;
  message?: string;
}
