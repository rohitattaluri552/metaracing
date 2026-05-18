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
import { Loader2, Eye, EyeOff, Mail, Smartphone, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;
type LoginMode = "email" | "phone";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, setAuthenticatedCustomer } = useAuth();
  const { toast } = useToast();
  const [loginMode, setLoginMode] = useState<LoginMode>("email");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [phoneName, setPhoneName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!phoneName.trim() || !phone.trim()) {
      toast({ title: "Missing details", description: "Enter your name and phone number", variant: "destructive" });
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: phoneName.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSessionId(data.sessionId);
      setMockOtp(data.mockOtp || "");
      toast({ title: "OTP sent", description: "Enter the OTP to continue" });
    } catch (err: any) {
      toast({ title: "OTP send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpSessionId || !otp.trim()) {
      toast({ title: "Missing OTP", description: "Enter OTP and verify", variant: "destructive" });
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
      if (data.customer) {
        setAuthenticatedCustomer(data.customer, data.token);
      }
      toast({ title: "Login successful", description: "Phone login verified" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "OTP verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden" data-testid="page-login">
      {/* Background */}
      <div className="absolute inset-0">
        <img src="/images/hero-bg.png" alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-background/85" />
        <div className="absolute inset-0 racing-grid opacity-10" />
      </div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <a href="/" data-testid="link-back-home">
            <img src="/images/metaracing-logo.png" alt="MetaRacing" className="h-16 w-16 object-contain mb-3" />
          </a>
          <span className="font-racing text-2xl font-bold tracking-widest uppercase glow-red text-foreground">
            Meta<span className="text-primary">Racing</span>
          </span>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <Card className="border-border/50" data-testid="login-card">
          <CardHeader className="pb-2">
            <h1 className="font-racing text-xl font-bold uppercase tracking-wide text-foreground">Welcome Back</h1>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest font-racing text-muted-foreground mb-2">Choose login method</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={loginMode === "email" ? "default" : "outline"}
                    className="font-racing uppercase tracking-wider"
                    onClick={() => setLoginMode("email")}
                    data-testid="button-login-method-email"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={loginMode === "phone" ? "default" : "outline"}
                    className="font-racing uppercase tracking-wider"
                    onClick={() => setLoginMode("phone")}
                    data-testid="button-login-method-phone"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Phone
                  </Button>
                </div>
              </div>

              {loginMode === "email" ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest font-racing">Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@example.com" {...field} data-testid="input-login-email" />
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
                                data-testid="input-login-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                data-testid="button-toggle-password"
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
                      data-testid="button-login-submit"
                    >
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {loading ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4" data-testid="phone-login-form">
                  <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Name</label>
                    <Input
                      value={phoneName}
                      onChange={(e) => setPhoneName(e.target.value)}
                      placeholder="Your full name"
                      data-testid="input-login-phone-name"
                    />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">Phone Number</label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      data-testid="input-login-phone-number"
                    />
                  </div>

                  {otpSessionId ? (
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-racing text-muted-foreground">OTP</label>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        data-testid="input-login-otp"
                      />
                      {mockOtp ? (
                        <p className="text-xs text-muted-foreground" data-testid="text-login-mock-otp">
                          Demo OTP: <span className="font-mono text-foreground">{mockOtp}</span>
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        className="w-full font-racing uppercase tracking-widest"
                        onClick={verifyOtp}
                        disabled={verifyingOtp}
                        data-testid="button-login-verify-otp"
                      >
                        {verifyingOtp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                        {verifyingOtp ? "Verifying..." : "Verify OTP"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full font-racing uppercase tracking-widest"
                      onClick={sendOtp}
                      disabled={sendingOtp}
                      data-testid="button-login-send-otp"
                    >
                      {sendingOtp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                      {sendingOtp ? "Sending OTP..." : "Send OTP"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <a href="/register" className="text-primary underline underline-offset-2 font-medium" data-testid="link-to-register">
                  Create one
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
