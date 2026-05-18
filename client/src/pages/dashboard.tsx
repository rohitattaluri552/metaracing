import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Calendar, Clock, LogOut, Trophy, Zap, ChevronRight,
  Monitor, Radio, Users, Star
} from "lucide-react";

const experienceIcons: Record<string, any> = {
  sim: Monitor,
  fpv: Radio,
  both: Zap,
};

const planColors: Record<string, string> = {
  starter: "bg-secondary text-secondary-foreground border-border/40",
  racer: "bg-primary/15 text-primary border-primary/30",
  champion: "bg-accent/15 text-accent border-accent/30",
  squad: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  tournament: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const racerCategoryLabels: Record<string, string> = {
  rookie: "Rookie Racer",
  veteran: "Veteran Racer",
};

interface CheckinInfo {
  bookingId: number;
  otpVisible: boolean;
  otp: string | null;
  minutesUntilSlot: number;
  paymentDone: boolean;
  paymentAmount: number;
  paymentMode: string;
  arriveEarlyMinutes: number;
  message: string;
}

type SessionState = "active" | "about" | "completed" | "upcoming";

const sessionDotStyles: Record<SessionState, string> = {
  active: "bg-green-400",
  about: "bg-yellow-400",
  completed: "bg-red-500",
  upcoming: "bg-blue-400",
};

const sessionLabels: Record<SessionState, string> = {
  active: "Active Session",
  about: "About To Happen",
  completed: "Completed",
  upcoming: "Upcoming",
};

function getBookingStart(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map((v) => Number(v));
  const [hour, minute] = time.split(":").map((v) => Number(v));
  if ([year, month, day, hour, minute].some((v) => Number.isNaN(v))) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getSessionState(booking: any): SessionState {
  if (booking?.status === "cancelled" || booking?.status === "expired") return "completed";
  const start = getBookingStart(booking?.date || "", booking?.timeSlot || "");
  if (!start) return "upcoming";
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const now = new Date();
  if (now >= end) return "completed";
  if (now >= start) return "active";
  const minsUntilStart = Math.ceil((start.getTime() - now.getTime()) / 60000);
  if (minsUntilStart <= 30) return "about";
  return "upcoming";
}

function formatSlotLabel(time: string): string {
  if (!time) return "-";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const minute = parseInt(m || "0", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const start = new Date(2000, 0, 1, hour, minute, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => {
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
    return `${h12}:${mm} ${ampm}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function StatCard({ icon: Icon, label, value, color = "text-primary" }: any) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <div className="font-racing text-2xl font-bold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { customer, logout, isLoading } = useAuth();
  const hasStoredCustomer = !!localStorage.getItem("mr_customer");
  const hasStoredCustomerToken = !!localStorage.getItem("mr_customer_token");
  const needsProfileCompletion = customer?.email.endsWith("@otp.metaracing.local") ?? false;
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [checkinInfo, setCheckinInfo] = useState<CheckinInfo | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !customer && (!hasStoredCustomer || !hasStoredCustomerToken)) {
      navigate("/login");
    }
  }, [customer, isLoading, hasStoredCustomer, hasStoredCustomerToken, navigate]);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customer?.id, "bookings"],
    enabled: !!customer,
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const fetchCheckinInfo = async (booking: any) => {
    if (!customer) return;
    setCheckinLoading(true);
    try {
      const token = localStorage.getItem("mr_customer_token");
      const res = await fetch(`/api/customers/${customer.id}/bookings/${booking.id}/checkin`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch check-in details");
      setCheckinInfo(data);
    } catch {
      setCheckinInfo(null);
    } finally {
      setCheckinLoading(false);
    }
  };

  const openTicketDetails = (booking: any) => {
    setSelectedBooking(booking);
    setTicketDialogOpen(true);
    fetchCheckinInfo(booking);
  };

  useEffect(() => {
    if (!ticketDialogOpen || !selectedBooking) return;
    const id = window.setInterval(() => {
      fetchCheckinInfo(selectedBooking);
    }, 30000);
    return () => window.clearInterval(id);
  }, [ticketDialogOpen, selectedBooking]);

  if (isLoading || !customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalSessions = bookings.length;
  const upcomingSessions = bookings.filter((b: any) => {
    const state = getSessionState(b);
    return state === "about" || state === "upcoming";
  }).length;

  return (
    <div className="min-h-screen bg-background" data-testid="page-dashboard">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            <a href="/" className="flex items-center gap-2" data-testid="link-dashboard-home">
              <img src="/images/metaracing-logo.png" alt="MetaRacing" className="h-8 w-8 object-contain" />
              <span className="font-racing text-base font-bold tracking-widest uppercase text-foreground">
                Meta<span className="text-primary">Racing</span>
              </span>
            </a>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <span>{customer.name}</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="font-racing text-3xl md:text-4xl font-bold uppercase tracking-tight text-foreground mb-1">
            Welcome, <span className="text-primary">{customer.name.split(" ")[0]}</span>
          </h1>
          <p className="text-muted-foreground">Track your races, manage bookings, and view your performance.</p>
        </div>

        {needsProfileCompletion ? (
          <Card className="border-primary/30 bg-primary/5 mb-8">
            <CardContent className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-racing text-sm uppercase tracking-widest text-primary mb-1">Profile Pending</div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  You are logged in with OTP and your tickets are active. We can collect your email, phone number, and racer experience category later without blocking bookings.
                </p>
              </div>
              <Button size="sm" asChild data-testid="button-book-more-from-banner">
                <a href="/profile">
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  Complete Profile
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild data-testid="button-book-more-from-banner-secondary">
                <a href="/book">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Book Another Session
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard icon={Calendar} label="Total Sessions" value={totalSessions} />
          <StatCard icon={Clock} label="Upcoming" value={upcomingSessions} color="text-accent" />
          <StatCard icon={Trophy} label="Best Rank" value={totalSessions > 0 ? "#4" : "—"} color="text-amber-400" />
          <StatCard icon={Star} label="MetaPoints" value={totalSessions * 50} color="text-purple-400" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Booking history */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-racing text-lg font-bold uppercase tracking-wide text-foreground">
                My Bookings
              </h2>
              <Button size="sm" asChild data-testid="button-book-new">
                <a href="/book">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Book New Session
                </a>
              </Button>
            </div>

            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-md" />
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <Card className="border-border/40 border-dashed">
                <CardContent className="p-10 flex flex-col items-center text-center gap-3">
                  <Calendar className="w-10 h-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-semibold text-foreground">No sessions yet</p>
                    <p className="text-sm text-muted-foreground">Book your first MetaRacing experience</p>
                  </div>
                  <Button size="sm" asChild>
                    <a href="/book">Book Now</a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking: any) => {
                  const ExpIcon = experienceIcons[booking.experience] || Zap;
                  const sessionState = getSessionState(booking);
                  return (
                    <Card
                      key={booking.id}
                      className="border-border/40 hover-elevate cursor-pointer"
                      data-testid={`booking-row-${booking.id}`}
                      onClick={() => openTicketDetails(booking)}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <ExpIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground capitalize">{booking.experience} Session</span>
                            <span className={`text-xs font-racing uppercase tracking-widest px-2 py-0.5 rounded-sm border ${planColors[booking.plan] || planColors.starter}`}>
                              {booking.plan}
                            </span>
                            <span
                              className="inline-flex items-center"
                              title={sessionLabels[sessionState]}
                              aria-label={sessionLabels[sessionState]}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full ${sessionDotStyles[sessionState]}`} />
                              <span className="sr-only">{sessionLabels[sessionState]}</span>
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {booking.date} · {formatSlotLabel(booking.timeSlot)} · {booking.guests} guest{Number(booking.guests) > 1 ? "s" : ""}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Quick links + profile */}
          <div className="space-y-5">
            {/* Profile card */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <h3 className="font-racing text-sm uppercase tracking-widest text-foreground">Racer Profile</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary font-racing text-xs uppercase">
                    <Trophy className="w-3 h-3 mr-1" />
                    {racerCategoryLabels[customer.experienceLevel] || racerCategoryLabels.rookie}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" asChild data-testid="button-edit-profile">
                  <a href="/profile">Edit Profile</a>
                </Button>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <h3 className="font-racing text-sm uppercase tracking-widest text-foreground">Quick Actions</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { icon: Monitor, label: "Book Simulator", href: "/book" },
                  { icon: Radio, label: "Book FPV Session", href: "/book" },
                  { icon: Users, label: "Book Squad Event", href: "/book" },
                  { icon: Trophy, label: "View Leaderboard", href: "/#leaderboard" },
                ].map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <a
                      key={action.label}
                      href={action.href}
                      data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
                      className="flex items-center gap-3 p-2.5 rounded-md border border-border/30 hover-elevate group transition-colors"
                    >
                      <ActionIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">{action.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-ticket-details">
          <DialogHeader>
            <DialogTitle className="font-racing uppercase tracking-widest">Ticket Details</DialogTitle>
            <DialogDescription>
              Please arrive 30 minutes before your slot to complete payment and in-person verification.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking ? (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Experience:</span> <span className="capitalize">{selectedBooking.experience}</span></div>
              <div><span className="text-muted-foreground">Plan:</span> <span className="capitalize">{selectedBooking.plan}</span></div>
              <div><span className="text-muted-foreground">Date:</span> {selectedBooking.date}</div>
              <div><span className="text-muted-foreground">Time Slot:</span> {formatSlotLabel(selectedBooking.timeSlot)}</div>
              <div><span className="text-muted-foreground">Guests:</span> {selectedBooking.guests}</div>
              <div><span className="text-muted-foreground">Notes:</span> {selectedBooking.message || "-"}</div>

              <div className="rounded-md border border-border/50 p-3 mt-2">
                <div className="text-xs uppercase tracking-widest font-racing text-muted-foreground mb-2">Check-In Status</div>
                {checkinLoading ? (
                  <div className="text-muted-foreground">Loading OTP status...</div>
                ) : checkinInfo ? (
                  checkinInfo.paymentDone ? (
                    <div className="text-green-400 font-semibold">
                      ✓ OTP Verified &amp; Payment Complete — Welcome to MetaRacing!
                      {checkinInfo.paymentAmount > 0 && (
                        <div className="text-xs font-normal text-muted-foreground mt-1">
                          ₹{checkinInfo.paymentAmount} received
                          {checkinInfo.paymentMode ? ` · ${checkinInfo.paymentMode.toUpperCase()}` : ""}
                        </div>
                      )}
                    </div>
                  ) : checkinInfo.otpVisible ? (
                    <>
                      <div className="text-2xl font-racing font-bold tracking-widest text-primary">{checkinInfo.otp}</div>
                      <div className="text-xs text-muted-foreground mt-1">Show this OTP at counter for verification.</div>
                    </>
                  ) : (
                    <>
                      <div className="text-muted-foreground">OTP will be visible in the last 15 minutes before your slot.</div>
                      <div className="text-xs text-amber-400 mt-1">Minutes remaining: {Math.max(checkinInfo.minutesUntilSlot, 0)}</div>
                    </>
                  )
                ) : (
                  <div className="text-muted-foreground">Unable to load check-in status right now.</div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
