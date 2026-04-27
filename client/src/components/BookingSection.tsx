import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Phone, Mail, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const validExperiences = ["sim", "fpv", "both"] as const;
const validPlans = ["starter", "racer", "champion", "squad"] as const;

const bookingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email").transform(v => v.trim().toLowerCase()),
  phone: z.string().optional().default(""),
  experience: z.enum(validExperiences, { errorMap: () => ({ message: "Please select a valid experience" }) }),
  plan: z.enum(validPlans, { errorMap: () => ({ message: "Please select a valid plan" }) }),
  date: z.string().min(1, "Please select a date").refine((val) => {
    const selected = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected >= today;
  }, "Date must be today or in the future"),
  timeSlot: z.string().min(1, "Please select a time slot"),
  guests: z.string().min(1, "Please select number of guests").refine((val) => {
    const n = Number(val);
    return !isNaN(n) && n >= 1 && n <= 5;
  }, "Guests must be between 1 and 5"),
  message: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface SlotInfo {
  time: string;
  bookedGuests: number;
  availableSpots: number;
  full: boolean;
  blocked?: boolean;
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

const contactInfo = [
  { icon: MapPin, label: "Location", value: "MetaRacing Arena, Tech Park, Bangalore" },
  { icon: Clock, label: "Hours", value: "Mon–Sun: 9:00 AM – 9:00 PM" },
  { icon: Phone, label: "Phone", value: "+91 98765 43210" },
  { icon: Mail, label: "Email", value: "race@metaracing.in" },
];

export default function BookingSection() {
  const { toast } = useToast();
  const { customer } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dateClosed, setDateClosed] = useState(false);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      experience: "both",
      plan: "squad",
      date: "",
      timeSlot: "",
      guests: "",
      message: "",
    },
  });

  const selectedDate = form.watch("date");

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setDateClosed(false);
      form.setValue("timeSlot", "");
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/slots?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots || []);
          setDateClosed(!!data.closed);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setDateClosed(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    form.setValue("timeSlot", "");
    return () => { cancelled = true; };
  }, [selectedDate]);

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      return apiRequest("POST", "/api/bookings", {
        ...data,
        customerId: customer?.id ?? null,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
      setSlots([]);
       toast({
        title: "Booking Received!",
        description: "We'll confirm your session shortly via email.",
      });
    },
    onError: () => {
      toast({
        title: "Booking Failed",
        description: "There was an issue with your booking. Please try again.",
        variant: "destructive",
      });
      setSubmitted(true);
      form.reset();
    },
  });

  const onSubmit = (data: BookingFormData) => {
    bookingMutation.mutate(data);
  };

  return (
    <section id="booking" className="py-24 relative overflow-hidden" data-testid="section-booking">
      <div className="absolute top-0 left-0 right-0 h-px neon-divider opacity-40" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
          <Badge variant="outline" className="border-primary/40 text-primary font-racing text-xs tracking-widest uppercase mb-4">
            Book A Session
          </Badge>
          <h2 className="font-racing text-4xl md:text-5xl font-bold uppercase tracking-tight text-foreground mb-4">
            Start Your <span className="text-primary">Engine</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            Reserve your spot at MetaRacing. We'll confirm your booking within 30 minutes.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact info */}
          <div className="lg:col-span-1">
            <div className="space-y-4 mb-8">
              {contactInfo.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-4 p-4 rounded-md border border-border/40 hover-elevate" data-testid={`contact-info-${item.label.toLowerCase()}`}>
                    <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-racing">{item.label}</div>
                      <div className="text-sm font-medium text-foreground mt-0.5">{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Track image */}
            <div className="relative rounded-md overflow-hidden aspect-video">
              <img
                src="/images/steering-wheel.png"
                alt="Racing equipment"
                className="w-full h-full object-cover"
                data-testid="img-steering-wheel"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <Badge className="bg-primary text-primary-foreground font-racing text-xs uppercase tracking-widest">
                  Pro Equipment
                </Badge>
              </div>
            </div>
          </div>

          {/* Form */}
          <Card className="lg:col-span-2 border-border/50" data-testid="booking-form-card">
            <CardContent className="p-6 md:p-8">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="booking-success">
                  <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 animate-pulse-glow">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-racing text-2xl font-bold uppercase text-foreground mb-2">Booking Confirmed!</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Your session request has been received. We'll send a confirmation to your email within 30 minutes.
                  </p>
                  <Button className="mt-6" onClick={() => setSubmitted(false)} data-testid="button-book-another">
                    Book Another Session
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="booking-form">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your name" {...field} data-testid="input-name" />
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
                              <Input type="email" placeholder="you@example.com" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Phone</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+91 98765 43210" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Preferred Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Time Slot Picker */}
                    {selectedDate && (
                      <FormField
                        control={form.control}
                        name="timeSlot"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Time Slot</FormLabel>
                            {slotsLoading ? (
                              <div className="flex items-center gap-2 py-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Loading slots...</span>
                              </div>
                            ) : dateClosed ? (
                              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                This date is closed for bookings. Please choose another date.
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {slots.map((s) => (
                                  <button
                                    key={s.time}
                                    type="button"
                                    disabled={s.full}
                                    onClick={() => field.onChange(s.time)}
                                    className={`px-2 py-2 rounded-md border text-xs font-racing uppercase tracking-wide transition-all ${
                                      s.full
                                        ? "border-border/30 bg-muted/30 text-muted-foreground cursor-not-allowed line-through opacity-50"
                                        : field.value === s.time
                                          ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                                          : "border-border/50 hover:border-primary/50 text-foreground"
                                    }`}
                                  >
                                    <div>{formatSlotLabel(s.time)}</div>
                                    <div className={`text-[10px] mt-0.5 ${s.full ? "text-red-400" : "text-green-400"}`}>
                                      {s.full ? "Full" : `${s.availableSpots} left`}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="experience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Experience</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-experience">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sim">Racing Simulator</SelectItem>
                                <SelectItem value="fpv">FPV Arena</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="plan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Plan</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-plan">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="starter">Starter (30 min)</SelectItem>
                                <SelectItem value="racer">Racer (1 hour)</SelectItem>
                                <SelectItem value="champion">Champion (2 hours)</SelectItem>
                                <SelectItem value="squad">Squad (Group)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="guests"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest font-racing">Guests</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-guests">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">1 person</SelectItem>
                                <SelectItem value="2">2 people</SelectItem>
                                <SelectItem value="3">3 people</SelectItem>
                                <SelectItem value="4">4 people</SelectItem>
                                <SelectItem value="5">5 people</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest font-racing">Special Requests (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any special requests, accessibility needs, or questions..."
                              className="resize-none"
                              rows={3}
                              {...field}
                              data-testid="input-message"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full font-racing uppercase tracking-widest text-sm"
                      size="lg"
                      disabled={bookingMutation.isPending}
                      data-testid="button-submit-booking"
                    >
                      {bookingMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Confirm Booking"
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
