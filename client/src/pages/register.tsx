import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: z.string().email("Enter a valid email").transform(v => v.trim().toLowerCase()),
  phone: z.string().optional().default(""),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      await register(data.name, data.email, data.phone, data.password);
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden" data-testid="page-register">
      <div className="absolute inset-0">
        <img src="/images/fpv-arena.png" alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-background/85" />
        <div className="absolute inset-0 racing-grid opacity-10" />
      </div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-8">
          <a href="/" data-testid="link-back-home">
            <img src="/images/metaracing-logo.png" alt="MetaRacing" className="h-16 w-16 object-contain mb-3" />
          </a>
          <span className="font-racing text-2xl font-bold tracking-widest uppercase glow-red text-foreground">
            Meta<span className="text-primary">Racing</span>
          </span>
          <p className="text-muted-foreground text-sm mt-1">Create your racer profile</p>
        </div>

        <Card className="border-border/50" data-testid="register-card">
          <CardHeader className="pb-2">
            <h1 className="font-racing text-xl font-bold uppercase tracking-wide text-foreground">Join MetaRacing</h1>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest font-racing">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} data-testid="input-register-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest font-racing">Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} data-testid="input-register-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest font-racing">Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="9876543210" {...field} data-testid="input-register-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
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
                              data-testid="input-register-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw(!showPw)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                              {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest font-racing">Confirm</FormLabel>
                        <FormControl>
                          <Input
                            type={showPw ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-register-confirm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full font-racing uppercase tracking-widest"
                  disabled={loading}
                  data-testid="button-register-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </Form>

            <div className="mt-5 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href="/login" className="text-primary underline underline-offset-2 font-medium" data-testid="link-to-login">
                  Sign in
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center mt-4">
          <a href="/" className="text-xs text-muted-foreground" data-testid="link-back-home-bottom">
            &larr; Back to MetaRacing
          </a>
        </p>
      </div>
    </div>
  );
}
