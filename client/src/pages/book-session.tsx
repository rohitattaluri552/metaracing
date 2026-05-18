import { useEffect } from "react";
import { useLocation } from "wouter";
import BookingSection from "@/components/BookingSection";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft } from "lucide-react";

export default function BookSessionPage() {
  const [, navigate] = useLocation();
  const { customer, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate("/login");
    }
  }, [customer, isLoading, navigate]);

  if (isLoading || !customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading booking page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}> 
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-racing">Logged In Booking</div>
        </div>
      </div>
      <BookingSection loggedInMode />
    </div>
  );
}
