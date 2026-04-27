import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  CalendarCheck,
  Users,
  IndianRupee,
  Ticket,
  LogOut,
  Loader2,
  RefreshCw,
  Clock,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Ban,
  Settings,
  XCircle,
} from "lucide-react";

interface AdminStats {
  totalBookings: number;
  activeSlots: number;
  todayBookings: number;
  todayRevenue: number;
  totalRevenue: number;
  totalUsers: number;
  recentBookings: {
    id: number;
    name: string;
    email: string;
    experience: string;
    plan: string;
    date: string;
    timeSlot: string;
    guests: string;
    status: string;
    createdAt: string | null;
  }[];
}

interface SlotMember {
  id: number;
  name: string;
  email: string;
  guests: string;
}

interface AdminSlot {
  time: string;
  bookedGuests: number;
  availableSpots: number;
  full: boolean;
  blocked?: boolean;
  maxGuests?: number;
  members: SlotMember[];
}

interface ScheduleOverride {
  date: string;
  closed: boolean;
  openTime: string;
  closeTime: string;
  maxGuestsPerSlot: number;
  blockedSlots: string;
}

interface SearchBooking {
  id: number;
  name: string;
  email: string;
  experience: string;
  plan: string;
  date: string;
  timeSlot: string;
  guests: string;
  status: string;
  createdAt: string | null;
}

function formatSlotLabel(time: string): string {
  const [h] = time.split(":");
  const hour = parseInt(h, 10);
  const endHour = hour + 1;
  const fmt = (hr: number) => {
    const ampm = hr >= 12 ? "PM" : "AM";
    const h12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
    return `${h12}:00 ${ampm}`;
  };
  return `${fmt(hour)} – ${fmt(endHour)}`;
}

