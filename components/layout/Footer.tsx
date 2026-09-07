import { Link } from "wouter";
import { LegalDisclaimer } from "@/components/shared/LegalDisclaimer";

export function Footer() {
  return (
    <footer className="site-footer border-t border-border/50 mt-20 relative z-10 bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16">
          <div className="md:col-span-2 space-y-6">
             <h3 className="font-serif text-4xl text-primary">The Source</h3>
            <p className="text-muted-foreground max-w-sm font-light leading-relaxed">
              Grown from Seed. Farm to Table. Solventless Hash Rosin. High Quality & Pure.
            </p>
          </div>
          
          <div className="space-y-6">
            <h4 className="font-bold tracking-widest text-xs uppercase text-foreground">Explore</h4>
            <nav className="flex flex-col gap-4 text-sm text-muted-foreground">
              <Link href="/shop" className="footer-link">Shop All</Link>
              <Link href="/account" className="footer-link">Member Deals</Link>
              <Link href="/wholesale" className="footer-link">Wholesale</Link>
            </nav>
          </div>

          <div className="space-y-6">
            <h4 className="font-bold tracking-widest text-xs uppercase text-foreground">Legal</h4>
            <nav className="flex flex-col gap-4 text-sm text-muted-foreground">
              <span className="cursor-not-allowed hover:text-accent transition-colors duration-300">Terms of Service</span>
              <span className="cursor-not-allowed hover:text-accent transition-colors duration-300">Privacy Policy</span>
              <span className="cursor-not-allowed hover:text-accent transition-colors duration-300">Refunds</span>
            </nav>
          </div>
        </div>
        
        <div className="mt-20 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <p>© {new Date().getFullYear()} The Source. All rights reserved.</p>
          <p className="text-primary">Must be 21+ to enter.</p>
        </div>
        <LegalDisclaimer />
      </div>
    </footer>
  );
}
