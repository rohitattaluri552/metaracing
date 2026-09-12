import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, Clock, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Resource {
  id: number;
  name: string;
  type: "sim" | "vr" | "rc";
  status: "active" | "maintenance" | "inactive";
  maxPeople: number;
}

interface ResourceBooking {
  id: number;
  resourceId: number;
  customerName: string;
  partySize: number;
  startTime: string;
  endTime: string;
  status: string;
}

type DisplayStatus = "available" | "occupied" | "maintenance" | "inactive";

function localDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function statusClasses(status: DisplayStatus): string {
  if (status === "occupied") return "border-red-500/50 bg-red-500/10 text-red-300";
  if (status === "maintenance") return "border-amber-500/50 bg-amber-500/10 text-amber-300";
  if (status === "inactive") return "border-slate-500/50 bg-slate-500/10 text-slate-300";
  return "border-green-500/50 bg-green-500/10 text-green-300";
}

function statusLabel(status: DisplayStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminResourceAvailabilityPage() {
  const [, navigate] = useLocation();
  const adminToken = localStorage.getItem("mr_admin_token") || "";
  const [date, setDate] = useState(localDateString);
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<ResourceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const loadAvailability = async (selectedDate = date) => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/resource-availability?date=${encodeURIComponent(selectedDate)}`, { headers: authHeaders });
      const data = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("mr_admin");
        localStorage.removeItem("mr_admin_token");
        navigate("/admin");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Failed to load resource availability");
      setResources(data.resources || []);
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resource availability");
      setResources([]);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!adminToken || !localStorage.getItem("mr_admin")) {
      navigate("/admin");
      return;
    }
    loadAvailability();
  }, []);

  const today = localDateString();
  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, [resources, bookings]);

  const resourceRows = resources.map((resource) => {
    const resourceBookings = bookings
      .filter((booking) => booking.resourceId === resource.id)
      .sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0));
    const currentBooking = date === today
      ? resourceBookings.find((booking) => {
        const start = timeToMinutes(booking.startTime);
        const end = timeToMinutes(booking.endTime);
        return start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
      })
      : undefined;
    const status: DisplayStatus = resource.status === "maintenance"
      ? "maintenance"
      : resource.status === "inactive"
        ? "inactive"
        : currentBooking
          ? "occupied"
          : "available";
    const endMinutes = currentBooking ? timeToMinutes(currentBooking.endTime) : null;
    const remainingMinutes = endMinutes === null ? null : Math.max(0, endMinutes - nowMinutes);
    return { resource, resourceBookings, currentBooking, remainingMinutes, status };
  });

  if (!adminToken) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-racing text-lg font-bold tracking-widest uppercase">Resource <span className="text-primary">Availability</span></span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-racing text-2xl font-bold uppercase tracking-widest">Live Resource View</h1>
            <p className="text-sm text-muted-foreground mt-1">Inspect resource state and confirmed bookings for a selected date.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Date</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input type="date" value={date} onChange={(event) => { setDate(event.target.value); loadAvailability(event.target.value); }} className="pl-9" />
              </div>
            </div>
            <Button variant="outline" onClick={() => loadAvailability()} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : resourceRows.length === 0 ? (
          <div className="rounded-md border border-border/50 p-8 text-center text-muted-foreground">No resources found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {resourceRows.map(({ resource, resourceBookings, currentBooking, remainingMinutes, status }) => (
              <Card key={resource.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-racing text-lg uppercase">{resource.name}</CardTitle>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{resource.type} · Capacity {resource.maxPeople}</div>
                    </div>
                    <Badge variant="outline" className={statusClasses(status)}>{statusLabel(status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentBooking ? (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-1.5 text-sm">
                      <div className="font-medium">{currentBooking.customerName}</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Users className="w-3.5 h-3.5" /> {currentBooking.partySize} people</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-3.5 h-3.5" /> {currentBooking.startTime}–{currentBooking.endTime}</div>
                      {remainingMinutes !== null && <div className="text-xs text-red-200">About {remainingMinutes} minutes remaining</div>}
                    </div>
                  ) : resource.status === "maintenance" ? (
                    <div className="text-sm text-amber-300">Unavailable for bookings while under maintenance.</div>
                  ) : resource.status === "inactive" ? (
                    <div className="text-sm text-slate-300">Inactive resource; unavailable for bookings.</div>
                  ) : (
                    <div className="text-sm text-green-300">No booking currently occupying this resource.</div>
                  )}

                  {resourceBookings.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Confirmed bookings on {date}</div>
                      {resourceBookings.map((booking) => (
                        <div key={booking.id} className="border-t border-border/40 pt-2 text-sm">
                          <div className="flex justify-between gap-2"><span>{booking.customerName}</span><span className="text-muted-foreground">{booking.status}</span></div>
                          <div className="text-muted-foreground">{booking.startTime}–{booking.endTime} · {booking.partySize} people</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
