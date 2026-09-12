import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResourceType = "sim" | "vr" | "rc";
type ResourceStatus = "active" | "maintenance" | "inactive";

interface Resource {
  id: number;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  maxPeople: number;
  displayOrder: number;
  createdAt: string;
}

interface ResourceForm {
  name: string;
  type: ResourceType;
  maxPeople: string;
  status: ResourceStatus;
  displayOrder: string;
}

const emptyForm: ResourceForm = {
  name: "",
  type: "sim",
  maxPeople: "1",
  status: "active",
  displayOrder: "",
};

function formFromResource(resource: Resource): ResourceForm {
  return {
    name: resource.name,
    type: resource.type,
    maxPeople: String(resource.maxPeople),
    status: resource.status,
    displayOrder: String(resource.displayOrder),
  };
}

export default function AdminResourcesPage() {
  const [, navigate] = useLocation();
  const adminToken = localStorage.getItem("mr_admin_token") || "";
  const [resources, setResources] = useState<Resource[]>([]);
  const [createForm, setCreateForm] = useState<ResourceForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ResourceForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeaders = (json = false): Record<string, string> => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  });

  const loadResources = async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/resources", { headers: authHeaders() });
      const data = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("mr_admin");
        localStorage.removeItem("mr_admin_token");
        navigate("/admin");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Failed to load resources");
      setResources(data.resources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
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
    loadResources();
  }, []);

  const saveResource = async (id: number, form: ResourceForm) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          maxPeople: Number(form.maxPeople),
          status: form.status,
          displayOrder: Number(form.displayOrder),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update resource");
      setResources((current) => current.map((resource) => resource.id === id ? data : resource));
      setEditingId(null);
      setMessage("Resource updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update resource");
    } finally {
      setSaving(false);
    }
  };

  const createResource = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          name: createForm.name,
          type: createForm.type,
          maxPeople: Number(createForm.maxPeople),
          ...(createForm.displayOrder.trim() ? { displayOrder: Number(createForm.displayOrder) } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create resource");
      setResources((current) => [...current, data].sort((a, b) => a.displayOrder - b.displayOrder));
      setCreateForm(emptyForm);
      setMessage("Resource created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create resource");
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (resource: Resource) => {
    if (!confirm(`Delete ${resource.name}? Resources referenced by bookings cannot be deleted.`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resources/${resource.id}`, { method: "DELETE", headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete resource");
      setResources((current) => current.filter((item) => item.id !== resource.id));
      setMessage("Resource deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resource");
    } finally {
      setSaving(false);
    }
  };

  if (!adminToken) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-primary" /><span className="font-racing text-lg font-bold tracking-widest uppercase">Resource <span className="text-primary">Management</span></span></div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}><ArrowLeft className="w-4 h-4 mr-2" /> Dashboard</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3"><div><h1 className="font-racing text-2xl font-bold uppercase tracking-widest">Resources</h1><p className="text-sm text-muted-foreground mt-1">Manage the database-backed resource inventory and operational status.</p></div><Button variant="outline" onClick={loadResources} disabled={refreshing}><RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh</Button></div>
        {message && <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">{message}</div>}
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <Card>
          <CardHeader><CardTitle className="font-racing uppercase tracking-widest">Add Resource</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
            <Field label="Name"><Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. VR Station 3" /></Field>
            <Field label="Type"><TypeSelect value={createForm.type} onChange={(type) => setCreateForm({ ...createForm, type })} /></Field>
            <Field label="Max People"><Input type="number" min={1} value={createForm.maxPeople} onChange={(e) => setCreateForm({ ...createForm, maxPeople: e.target.value })} /></Field>
            <Field label="Display Order"><Input type="number" min={0} value={createForm.displayOrder} onChange={(e) => setCreateForm({ ...createForm, displayOrder: e.target.value })} placeholder="Next" /></Field>
            <Button onClick={createResource} disabled={saving}><Plus className="w-4 h-4 mr-2" /> Add</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-racing uppercase tracking-widest">Resource Inventory</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : resources.length === 0 ? <div className="text-center py-8 text-muted-foreground">No resources found.</div> : (
              <div className="space-y-3">
                {resources.map((resource) => {
                  const editing = editingId === resource.id;
                  const form = editing ? editForm : formFromResource(resource);
                  return <div key={resource.id} className="border border-border/50 rounded-md p-3">
                    {editing ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
                      <Field label="Name"><Input value={form.name} onChange={(e) => setEditForm({ ...form, name: e.target.value })} /></Field>
                      <Field label="Type"><TypeSelect value={form.type} onChange={(type) => setEditForm({ ...form, type })} /></Field>
                      <Field label="Max People"><Input type="number" min={1} value={form.maxPeople} onChange={(e) => setEditForm({ ...form, maxPeople: e.target.value })} /></Field>
                      <Field label="Status"><StatusSelect value={form.status} onChange={(status) => setEditForm({ ...form, status })} /></Field>
                      <Field label="Display Order"><Input type="number" min={0} value={form.displayOrder} onChange={(e) => setEditForm({ ...form, displayOrder: e.target.value })} /></Field>
                      <div className="flex gap-2"><Button onClick={() => saveResource(resource.id, form)} disabled={saving}><Save className="w-4 h-4 mr-2" /> Save</Button><Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button></div>
                    </div> : <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1 flex-1"><div><div className="text-xs text-muted-foreground uppercase">Name</div><div className="font-medium">{resource.name}</div></div><div><div className="text-xs text-muted-foreground uppercase">Type</div><div className="uppercase">{resource.type}</div></div><div><div className="text-xs text-muted-foreground uppercase">Max People</div><div>{resource.maxPeople}</div></div><div><div className="text-xs text-muted-foreground uppercase">Status / Order</div><div className="capitalize">{resource.status} / {resource.displayOrder}</div></div></div>
                      <div className="flex gap-2"><Button variant="outline" onClick={() => { setEditingId(resource.id); setEditForm(formFromResource(resource)); }}>Edit</Button><Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteResource(resource)} disabled={saving}><Trash2 className="w-4 h-4" /></Button></div>
                    </div>}
                  </div>;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div><label className="text-xs uppercase tracking-widest font-racing text-muted-foreground mb-1 block">{label}</label>{children}</div>; }

function TypeSelect({ value, onChange }: { value: ResourceType; onChange: (value: ResourceType) => void }) { return <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value as ResourceType)}><option value="sim">SIM</option><option value="vr">VR</option><option value="rc">RC</option></select>; }

function StatusSelect({ value, onChange }: { value: ResourceStatus; onChange: (value: ResourceStatus) => void }) { return <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value as ResourceStatus)}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select>; }
