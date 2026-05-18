import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const form = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: AdminLoginForm) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Login failed");
      }
      const result = await res.json();
      localStorage.setItem("mr_admin", JSON.stringify(result.admin));
      if (typeof result.token === "string") {
        localStorage.setItem("mr_admin_token", result.token);
      }
      navigate("/admin/dashboard");
    } catch (err: any) {
      toast({ title: "Access Denied", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 racing-grid opacity-10" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-red-500/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <span className="font-racing text-2xl font-bold tracking-widest uppercase text-foreground">
            Admin <span className="text-primary">Panel</span>
          </span>
          <p className="text-muted-foreground text-sm mt-1">Authorized access only</p>
        </div>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h1 className="font-racing text-xl font-bold uppercase tracking-wide text-foreground">Admin Sign In</h1>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest font-racing">Admin Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@metaracing.in" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest font-racing">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPw ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(!showPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          >
                            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full font-racing uppercase tracking-widest"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? "Verifying..." : "Access Dashboard"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center mt-4">
          <a href="/" className="text-xs text-muted-foreground">&larr; Back to MetaRacing</a>
        </p>
      </div>
    </div>
  );
}
