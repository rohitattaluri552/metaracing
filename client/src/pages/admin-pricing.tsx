import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Plus, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PricingEntry {
  id: number;
  experienceType: string;
  resourceCategory: string | null;
  durationMinutes: number;
  price: number;
  active: boolean;
}

interface OfferEntry {
  id: number;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  experienceType: "sim" | "vr" | "rc";
  resourceCategory: string | null;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  marketingText: string;
}

type OfferForm = Omit<OfferEntry, "id">;

const emptyOffer: OfferForm = {
  name: "",
  discountType: "percentage",
  discountValue: 10,
  experienceType: "sim",
  resourceCategory: null,
  active: true,
  startDate: null,
  endDate: null,
  marketingText: "",
};

function categoryLabel(category: string | null): string {
  if (category === "single_screen") return "Single Screen";
  if (category === "triple_screen") return "Triple Screen";
  return "All resources";
}

export default function AdminPricingPage() {
  const [, navigate] = useLocation();
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [offers, setOffers] = useState<OfferEntry[]>([]);
  const [offerDraft, setOfferDraft] = useState<OfferForm>(emptyOffer);
  const [editingOfferId, setEditingOfferId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const adminToken = localStorage.getItem("mr_admin_token") || "";
  const authHeaders = (json = false): Record<string, string> => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [pricingResponse, offersResponse] = await Promise.all([
        fetch("/api/admin/pricing", { headers: authHeaders() }),
        fetch("/api/admin/offers", { headers: authHeaders() }),
      ]);
      if (!pricingResponse.ok || !offersResponse.ok) throw new Error("Unable to load pricing and offers");
      const pricingData = await pricingResponse.json();
      const offersData = await offersResponse.json();
      setPricing(pricingData.pricing || []);
      setOffers(offersData.offers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pricing and offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminToken || !localStorage.getItem("mr_admin")) {
      navigate("/admin");
      return;
    }
    load();
  }, []);

  const savePricing = async (entry: PricingEntry) => {
    setSavingId(`pricing-${entry.id}`);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/pricing/${entry.id}`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ price: entry.price, active: entry.active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save pricing");
      setPricing((current) => current.map((item) => item.id === entry.id ? data : item));
      setMessage("Pricing saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pricing");
    } finally {
      setSavingId(null);
    }
  };

  const saveOffer = async (offer: OfferForm, id?: number) => {
    setSavingId(id ? `offer-${id}` : "offer-new");
    setMessage("");
    setError("");
    try {
      const response = await fetch(id ? `/api/admin/offers/${id}` : "/api/admin/offers", {
        method: id ? "PATCH" : "POST",
        headers: authHeaders(true),
        body: JSON.stringify(offer),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save offer");
      if (id) setOffers((current) => current.map((item) => item.id === id ? data : item));
      else {
        setOffers((current) => [...current, data]);
        setOfferDraft(emptyOffer);
      }
      setEditingOfferId(null);
      setMessage("Offer saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save offer");
    } finally {
      setSavingId(null);
    }
  };

  if (!adminToken) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-racing text-lg font-bold tracking-widest uppercase">Pricing <span className="text-primary">& Offers</span></span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
        {message && <p className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">{message}</p>}
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="font-racing uppercase tracking-widest">Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pricing.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_110px_auto] gap-3 items-center border-b border-border/40 pb-3 last:border-0">
                    <div>
                      <div className="font-medium uppercase">{entry.experienceType} · {categoryLabel(entry.resourceCategory)}</div>
                      <div className="text-sm text-muted-foreground">{entry.durationMinutes} minutes</div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={entry.price}
                      onChange={(event) => setPricing((current) => current.map((item) => item.id === entry.id ? { ...item, price: Number(event.target.value) } : item))}
                      aria-label="Price in INR"
                    />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={entry.active} onChange={(event) => setPricing((current) => current.map((item) => item.id === entry.id ? { ...item, active: event.target.checked } : item))} /> Active</label>
                    <Button onClick={() => savePricing(entry)} disabled={savingId === `pricing-${entry.id}`}>
                      {savingId === `pricing-${entry.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-racing uppercase tracking-widest">Offers</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {offers.map((offer) => {
                  const editing = editingOfferId === offer.id;
                  const current = editing ? offer : null;
                  return (
                    <div key={offer.id} className="border-b border-border/40 pb-5 last:border-0 space-y-3">
                      {editing && current ? (
                        <OfferFields value={current} onChange={(value) => setOffers((all) => all.map((item) => item.id === offer.id ? { ...item, ...value } : item))} />
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div><div className="font-medium">{offer.name}</div><div className="text-sm text-muted-foreground">{offer.discountValue}{offer.discountType === "percentage" ? "%" : " INR"} · {offer.experienceType.toUpperCase()} · {offer.active ? "Active" : "Inactive"}</div><div className="text-sm text-muted-foreground">{offer.marketingText}</div></div>
                          <Button variant="outline" onClick={() => setEditingOfferId(offer.id)}>Edit</Button>
                        </div>
                      )}
                      {editing && current && <div className="flex gap-2"><Button onClick={() => saveOffer(current, offer.id)} disabled={savingId === `offer-${offer.id}`}><Save className="w-4 h-4 mr-2" /> Save</Button><Button variant="outline" onClick={() => setEditingOfferId(null)}>Cancel</Button></div>}
                    </div>
                  );
                })}

                <div className="border border-dashed border-border/60 rounded-md p-4 space-y-3">
                  <div className="font-racing uppercase tracking-widest text-sm">Create Offer</div>
                  <OfferFields value={offerDraft} onChange={(value) => setOfferDraft((current) => ({ ...current, ...value }))} />
                  <Button onClick={() => saveOffer(offerDraft)} disabled={savingId === "offer-new"}><Plus className="w-4 h-4 mr-2" /> Create Offer</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function OfferFields({ value, onChange }: { value: OfferForm; onChange: (value: Partial<OfferForm>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input placeholder="Offer name" value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
      <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={value.discountType} onChange={(e) => onChange({ discountType: e.target.value as OfferForm["discountType"] })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select>
      <Input type="number" min={1} placeholder="Discount value" value={value.discountValue} onChange={(e) => onChange({ discountValue: Number(e.target.value) })} />
      <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={value.experienceType} onChange={(e) => onChange({ experienceType: e.target.value as OfferForm["experienceType"] })}><option value="sim">SIM Racing</option><option value="vr">VR Experience</option><option value="rc">RC Racing</option></select>
      <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={value.resourceCategory || "all"} onChange={(e) => onChange({ resourceCategory: e.target.value === "all" ? null : e.target.value })}><option value="all">All categories</option><option value="single_screen">Single Screen</option><option value="triple_screen">Triple Screen</option></select>
      <Input type="date" value={value.startDate || ""} onChange={(e) => onChange({ startDate: e.target.value || null })} />
      <Input type="date" value={value.endDate || ""} onChange={(e) => onChange({ endDate: e.target.value || null })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.active} onChange={(e) => onChange({ active: e.target.checked })} /> Active</label>
      <Textarea className="sm:col-span-2" rows={2} placeholder="Marketing text" value={value.marketingText} onChange={(e) => onChange({ marketingText: e.target.value })} />
    </div>
  );
}
