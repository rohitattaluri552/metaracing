import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Experiences", href: "#experiences" },
  { label: "Sim Racing", href: "#sim-racing" },
  { label: "Pricing", href: "#pricing" },
  { label: "Leaderboard", href: "#leaderboard" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const { customer, logout } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
      const sections = ["home", "experiences", "sim-racing", "pricing", "leaderboard", "booking"];
      for (const sec of sections) {
        const el = document.getElementById(sec);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(sec);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border/50"
          : "bg-transparent"
      }`}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo — bigger, name hides on scroll */}
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0" data-testid="link-logo">
            <img
              src="/images/metaracing-logo.png"
              alt="MetaRacing Logo"
              className={`object-contain transition-all duration-300 ${scrolled ? "h-9 w-9" : "h-12 w-12"}`}
            />
            <span
              className={`font-racing font-bold tracking-widest uppercase glow-red text-foreground transition-all duration-300 overflow-hidden ${
                scrolled ? "max-w-0 opacity-0" : "max-w-xs opacity-100 text-xl"
              }`}
            >
              Meta<span className="text-primary">Racing</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-testid={`link-nav-${link.label.toLowerCase()}`}
                className={`px-3 py-2 text-xs font-medium tracking-wider uppercase transition-colors rounded-md relative group ${
                  activeSection === link.href.replace("#", "")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
                <span
                  className={`absolute bottom-0 left-0 h-px bg-primary transition-all duration-300 ${
                    activeSection === link.href.replace("#", "") ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </a>
            ))}
          </div>

          {/* Auth CTA area */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {customer ? (
              <>
                <Button size="sm" asChild data-testid="button-book-now">
                  <a href="/book">Book Now</a>
                </Button>
                <Button size="sm" variant="outline" asChild data-testid="button-dashboard">
                  <a href="/dashboard">
                    <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
                    My Dashboard
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={handleLogout} data-testid="button-nav-logout">
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild data-testid="button-nav-login">
                  <a href="/login">
                    <User className="w-3.5 h-3.5 mr-1.5" />
                    Login
                  </a>
                </Button>
                <Button size="sm" asChild data-testid="button-book-now">
                  <a href="#booking">Book Now</a>
                </Button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background/98 backdrop-blur-md border-b border-border/50" data-testid="mobile-menu">
          <div className="px-4 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                data-testid={`link-mobile-nav-${link.label.toLowerCase()}`}
                className="px-4 py-3 text-sm font-medium tracking-wider uppercase text-muted-foreground border border-border/40 rounded-md"
              >
                {link.label}
              </a>
            ))}
            {customer ? (
              <>
                <Button className="mt-1" asChild>
                  <a href="/book">Book Now</a>
                </Button>
                <Button className="mt-1" variant="outline" asChild>
                  <a href="/dashboard">My Dashboard</a>
                </Button>
                <Button variant="ghost" onClick={handleLogout}>Sign Out</Button>
              </>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <a href="/login">Login</a>
                </Button>
                <Button className="mt-1 w-full" asChild data-testid="button-mobile-book">
                  <a href="#booking">Book Now</a>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
