import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Save, ShieldCheck, User } from "lucide-react";

const experienceOptions = [
  {
    value: "rookie",
    title: "Rookie",
    description: "First time or still getting comfortable with sim racing.",
  },
  {
    value: "veteran",
    title: "Veteran",
    description: "You have driven before and know your way around a race setup.",
  },
];

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { customer, isLoading, setAuthenticatedCustomer } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("rookie");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate("/login");
      return;
    }
    if (customer) {
      setName(customer.name || "");
      setEmail(customer.email || "");
      setPhone(customer.phone || "");
      setExperienceLevel(customer.experienceLevel || "rookie");
    }
  }, [customer, isLoading, navigate]);

  const handleSave = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("mr_customer_token");
      const res = await fetch(`/api/customers/${customer.id}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          experienceLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }
      setAuthenticatedCustomer(data.customer);
      toast({ title: "Profile updated", description: "Your details have been saved." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  const needsProfileCompletion = customer.email.endsWith("@otp.metaracing.local");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" data-testid="page-profile">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="button-profile-back">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-racing">Racer Profile</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-racing text-2xl font-bold uppercase tracking-wide text-foreground">Complete Your Profile</h1>
                <p className="text-sm text-muted-foreground">
                  {needsProfileCompletion
                    ? "Finish your account details so future bookings use your real contact info and experience tag."
                    : "Update your contact details and racer category anytime from here."}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" data-testid="input-profile-name" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-profile-email" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" data-testid="input-profile-phone" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Racing Experience</label>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {experienceOptions.map((option) => {
                    const active = experienceLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setExperienceLevel(option.value)}
                        className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border/50 bg-muted/10 hover:border-primary/40"}`}
                        data-testid={`button-profile-experience-${option.value}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-racing text-sm uppercase tracking-widest text-foreground">{option.title}</div>
                            <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                          </div>
                          {active ? <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
              Updating your profile also updates the contact identity used for your customer-linked bookings.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/dashboard")} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} data-testid="button-profile-save">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
