import { Facebook, Instagram, Twitter, Youtube, Zap } from "lucide-react";

const footerLinks = {
  Experiences: [
    "Racing Simulator",
    "FPV RC Arena",
    "Group Events",
    "Corporate Packages",
  ],
  Company: ["About Us", "Our Story", "Careers", "Press"],
  Support: ["FAQ", "Safety Rules", "Terms of Service", "Privacy Policy"],
};

const socialLinks = [
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Youtube, href: "#", label: "YouTube" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Facebook, href: "#", label: "Facebook" },
];

const tracks = [
  "Monza GP",
  "Silverstone",
  "Spa-Francorchamps",
  "Nürburgring",
  "Suzuka",
  "Monaco Street Circuit",
  "Melbourne GP",
  "Bahrain International",
  "Monza GP",
  "Silverstone",
  "Spa-Francorchamps",
  "Nürburgring",
];

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden border-t border-border/50"
      data-testid="footer"
    >
      {/* Track ticker */}
      <div className="bg-primary/10 border-b border-primary/20 py-2 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {tracks.map((track, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-3 mx-6 font-racing text-xs uppercase tracking-widest text-primary/80"
            >
              <Zap className="w-3 h-3" />
              {track}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/images/metaracing-logo.png"
                alt="MetaRacing Logo"
                className="h-10 w-10 object-contain"
              />
              <span className="font-racing text-xl font-bold tracking-widest uppercase text-foreground">
                Meta<span className="text-primary">Racing</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              Vijayawada's premier racing simulator and FPV drone racing
              destination. Where digital meets adrenaline.
            </p>

            {/* Social links */}
            <div className="flex gap-3 flex-wrap">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    data-testid={`link-social-${social.label.toLowerCase()}`}
                    className="w-9 h-9 rounded-md bg-secondary border border-border/40 flex items-center justify-center text-muted-foreground hover-elevate transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-racing text-xs uppercase tracking-widest text-foreground mb-4">
                {category}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      data-testid={`link-footer-${link
                        .toLowerCase()
                        .replace(/\s/g, "-")}`}
                      className="text-sm text-muted-foreground transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="neon-divider my-8 opacity-30" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MetaRacing. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground font-racing uppercase tracking-widest">
            Built for Speed. Built for{" "}
            <span className="text-primary">Champions.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
