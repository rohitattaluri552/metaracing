import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, ChevronRight, Loader2, Mail, Phone, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  experienceLevel: string;
  createdAt: string;
  totalBookings: number;
  lastBookingDate: string | null;
}

interface Booking {
  id: number;
  experience: string;
  plan: string;
  date: string;
  timeSlot: string;
  startTime: string | null;
  endTime: string | null;
  partySize: number;
  guests: string;
  status: string;
  paymentStatus: string;
  paymentAmount: number | null;
  resourceName: string | null;
}

const formatDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "-";
const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminCustomersPage() {
  const [, navigate] = useLocation();
  const adminToken = localStorage.getItem("mr_admin_token") || "";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = (): Record<string, string> => adminToken ? { Authorization: `Bearer ${adminToken}` } : {};

  const loadCustomers = async (query = search) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/customers?search=${encodeURIComponent(query)}`, { headers: authHeaders() });
      const data = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("mr_admin");
        localStorage.removeItem("mr_admin_token");
        navigate("/admin");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Failed to load customers");
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomer = async (customer: Customer) => {
    setSelected(customer);
    setDetailLoading(true);
    setError("");
    try {
      const [customerResponse, bookingsResponse] = await Promise.all([
        fetch(`/api/admin/customers/${customer.id}`, { headers: authHeaders() }),
        fetch(`/api/admin/customers/${customer.id}/bookings`, { headers: authHeaders() }),
      ]);
      const customerData = await customerResponse.json();
      const bookingsData = await bookingsResponse.json();
      if (customerResponse.status === 401 || bookingsResponse.status === 401) {
        localStorage.removeItem("mr_admin");
        localStorage.removeItem("mr_admin_token");
        navigate("/admin");
        return;
      }
      if (!customerResponse.ok || !bookingsResponse.ok) throw new Error(customerData.error || bookingsData.error || "Failed to load customer history");
      setSelected(customerData.customer);
      setBookings(bookingsData.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer history");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!adminToken || !localStorage.getItem("mr_admin")) {
      navigate("/admin");
      return;
    }
    loadCustomers("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadCustomers(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  if (!adminToken) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-primary" /><span className="font-racing text-lg font-bold tracking-widest uppercase">Admin <span className="text-primary">Customers</span></span></div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}><ArrowLeft className="w-4 h-4 mr-2" /> Dashboard</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div><h1 className="font-racing text-2xl font-bold uppercase tracking-widest">Customers</h1><p className="text-sm text-muted-foreground mt-1">Linked customer accounts and their complete booking history.</p></div>
          <Button variant="outline" onClick={() => loadCustomers()} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-6 items-start">
          <Card>
            <CardHeader className="space-y-4"><CardTitle className="font-racing uppercase tracking-widest flex items-center gap-2"><UserRound className="w-5 h-5 text-primary" /> Customer Directory</CardTitle><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone" /></div></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : customers.length === 0 ? <div className="text-center py-12 px-4 text-muted-foreground">No customers match this search.</div> : <div className="divide-y divide-border/50">{customers.map((customer) => <button key={customer.id} className={`w-full text-left p-4 hover:bg-muted/40 transition-colors ${selected?.id === customer.id ? "bg-muted/50 border-l-2 border-primary" : ""}`} onClick={() => loadCustomer(customer)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-medium truncate">{customer.name}</div><div className="text-sm text-muted-foreground truncate">{customer.email}</div><div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground"><span>{customer.totalBookings} booking{customer.totalBookings === 1 ? "" : "s"}</span><span>Last: {formatDate(customer.lastBookingDate)}</span></div></div><ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground mt-1" /></div></button>)}</div>}
            </CardContent>
          </Card>

          <Card>
            {!selected ? <div className="flex flex-col items-center justify-center min-h-[360px] p-8 text-center text-muted-foreground"><UserRound className="w-10 h-10 mb-3 text-primary/70" /><p>Select a customer to view details and booking history.</p></div> : <>
              <CardHeader><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><CardTitle className="font-racing uppercase tracking-widest">{selected.name}</CardTitle><div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{selected.email}</span>{selected.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selected.phone}</span>}</div></div><Badge variant="secondary">{titleCase(selected.experienceLevel)}</Badge></div></CardHeader>
              <CardContent className="space-y-6">{detailLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : <><div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm"><div className="border border-border/50 rounded-md p-3"><div className="text-xs text-muted-foreground uppercase">Registered</div><div className="mt-1">{formatDateTime(selected.createdAt)}</div></div><div className="border border-border/50 rounded-md p-3"><div className="text-xs text-muted-foreground uppercase">Total Bookings</div><div className="mt-1 text-lg font-semibold">{selected.totalBookings}</div></div><div className="border border-border/50 rounded-md p-3"><div className="text-xs text-muted-foreground uppercase">Last Visit</div><div className="mt-1">{formatDate(selected.lastBookingDate)}</div></div></div>
                <div><h2 className="font-racing text-lg uppercase tracking-widest mb-3 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> Booking History</h2>{bookings.length === 0 ? <p className="text-sm text-muted-foreground py-6">No linked bookings found.</p> : <div className="space-y-3">{bookings.map((booking) => <div key={booking.id} className="border border-border/50 rounded-md p-3 text-sm"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2"><div><div className="font-medium">{formatDate(booking.date)} <span className="text-muted-foreground">{booking.startTime || booking.timeSlot || "Time unavailable"}{booking.endTime ? ` - ${booking.endTime}` : ""}</span></div><div className="text-muted-foreground mt-1">{titleCase(booking.experience)}{booking.resourceName ? ` / ${booking.resourceName}` : ""} · Party of {booking.partySize || Number(booking.guests) || 1} · {titleCase(booking.plan)}</div></div><div className="flex gap-2"><Badge variant="outline">{titleCase(booking.status)}</Badge><Badge variant="secondary">{titleCase(booking.paymentStatus || "pending")} · ₹{booking.paymentAmount ?? 0}</Badge></div></div></div>)}</div>}</div>
              </>}</CardContent>
            </>}
          </Card>
        </div>
      </main>
    </div>
  );
}
