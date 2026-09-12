import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, Monitor, Radio, Zap } from "lucide-react";

const raceMenu = [
  {
    number: "01",
    type: "sim",
    name: "SIM RACING",
    icon: Monitor,
    accentClass: "text-primary",
    borderClass: "border-primary/50 glow-border-red",
    durations: [
      { label: "30 mins", prices: ["Single Screen ₹300", "Triple Screen ₹350"] },
      { label: "1 hour", prices: ["Single Screen ₹500", "Triple Screen ₹600"] },
    ],
    offer: "LAUNCH OFFER · 20% OFF ON SIM RACING ONLY · LIMITED TIME ONLY",
  },
  {
    number: "02",
    type: "rc",
    name: "RC CAR RACING",
    icon: Radio,
    accentClass: "text-accent",
    borderClass: "border-accent/40 glow-border-cyan",
    durations: [{ label: "20 mins", prices: ["₹180"] }],
  },
  {
    number: "03",
    type: "vr",
    name: "VR EXPERIENCE",
    icon: Zap,
    accentClass: "text-amber-400",
    borderClass: "border-amber-500/50",
    durations: [{ label: "15 mins", prices: ["₹180"] }],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden" data-testid="section-pricing">
      <div className="absolute top-0 left-0 right-0 h-px neon-divider opacity-40" />
      <div className="absolute inset-0 pointer-events-none checkered-bg opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
          <Badge variant="outline" className="border-primary/40 text-primary font-racing text-xs tracking-widest uppercase mb-4">
            Race Menu
          </Badge>
          <h2 className="font-racing text-4xl md:text-5xl font-bold uppercase tracking-tight text-foreground mb-4">
            Choose Your <span className="text-primary">Experience</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            Transparent pricing for every kind of racer. All prices are in INR.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {raceMenu.map((experience) => {
            const Icon = experience.icon;
            return (
              <Card key={experience.type} className={`relative border ${experience.borderClass} bg-card transition-transform duration-200`} data-testid={`pricing-card-${experience.type}`}>
                <CardHeader className="pb-2 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-md border border-border/40 bg-secondary flex items-center justify-center ${experience.accentClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`font-racing text-2xl font-bold ${experience.accentClass}`}>{experience.number}</span>
                  </div>
                  <div className="font-racing text-xl font-bold uppercase tracking-wide text-foreground">{experience.name}</div>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="space-y-4 mb-6">
                    {experience.durations.map((duration) => (
                      <div key={duration.label} className="rounded-md border border-border/40 p-3">
                        <div className="flex items-center gap-1.5 text-sm font-racing uppercase tracking-widest text-muted-foreground mb-2">
                          <Clock className="w-3.5 h-3.5" />
                          {duration.label}
                        </div>
                        <div className="space-y-1">
                          {duration.prices.map((price) => (
                            <div key={price} className={`font-racing text-lg font-bold ${experience.accentClass}`}>{price}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {experience.offer ? (
                    <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs font-racing uppercase tracking-widest text-primary mb-6">
                      {experience.offer}
                    </div>
                  ) : null}

                  <Button className="w-full font-racing uppercase tracking-widest" variant="outline" asChild>
                    <a href={`/?type=${experience.type}#booking`}>Book {experience.name}</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          SIM Racing launch offer applies to SIM Racing only. Final booking availability depends on the selected resource, date, time, and party size.
        </p>
      </div>
    </section>
  );
}
