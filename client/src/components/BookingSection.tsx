import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface SlotInfo {
  time: string;
  bookedGuests: number;
  availableSpots: number;
  full: boolean;
  blocked?: boolean;
}

interface RigInfo {
  id: string;
  name: string;
  available: boolean;
}

type Step = "verify" | "date" | "slot" | "details" | "payment" | "done";
const SLOT_INTERVAL_MINUTES = 30;
const QR_IMAGE_CANDIDATES = [
  "/images/payment_qr%20code.png",
  "/images/payment_qr%20code.jpg",
  "/images/payment_qr%20code.jpeg",
  "/images/payment-qr-temp.svg",
];

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map((v) => Number(v));
  const hour = Number.isNaN(h) ? 0 : h;
  const minute = Number.isNaN(m) ? 0 : m;
  const fmt = (hr: number) => {
    const ampm = hr >= 12 ? "PM" : "AM";
    const h12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
    return `${h12}:00 ${ampm}`;
  };
  const min = minute === 0 ? "00" : "30";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${min} ${ampm}`;
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [h, m] = time.split(":").map((v) => Number(v));
  const total = (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m) + minutesToAdd;
  const nextH = Math.floor(total / 60);
  const nextM = total % 60;
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
}

function isPastSlotForDate(dateStr: string, slot: string): boolean {
  if (!dateStr || !slot) return false;
  const [year, month, day] = dateStr.split("-").map((v) => Number(v));
  const [hour, minute] = slot.split(":").map((v) => Number(v));
  if ([year, month, day, hour, minute].some((v) => Number.isNaN(v))) return false;
  const slotStart = new Date(year, month - 1, day, hour, minute, 0, 0);
  return slotStart.getTime() <= Date.now();
}

interface BookingSectionProps {
  loggedInMode?: boolean;
}

export default function BookingSection({ loggedInMode = false }: BookingSectionProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { customer, setAuthenticatedCustomer } = useAuth();

  const [step, setStep] = useState<Step>(loggedInMode ? "date" : "verify");

  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [otp, setOtp] = useState("");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [date, setDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dateClosed, setDateClosed] = useState(false);
  const [rangeStartIndex, setRangeStartIndex] = useState(0);
  const [rangeEndIndex, setRangeEndIndex] = useState(0);

  const [rigsLoading, setRigsLoading] = useState(false);
  const [rigs, setRigs] = useState<RigInfo[]>([]);
  const [selectedRigId, setSelectedRigId] = useState("");

  const [experience, setExperience] = useState<"sim" | "fpv" | "both">("sim");
  const [plan, setPlan] = useState<"starter" | "racer" | "squad" | "tournament">("starter");
  const [guests, setGuests] = useState("1");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"qr" | "pay_at_venue">("pay_at_venue");
  const [qrImageIndex, setQrImageIndex] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const selectedDateValue = date ? new Date(`${date}T00:00:00`) : undefined;
  const closedDateSet = useMemo(() => new Set(closedDates), [closedDates]);
  const visibleSlots = useMemo(() => {
    return slots.filter((s) => !isPastSlotForDate(date, s.time));
  }, [slots, date]);
  const firstAvailableIndex = useMemo(() => {
    const idx = visibleSlots.findIndex((s) => !s.full && !s.blocked);
    return idx >= 0 ? idx : 0;
  }, [visibleSlots]);
  const selectedSlotRange = useMemo(() => {
    if (!visibleSlots.length) return [] as SlotInfo[];
    const safeStart = Math.max(firstAvailableIndex, Math.min(rangeStartIndex, visibleSlots.length - 1));
    const safeEnd = Math.max(firstAvailableIndex, Math.min(rangeEndIndex, visibleSlots.length - 1));
    const start = Math.min(safeStart, safeEnd);
    const end = Math.max(safeStart, safeEnd);
    return visibleSlots.slice(start, end + 1);
  }, [visibleSlots, rangeStartIndex, rangeEndIndex, firstAvailableIndex]);
  const selectedDurationMinutes = selectedSlotRange.length * SLOT_INTERVAL_MINUTES;
  const selectedRangeIsBookable = selectedSlotRange.length > 0 && selectedSlotRange.every((slot) => !slot.full && !slot.blocked);
  const selectedStartSlot = selectedRangeIsBookable ? selectedSlotRange[0]?.time || "" : "";
  const selectedEndTime = selectedRangeIsBookable && selectedSlotRange.length
    ? addMinutesToTime(selectedSlotRange[selectedSlotRange.length - 1].time, SLOT_INTERVAL_MINUTES)
    : "";

  const rigCardImage = (rigName: string) =>
    rigName.startsWith("3 Screen") ? "/images/racing-sim.png" : "/images/steering-wheel.png";
  const selectedRig = rigs.find((r) => r.id === selectedRigId);

  const selectRangeByBox = (clickedIndex: number) => {
    const clicked = visibleSlots[clickedIndex];
    if (!clicked || clicked.full || clicked.blocked) return;

    const currentStart = Math.min(rangeStartIndex, rangeEndIndex);
    const currentEnd = Math.max(rangeStartIndex, rangeEndIndex);
    const hasExistingRange = currentStart !== currentEnd;

    if (hasExistingRange) {
      setRangeStartIndex(clickedIndex);
      setRangeEndIndex(clickedIndex);
      return;
    }

    const start = Math.min(currentStart, clickedIndex);
    const end = Math.max(currentStart, clickedIndex);
    const nextRange = visibleSlots.slice(start, end + 1);
    const allBookable = nextRange.every((slot) => !slot.full && !slot.blocked);

    if (!allBookable) {
      setRangeStartIndex(clickedIndex);
      setRangeEndIndex(clickedIndex);
      return;
    }

    setRangeStartIndex(start);
    setRangeEndIndex(end);
  };

  useEffect(() => {
    if (!loggedInMode) return;
    if (!customer) return;
    setName(customer.name || "");
    setPhone(customer.phone || "");
    setStep("date");
  }, [loggedInMode, customer]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/schedule/closed-dates")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setClosedDates(Array.isArray(data.dates) ? data.dates : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClosedDates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      setDateClosed(false);
      setRangeStartIndex(0);
      setRangeEndIndex(0);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/slots?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots || []);
          setDateClosed(!!data.closed);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setDateClosed(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    setRangeStartIndex(0);
    setRangeEndIndex(0);
    setRigs([]);
    setSelectedRigId("");

    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (!visibleSlots.length) {
      setRangeStartIndex(0);
      setRangeEndIndex(0);
      return;
    }
    setRangeStartIndex((prev) => Math.max(firstAvailableIndex, Math.min(prev, visibleSlots.length - 1)));
    setRangeEndIndex((prev) => Math.max(firstAvailableIndex, Math.min(prev, visibleSlots.length - 1)));
  }, [visibleSlots, firstAvailableIndex]);

  useEffect(() => {
    if (!visibleSlots.length) return;
    setRangeStartIndex(firstAvailableIndex);
    setRangeEndIndex(firstAvailableIndex);
  }, [date, firstAvailableIndex, visibleSlots.length]);

  useEffect(() => {
    if (paymentMethod === "qr") {
      setQrImageIndex(0);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (!date || !selectedStartSlot) {
      setRigs([]);
      setSelectedRigId("");
      return;
    }

    let cancelled = false;
    setRigsLoading(true);
    fetch(`/api/rigs?date=${date}&timeSlot=${selectedStartSlot}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setRigs(data.rigs || []);
          setSelectedRigId("");
        }
      })
      .catch(() => {
        if (!cancelled) setRigs([]);
      })
      .finally(() => {
        if (!cancelled) setRigsLoading(false);
      });

    return () => { cancelled = true; };
  }, [date, selectedStartSlot]);

  const sendOtp = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Missing details", description: "Enter name and phone number", variant: "destructive" });
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setOtpSessionId(data.sessionId);
      setMockOtp(data.mockOtp || "");
      toast({ title: "OTP sent", description: "Mock OTP generated for testing" });
    } catch (err: any) {
      toast({ title: "OTP send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpSessionId || !otp.trim()) {
      toast({ title: "Missing OTP", description: "Enter the OTP and verify", variant: "destructive" });
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: otpSessionId, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OTP verification failed");

      setOtpToken(data.otpToken);
      if (data.customer) {
        setAuthenticatedCustomer(data.customer, data.token);
      }
      navigate("/dashboard");
      toast({ title: "Verified", description: "Phone number verified and login session created" });
    } catch (err: any) {
      toast({ title: "OTP verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const submitBooking = async () => {
    if (!loggedInMode && !otpToken) {
      toast({ title: "Verification required", description: "Verify OTP first", variant: "destructive" });
      setStep("verify");
      return;
    }
    if (!date || selectedSlotRange.length === 0) {
      toast({ title: "Missing selection", description: "Select date and time range", variant: "destructive" });
      return;
    }
    if (!selectedRangeIsBookable) {
      toast({ title: "Unavailable range", description: "Selected range includes booked/unavailable slots", variant: "destructive" });
      return;
    }
    if (!selectedRig) {
      toast({ title: "Select a rig", description: "Please select one available rig", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const paymentLabel = paymentMethod === "qr" ? "QR" : "Pay at Venue";
      const composedMessage = `${message?.trim() || paymentLabel}\nRig: ${selectedRig.name}\nPayment Method: ${paymentLabel}`;
      await apiRequest("POST", "/api/bookings", {
        name: name.trim(),
        phone: phone.trim(),
        email: customer?.email,
        experience,
        plan,
        date,
        timeSlots: selectedSlotRange.map((slot) => slot.time),
        guests,
        message: composedMessage,
        customerId: customer?.id ?? null,
        paymentMethod,
        ...(loggedInMode ? {} : { otpToken }),
      });

      setStep("done");
      toast({ title: "Booking confirmed", description: `Payment mode: ${paymentLabel}. View your ticket in dashboard.` });
    } catch (err: any) {
      toast({ title: "Booking failed", description: err.message || "Please try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep(loggedInMode ? "date" : "verify");
    setOtp("");
    setOtpSessionId("");
    setOtpToken("");
    setMockOtp("");
    setDate("");
    setSlots([]);
    setRangeStartIndex(0);
    setRangeEndIndex(0);
    setRigs([]);
    setSelectedRigId("");
    setExperience("sim");
    setPlan("starter");
    setGuests("1");
    setMessage("");
    setPaymentMethod("pay_at_venue");
  };

  return (
    <section id="booking" className="py-24 relative overflow-hidden" data-testid="section-booking">
      <div className="absolute top-0 left-0 right-0 h-px neon-divider opacity-40" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
          <Badge variant="outline" className="border-primary/40 text-primary font-racing text-xs tracking-widest uppercase mb-4">
            Book A Session
          </Badge>
          <h2 className="font-racing text-4xl md:text-5xl font-bold uppercase tracking-tight text-foreground mb-4">
            Start Your <span className="text-primary">Engine</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            Reserve your spot at MetaRacing. We'll confirm your booking within 30 minutes.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="border-border/50" data-testid="booking-form-card">
            <CardContent className="p-6 md:p-8">
              {step === "done" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="booking-success">
                  <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 animate-pulse-glow">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-racing text-2xl font-bold uppercase text-foreground mb-2">Booking Confirmed!</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Your slot is locked. Payment mode selected: {paymentMethod === "qr" ? "QR" : "Pay at Venue"}.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button onClick={() => navigate("/dashboard")} data-testid="button-view-my-tickets">
                      View My Tickets
                    </Button>
                    <Button variant="outline" onClick={resetFlow} data-testid="button-book-another">
                      Book Another Session
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6" data-testid="booking-form">
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest font-racing text-muted-foreground">
                    <span>Step: {step}</span>
                    <span>Payment: {paymentMethod === "qr" ? "QR" : "Pay at Venue"}</span>
                  </div>

                  {step === "verify" && !loggedInMode && (
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Full Name</label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="input-name" />
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Phone Number</label>
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" data-testid="input-phone" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={sendOtp} disabled={sendingOtp} data-testid="button-send-otp">
                          {sendingOtp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Send OTP
                        </Button>
                      </div>
                      {otpSessionId && (
                        <div className="space-y-2 rounded-md border border-border/50 p-4">
                          <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Enter OTP</label>
                          <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" data-testid="input-otp" />
                          {mockOtp ? (
                            <div className="text-xs text-amber-300">Mock OTP: {mockOtp}</div>
                          ) : null}
                          <Button type="button" onClick={verifyOtp} disabled={verifyingOtp} data-testid="button-verify-otp">
                            {verifyingOtp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                            Verify OTP
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {step === "date" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Select Date</label>
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="input-date"
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {selectedDateValue ? format(selectedDateValue, "PPP") : "Pick a booking date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDateValue}
                              onSelect={(nextDate) => {
                                if (!nextDate) return;
                                setDate(format(nextDate, "yyyy-MM-dd"));
                                setCalendarOpen(false);
                              }}
                              disabled={(day) => {
                                const isoDate = format(day, "yyyy-MM-dd");
                                return isoDate < today || closedDateSet.has(isoDate);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {dateClosed ? (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          This date is closed for bookings. Please choose another date.
                        </div>
                      ) : null}
                      <Button type="button" onClick={() => setStep("slot")} disabled={!date || dateClosed} data-testid="button-go-slot">
                        Continue to Time Slots
                      </Button>
                    </div>
                  )}

                  {step === "slot" && (
                    <div className="space-y-4">
                      <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                        <div className="font-racing text-xs uppercase tracking-widest text-foreground mb-2">How To Select Time Slots</div>
                        <div>1. First, click your starting time slot.</div>
                        <div>2. Then, click your ending time slot.</div>
                        <div>3. We will automatically select the continuous slots between start and end.</div>
                        <div>4. Click any single available slot again to reset and choose a new range.</div>
                      </div>
                      {slotsLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Loading slots...</span>
                        </div>
                      ) : (
                        <div className="space-y-4 rounded-md border border-border/50 p-4">
                          {!visibleSlots.length ? (
                            <div className="text-sm text-muted-foreground">No available slots for this date.</div>
                          ) : (
                            <>
                              <div className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Booking Time Range (Box Selection)</div>

                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-muted-foreground">From:</span>{" "}
                                  <span className="font-racing text-primary">{selectedStartSlot ? formatSlotLabel(selectedStartSlot) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Until:</span>{" "}
                                  <span className="font-racing text-primary">{selectedEndTime ? formatSlotLabel(selectedEndTime) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Duration:</span>{" "}
                                  <span className="font-racing text-primary">{selectedDurationMinutes} min</span>
                                </div>
                              </div>

                              {!selectedRangeIsBookable ? (
                                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                                  Selected range includes booked/unavailable slots. Choose a fully available range.
                                </div>
                              ) : null}

                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {visibleSlots.map((s, idx) => {
                                  const start = Math.min(rangeStartIndex, rangeEndIndex);
                                  const end = Math.max(rangeStartIndex, rangeEndIndex);
                                  const inRange = idx >= start && idx <= end;
                                  const unavailable = s.full || s.blocked;
                                  return (
                                    <div
                                      key={s.time}
                                      onClick={() => selectRangeByBox(idx)}
                                      className={`min-w-[140px] rounded-md border px-3 py-2 text-left ${
                                        inRange && !unavailable
                                          ? "border-primary bg-primary/15 text-primary"
                                          : unavailable
                                            ? "border-red-600/40 bg-red-600/10 text-red-300"
                                            : "border-green-600/40 bg-green-600/10 text-green-300"
                                      } ${unavailable ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:border-primary/60"}`}
                                    >
                                      <div className="font-racing text-xs uppercase tracking-widest">{formatSlotLabel(s.time)}</div>
                                      <div className="text-[11px] mt-1">{unavailable ? (s.blocked ? "Unavailable" : "Booked") : "Available"}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {selectedStartSlot ? (
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Available Rigs</div>
                          {rigsLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              <span className="text-sm text-muted-foreground">Loading rigs...</span>
                            </div>
                          ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {rigs.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  disabled={!r.available}
                                  onClick={() => setSelectedRigId(r.id)}
                                  className={`rounded-md border overflow-hidden text-sm text-left transition-all ${
                                    !r.available
                                      ? "border-red-600/40 bg-red-600/10 text-red-300 opacity-70 cursor-not-allowed"
                                      : selectedRigId === r.id
                                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary"
                                        : "border-green-600/40 bg-green-600/10 text-green-300 hover:border-primary/60"
                                  }`}
                                  data-testid={`rig-${r.id}`}
                                >
                                  <img
                                    src={rigCardImage(r.name)}
                                    alt={r.name}
                                    className="h-28 w-full object-cover"
                                  />
                                  <div className="px-3 py-3">
                                    <div className="font-medium">{r.name}</div>
                                    <div className="text-xs mt-1">{r.available ? "Available" : "Booked"}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}

                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setStep("date")}>Back</Button>
                        <Button type="button" onClick={() => setStep("details")} disabled={!selectedStartSlot || !selectedRigId || !selectedRangeIsBookable}>Continue</Button>
                      </div>
                    </div>
                  )}

                  {step === "details" && (
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Experience</label>
                          <Select value={experience} onValueChange={(v) => setExperience(v as "sim" | "fpv" | "both")}>
                            <SelectTrigger data-testid="select-experience"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Racing Simulator</SelectItem>
                              <SelectItem value="fpv">FPV Arena</SelectItem>
                              <SelectItem value="both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Guests</label>
                          <Select value={guests} onValueChange={setGuests}>
                            <SelectTrigger data-testid="select-guests"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 person</SelectItem>
                              <SelectItem value="2">2 people</SelectItem>
                              <SelectItem value="3">3 people</SelectItem>
                              <SelectItem value="4">4 people</SelectItem>
                              <SelectItem value="5">5 people</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground mb-2 block">Select Plan</label>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {([
                            {
                              id: "starter" as const,
                              name: "Starter",
                              desc: "30 min session",
                              price: "₹249",
                              priceNote: "or ₹449/hr",
                              border: plan === "starter" ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border/40 hover:border-primary/50",
                              tag: "Single",
                            },
                            {
                              id: "racer" as const,
                              name: "Racer",
                              desc: "1 hour · priority access",
                              price: "₹299",
                              priceNote: "or ₹549/hr",
                              border: plan === "racer" ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border/40 hover:border-primary/50",
                              tag: "Popular",
                            },
                            {
                              id: "squad" as const,
                              name: "Squad",
                              desc: "Group · 4–6 members",
                              price: "₹499",
                              priceNote: "per person/hr",
                              border: plan === "squad" ? "border-accent bg-accent/10 ring-2 ring-accent" : "border-border/40 hover:border-accent/50",
                              tag: "Group",
                            },
                            {
                              id: "tournament" as const,
                              name: "Tournament",
                              desc: "Pro · after 10 PM only",
                              price: "₹999",
                              priceNote: "per session",
                              border: plan === "tournament" ? "border-amber-400 bg-amber-400/10 ring-2 ring-amber-400" : "border-border/40 hover:border-amber-400/50",
                              tag: "Pro",
                            },
                          ] as const).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPlan(p.id)}
                              className={`rounded-md border p-3 text-left transition-all ${p.border}`}
                              data-testid={`plan-${p.id}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-racing text-sm uppercase tracking-widest text-foreground">{p.name}</span>
                                <span className="text-[10px] font-racing uppercase tracking-widest text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">{p.tag}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">{p.desc}</div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-racing text-xl font-bold text-primary">{p.price}</span>
                                <span className="text-xs text-muted-foreground">{p.priceNote}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Special Requests</label>
                        <Textarea
                          placeholder="Any special requests"
                          className="resize-none"
                          rows={3}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          data-testid="input-message"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setStep("slot")}>Back</Button>
                        <Button type="button" onClick={() => setStep("payment")}>Continue to Payment</Button>
                      </div>
                    </div>
                  )}

                  {step === "payment" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground mb-2 block">Choose Payment Option</label>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("qr")}
                            className={`rounded-md border p-4 text-left transition-all ${paymentMethod === "qr" ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border/40 hover:border-primary/50"}`}
                            data-testid="payment-method-qr"
                          >
                            <div className="font-racing text-sm uppercase tracking-widest text-foreground">Pay Through QR</div>
                            <div className="text-xs text-muted-foreground mt-2">Reserve now and complete payment by QR at the counter.</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("pay_at_venue")}
                            className={`rounded-md border p-4 text-left transition-all ${paymentMethod === "pay_at_venue" ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border/40 hover:border-primary/50"}`}
                            data-testid="payment-method-pay-at-venue"
                          >
                            <div className="font-racing text-sm uppercase tracking-widest text-foreground">Pay at Venue</div>
                            <div className="text-xs text-muted-foreground mt-2">Reserve now and pay directly before your session starts.</div>
                          </button>
                        </div>
                      </div>

                      <div className="rounded-md border border-border/50 p-4 space-y-2">
                        <div className="text-sm"><span className="text-muted-foreground">Name:</span> {name}</div>
                        <div className="text-sm"><span className="text-muted-foreground">Phone:</span> {phone}</div>
                        <div className="text-sm"><span className="text-muted-foreground">Date:</span> {date}</div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Slot Range:</span>{" "}
                          {selectedStartSlot && selectedEndTime
                            ? `${formatSlotLabel(selectedStartSlot)} to ${formatSlotLabel(selectedEndTime)}`
                            : "-"}
                        </div>
                        <div className="text-sm"><span className="text-muted-foreground">Duration:</span> {selectedDurationMinutes} min</div>
                        <div className="text-sm"><span className="text-muted-foreground">Rig:</span> {selectedRig?.name || "-"}</div>
                        <div className="text-sm capitalize"><span className="text-muted-foreground">Plan:</span> {plan}</div>
                        <div className="text-sm"><span className="text-muted-foreground">Guests:</span> {guests}</div>
                        <div className="text-sm font-semibold text-primary">
                          <span className="text-muted-foreground font-normal">Payment:</span>{" "}
                          {paymentMethod === "qr" ? "Pay Through QR" : "Pay at Venue"}
                        </div>
                      </div>

                      {paymentMethod === "qr" ? (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground space-y-3">
                          <div>
                            QR option selected. Your booking will be reserved now and payment can be completed through QR at the venue.
                          </div>
                          <div className="mx-auto max-w-[260px] rounded-md border border-border/50 bg-white p-3">
                            <img
                              src={QR_IMAGE_CANDIDATES[qrImageIndex]}
                              alt="MetaRacing payment QR"
                              className="w-full h-auto rounded-sm"
                              onError={() => {
                                setQrImageIndex((prev) => Math.min(prev + 1, QR_IMAGE_CANDIDATES.length - 1));
                              }}
                              data-testid="payment-qr-image"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Place your actual QR file in client/public/images as payment_qr code.png, .jpg, or .jpeg to replace this temporary placeholder automatically.
                          </div>
                        </div>
                      ) : null}

                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setStep("details")}>Back</Button>
                        <Button type="button" onClick={submitBooking} disabled={submitting} data-testid="button-submit-booking">
                          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Confirm Booking ({paymentMethod === "qr" ? "QR" : "Pay at Venue"})
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