const SLOT_OPTIONS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split("T")[0]);
  const [adminSlots, setAdminSlots] = useState<AdminSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookForm, setBookForm] = useState({
    name: "", email: "", phone: "", experience: "", plan: "",
    date: "", timeSlot: "", guests: "", message: "",
  });
  const [bookSlots, setBookSlots] = useState<AdminSlot[]>([]);
  const [bookSlotsLoading, setBookSlotsLoading] = useState(false);

  // Schedule management state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split("T")[0]);
  const [schedForm, setSchedForm] = useState<ScheduleOverride>({
    date: "", closed: false, openTime: "09:00", closeTime: "21:00", maxGuestsPerSlot: 5, blockedSlots: "",
  });
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [slotClosed, setSlotClosed] = useState(false);

  // Booking search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchPage, setSearchPage] = useState(1);
  const [searchResults, setSearchResults] = useState<SearchBooking[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const admin = (() => {
    try {
      const raw = localStorage.getItem("mr_admin");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!admin) {
      navigate("/admin");
      return;
    }
    fetchStats();
    fetchSlots(slotDate);
    fetchSchedule(schedDate);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("mr_admin");
          navigate("/admin");
          return;
        }
        throw new Error("Failed to load stats");
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async (date: string) => {
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/admin/slots?date=${date}`, {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminSlots(data.slots || []);
        setSlotClosed(!!data.closed);
      }
    } catch {
      setAdminSlots([]);
      setSlotClosed(false);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSlotDateChange = (newDate: string) => {
    setSlotDate(newDate);
    fetchSlots(newDate);
  };

  // Schedule override functions
  const fetchSchedule = async (date: string) => {
    setSchedLoading(true);
    try {
      const res = await fetch(`/api/admin/schedule/${date}`, {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.override) {
          setSchedForm({
            date: data.override.date,
            closed: !!data.override.closed,
            openTime: data.override.openTime || "09:00",
            closeTime: data.override.closeTime || "21:00",
            maxGuestsPerSlot: data.override.maxGuestsPerSlot ?? 5,
            blockedSlots: data.override.blockedSlots || "",
          });
        } else {
          setSchedForm({
            date, closed: false, openTime: "09:00", closeTime: "21:00", maxGuestsPerSlot: 5, blockedSlots: "",
          });
        }
      }
    } catch { /* ignore */ } finally {
      setSchedLoading(false);
    }
  };

  const handleSchedDateChange = (date: string) => {
    setSchedDate(date);
    setSchedForm((prev) => ({ ...prev, date }));
    fetchSchedule(date);
  };

  const saveSchedule = async () => {
    setSchedSaving(true);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-email": admin?.email || "" },
        body: JSON.stringify({ ...schedForm, date: schedDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save schedule");
        return;
      }
      alert("Schedule saved!");
      // Refresh slots if same date
      if (schedDate === slotDate) fetchSlots(slotDate);
    } catch {
      alert("Failed to save schedule");
    } finally {
      setSchedSaving(false);
    }
  };

  const resetSchedule = async () => {
    if (!confirm(`Reset schedule for ${schedDate} to defaults?`)) return;
    setSchedSaving(true);
    try {
      await fetch(`/api/admin/schedule/${schedDate}`, {
        method: "DELETE",
        headers: { "x-admin-email": admin?.email || "" },
      });
      setSchedForm({
        date: schedDate, closed: false, openTime: "09:00", closeTime: "21:00", maxGuestsPerSlot: 5, blockedSlots: "",
      });
      if (schedDate === slotDate) fetchSlots(slotDate);
    } catch { /* ignore */ } finally {
      setSchedSaving(false);
    }
  };

  const toggleBlockedSlot = (slot: string) => {
    setSchedForm((prev) => {
      const current = prev.blockedSlots ? prev.blockedSlots.split(",").map(s => s.trim()).filter(Boolean) : [];
      const next = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
      return { ...prev, blockedSlots: next.join(",") };
    });
  };

  // Cancel booking
  const handleCancelBooking = async (id: number) => {
    if (!confirm(`Cancel booking #${id}?`)) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${id}/cancel`, {
        method: "PATCH",
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to cancel");
        return;
      }
      fetchStats();
      fetchSlots(slotDate);
      if (searchOpen) searchBookings();
    } catch {
      alert("Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  // Search bookings
  const searchBookings = async (page = 1) => {
    setSearchLoading(true);
    setSearchPage(page);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "15" });
      if (searchQuery) params.set("q", searchQuery);
      if (searchStatus !== "all") params.set("status", searchStatus);
      const res = await fetch(`/api/admin/bookings?${params}`, {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.bookings || []);
        setSearchTotal(data.total || 0);
      }
    } catch { /* ignore */ } finally {
      setSearchLoading(false);
    }
  };

  const fetchBookSlots = async (date: string) => {
    setBookSlotsLoading(true);
    try {
      const res = await fetch(`/api/admin/slots?date=${date}`, {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setBookSlots(data.slots || []);
      }
    } catch {
      setBookSlots([]);
    } finally {
      setBookSlotsLoading(false);
    }
  };

  const handleBookFormChange = (field: string, value: string) => {
    setBookForm((prev) => ({ ...prev, [field]: value }));
    if (field === "date" && value) {
      fetchBookSlots(value);
      setBookForm((prev) => ({ ...prev, date: value, timeSlot: "" }));
    }
  };

  const handleAdminBook = async () => {
    const { name, email, experience, plan, date, timeSlot, guests } = bookForm;
    if (!name || !email || !experience || !plan || !date || !timeSlot || !guests) {
      alert("Please fill all required fields");
      return;
    }
    setBookLoading(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": admin?.email || "",
        },
        body: JSON.stringify(bookForm),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Booking failed");
        return;
      }
      // Reset form and refresh data
      setBookForm({ name: "", email: "", phone: "", experience: "", plan: "", date: "", timeSlot: "", guests: "", message: "" });
      setBookSlots([]);
      setBookFormOpen(false);
      fetchStats();
      fetchSlots(slotDate);
    } catch {
      alert("Booking failed");
    } finally {
      setBookLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mr_admin");
    navigate("/admin");
  };

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-racing text-lg font-bold tracking-widest uppercase">
              Admin <span className="text-primary">Dashboard</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchStats}>Try Again</Button>
          </div>
        ) : stats ? (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-racing uppercase tracking-widest text-muted-foreground">
                    Total Bookings
                  </CardTitle>
                  <Ticket className="w-5 h-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-racing">{stats.totalBookings}</div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-racing uppercase tracking-widest text-muted-foreground">
                    Active Slots Today
                  </CardTitle>
                  <CalendarCheck className="w-5 h-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-racing text-green-500">{stats.activeSlots}</div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-racing uppercase tracking-widest text-muted-foreground">
                    Today's Revenue
                  </CardTitle>
                  <IndianRupee className="w-5 h-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-racing text-yellow-500">
                    {"\u20B9"}{stats.todayRevenue.toLocaleString("en-IN")}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-racing uppercase tracking-widest text-muted-foreground">
                    Total Revenue
                  </CardTitle>
                  <IndianRupee className="w-5 h-5 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-racing text-emerald-500">
                    {"\u20B9"}{stats.totalRevenue.toLocaleString("en-IN")}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-racing uppercase tracking-widest text-muted-foreground">
                    Total Users
                  </CardTitle>
                  <Users className="w-5 h-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-racing text-blue-500">{stats.totalUsers}</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Bookings Table */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-racing uppercase tracking-widest text-lg">
                  Recent Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentBookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No bookings yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">ID</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Name</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Email</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Experience</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Plan</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Date</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Slot</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Guests</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Status</TableHead>
                          <TableHead className="font-racing uppercase text-xs tracking-widest">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.recentBookings.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">#{b.id}</TableCell>
                            <TableCell>{b.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{b.email}</TableCell>
                            <TableCell className="capitalize">{b.experience}</TableCell>
                            <TableCell className="capitalize">{b.plan}</TableCell>
                            <TableCell>{b.date}</TableCell>
                            <TableCell className="text-xs">{b.timeSlot ? formatSlotLabel(b.timeSlot) : "—"}</TableCell>
                            <TableCell>{b.guests}</TableCell>
                            <TableCell>
                              <Badge
                                variant={b.status === "confirmed" ? "default" : "secondary"}
                                className={
                                  b.status === "confirmed"
                                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                                    : "bg-red-600/20 text-red-400 border-red-600/30"
                                }
                              >
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {b.status === "confirmed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-600/10 h-7 px-2"
                                  onClick={() => handleCancelBooking(b.id)}
                                  disabled={cancellingId === b.id}
                                >
                                  {cancellingId === b.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" /> Cancel</>
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Slot Management */}
            <Card className="border-border/50 mt-8">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="font-racing uppercase tracking-widest text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Slot Management
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Date:</span>
                    <Input
                      type="date"
                      value={slotDate}
                      onChange={(e) => handleSlotDateChange(e.target.value)}
                      className="w-44"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : slotClosed ? (
                  <div className="text-center py-8">
                    <Ban className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 font-racing uppercase tracking-widest">Closed for this date</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {adminSlots.map((s) => {
                      const max = s.maxGuests || 5;
                      return (
                        <div
                          key={s.time}
                          className={`rounded-lg border p-4 ${
                            s.blocked
                              ? "border-gray-600/40 bg-gray-600/5 opacity-60"
                              : s.full
                                ? "border-red-600/40 bg-red-600/5"
                                : s.bookedGuests > 0
                                  ? "border-yellow-500/40 bg-yellow-500/5"
                                  : "border-green-600/40 bg-green-600/5"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-racing text-sm font-bold uppercase tracking-wide">
                              {formatSlotLabel(s.time)}
                            </span>
                            <Badge
                              className={
                                s.blocked
                                  ? "bg-gray-600/20 text-gray-400 border-gray-600/30"
                                  : s.full
                                    ? "bg-red-600/20 text-red-400 border-red-600/30"
                                    : s.bookedGuests > 0
                                      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                      : "bg-green-600/20 text-green-400 border-green-600/30"
                              }
                            >
                              {s.blocked ? "Blocked" : s.full ? "Full" : `${s.availableSpots}/${max} free`}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {s.bookedGuests} / {max} booked
                          </div>
                          {s.members.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {s.members.map((m) => (
                                <div
                                  key={m.id}
                                  className="text-xs flex items-center justify-between bg-background/50 rounded px-2 py-1"
                                >
                                  <span className="truncate mr-2">{m.name}</span>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {m.guests} guest{Number(m.guests) !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground/60 mt-2 italic">
                              {s.blocked ? "Slot blocked" : "No bookings"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Management */}
            <Card className="border-border/50 mt-8">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setScheduleOpen(!scheduleOpen)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="font-racing uppercase tracking-widest text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Schedule Overrides
                  </CardTitle>
                  {scheduleOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {scheduleOpen && (
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Date</label>
                      <Input
                        type="date"
                        value={schedDate}
                        onChange={(e) => handleSchedDateChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Open Time</label>
                      <Input
                        type="time"
                        value={schedForm.openTime}
                        onChange={(e) => setSchedForm((p) => ({ ...p, openTime: e.target.value }))}
                        disabled={schedForm.closed}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Close Time</label>
                      <Input
                        type="time"
                        value={schedForm.closeTime}
                        onChange={(e) => setSchedForm((p) => ({ ...p, closeTime: e.target.value }))}
                        disabled={schedForm.closed}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Max Guests/Slot</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={schedForm.maxGuestsPerSlot}
                        onChange={(e) => setSchedForm((p) => ({ ...p, maxGuestsPerSlot: Number(e.target.value || 1) }))}
                        disabled={schedForm.closed}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={schedForm.closed ? "destructive" : "outline"}
                      onClick={() => setSchedForm((p) => ({ ...p, closed: !p.closed }))}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      {schedForm.closed ? "Closed Date" : "Mark Date Closed"}
                    </Button>
                    {schedLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>

                  {!schedForm.closed && (
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">
                        Block Individual Slots
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                        {SLOT_OPTIONS.map((slot) => {
                          const blocked = (schedForm.blockedSlots || "")
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean)
                            .includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => toggleBlockedSlot(slot)}
                              className={`px-2 py-2 rounded-md border text-xs font-racing uppercase tracking-wide ${
                                blocked
                                  ? "border-red-500/50 bg-red-500/10 text-red-300"
                                  : "border-border/50 hover:border-primary/50"
                              }`}
                            >
                              {formatSlotLabel(slot)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button onClick={saveSchedule} disabled={schedSaving}>
                      {schedSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Override
                    </Button>
                    <Button variant="outline" onClick={resetSchedule} disabled={schedSaving}>
                      Reset To Defaults
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Booking Search & Filter */}
            <Card className="border-border/50 mt-8">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => {
                  const nextOpen = !searchOpen;
                  setSearchOpen(nextOpen);
                  if (nextOpen) searchBookings(1);
                }}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="font-racing uppercase tracking-widest text-lg flex items-center gap-2">
                    <Search className="w-5 h-5 text-primary" />
                    Search Bookings
                  </CardTitle>
                  {searchOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {searchOpen && (
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Input
                      placeholder="Search by name, email, or date"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Select value={searchStatus} onValueChange={setSearchStatus}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => searchBookings(1)} disabled={searchLoading}>
                      {searchLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                      Search
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">{searchTotal} result(s)</div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Slot</TableHead>
                          <TableHead>Guests</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">#{b.id}</TableCell>
                            <TableCell>{b.name}</TableCell>
                            <TableCell>{b.email}</TableCell>
                            <TableCell>{b.date}</TableCell>
                            <TableCell>{b.timeSlot ? formatSlotLabel(b.timeSlot) : "-"}</TableCell>
                            <TableCell>{b.guests}</TableCell>
                            <TableCell>
                              <Badge
                                variant={b.status === "confirmed" ? "default" : "secondary"}
                                className={
                                  b.status === "confirmed"
                                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                                    : "bg-red-600/20 text-red-400 border-red-600/30"
                                }
                              >
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {b.status === "confirmed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-600/10 h-7 px-2"
                                  onClick={() => handleCancelBooking(b.id)}
                                  disabled={cancellingId === b.id}
                                >
                                  {cancellingId === b.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" /> Cancel</>
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!searchLoading && searchResults.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                              No bookings found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={() => searchBookings(Math.max(1, searchPage - 1))}
                      disabled={searchPage <= 1 || searchLoading}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {searchPage}</span>
                    <Button
                      variant="outline"
                      onClick={() => searchBookings(searchPage + 1)}
                      disabled={searchLoading || searchResults.length < 15}
                    >
                      Next
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Admin Book Ticket */}
            <Card className="border-border/50 mt-8">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setBookFormOpen(!bookFormOpen)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="font-racing uppercase tracking-widest text-lg flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-primary" />
                    Book Ticket
                  </CardTitle>
                  {bookFormOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {bookFormOpen && (
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Name *</label>
                      <Input
                        placeholder="Customer name"
                        value={bookForm.name}
                        onChange={(e) => handleBookFormChange("name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Email *</label>
                      <Input
                        type="email"
                        placeholder="customer@example.com"
                        value={bookForm.email}
                        onChange={(e) => handleBookFormChange("email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Phone</label>
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={bookForm.phone}
                        onChange={(e) => handleBookFormChange("phone", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Date *</label>
                      <Input
                        type="date"
                        value={bookForm.date}
                        onChange={(e) => handleBookFormChange("date", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Slot picker for admin booking */}
                  {bookForm.date && (
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Time Slot *</label>
                      {bookSlotsLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Loading slots...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-1">
                          {bookSlots.map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              onClick={() => handleBookFormChange("timeSlot", s.time)}
                              className={`px-2 py-2 rounded-md border text-xs font-racing uppercase tracking-wide transition-all ${
                                bookForm.timeSlot === s.time
                                  ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                                  : "border-border/50 hover:border-primary/50 text-foreground"
                              }`}
                            >
                              <div>{formatSlotLabel(s.time)}</div>
                              <div className="text-[10px] mt-0.5 text-muted-foreground">
                                {s.bookedGuests} booked
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Experience *</label>
                      <Select value={bookForm.experience} onValueChange={(v) => handleBookFormChange("experience", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Racing Simulator</SelectItem>
                          <SelectItem value="fpv">FPV Arena</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Plan *</label>
                      <Select value={bookForm.plan} onValueChange={(v) => handleBookFormChange("plan", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter (30 min)</SelectItem>
                          <SelectItem value="racer">Racer (1 hour)</SelectItem>
                          <SelectItem value="champion">Champion (2 hours)</SelectItem>
                          <SelectItem value="squad">Squad (Group)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Guests *</label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Number of guests"
                        value={bookForm.guests}
                        onChange={(e) => handleBookFormChange("guests", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Message (optional)</label>
                    <Textarea
                      placeholder="Any notes..."
                      className="resize-none"
                      rows={2}
                      value={bookForm.message}
                      onChange={(e) => handleBookFormChange("message", e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full font-racing uppercase tracking-widest"
                    onClick={handleAdminBook}
                    disabled={bookLoading}
                  >
                    {bookLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Booking...</>
                    ) : (
                      <><PlusCircle className="w-4 h-4 mr-2" /> Book Ticket</>
                    )}
                  </Button>
                </CardContent>
              )}
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
