import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";

export default function Wholesale() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Application submitted successfully.");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="space-y-4 text-center pt-4">
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Wholesale Partners</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
          We partner with select licensed dispensaries who share our commitment to quality, storage, and customer education.
        </p>
      </div>

      {submitted ? (
        <div className="layered-border listing-surface p-8 text-center space-y-4">
          <h2 className="font-serif text-3xl text-accent">Application Received</h2>
          <p className="text-lg text-muted-foreground font-light max-w-lg mx-auto">
            Thank you for your interest in The Source. Our team will review your application and reach out within 2-3 business days.
          </p>
        </div>
      ) : (
         <div className="wholesale-application-card layered-border listing-surface p-5 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-5">
              <h2 className="font-serif text-2xl md:text-3xl text-foreground">Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dispensary Name</label>
                  <Input required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
                  <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">License Number</label>
                  <Input required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
                  <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Business Address</label>
                  <Input required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="font-serif text-2xl md:text-3xl text-foreground">Contact Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact Name</label>
                  <Input required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
                  <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title / Role</label>
                  <Input required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
                  <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
                  <Input type="email" required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
                  <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone Number</label>
                  <Input type="tel" required className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estimated Monthly Order Volume</label>
                   <Input required placeholder="e.g. 10–25 units" className="bg-background h-14 border-border/50 focus-visible:border-accent focus-visible:ring-accent" />
                 </div>
              </div>
            </div>

            <div className="pt-6">
              <Button type="submit" className="w-full h-12 rounded-md font-serif text-xl bg-foreground text-background hover:bg-accent hover:text-accent-foreground transition-colors duration-500 shadow-none">
                Submit Application
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
