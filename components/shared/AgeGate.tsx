import React from 'react';
import { useCart } from '@/store/cart';
import { Button } from '@/components/ui/button';
import sourceEmblem from '@/assets/source-emblem.webp';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';

export function AgeGate() {
  const { ageVerified, setAgeVerified, jurisdictionConfirmed, setJurisdictionConfirmed } = useCart();

  if (ageVerified && jurisdictionConfirmed) return null;

  return (
    <div className="web-age-gate fixed inset-0 z-[1000] flex items-center justify-center px-[14px]">
      <div className="web-age-gate__card max-w-lg w-full listing-surface pine-border p-8 md:p-14 text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="space-y-3">
          <img src={sourceEmblem} alt="The Source logo" className="source-logo mx-auto w-44 max-w-full" />
          <p className="text-primary uppercase tracking-[0.16em] text-[10px] font-bold">High Quality &amp; Pure</p>
        </div>
        
        <div className="space-y-4">
          <p className="text-[27px] md:text-4xl font-serif leading-tight">Are you 21 years of age or older?</p>
          <p className="text-[13px] md:text-base text-muted-foreground leading-[1.45] max-w-md mx-auto">
            You must be of legal age to enter this site. By entering, you also confirm that your jurisdiction allows the purchase of these products.
          </p>
           <LegalDisclaimer compact />
        </div>

        <div className="space-y-4 pt-4">
          <Button 
             className="web-age-gate__button w-full font-serif text-lg h-12 bg-[hsl(var(--lineage-forest))] text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-300 rounded-lg border border-accent shadow-none"
            onClick={() => {
              setAgeVerified(true);
              setJurisdictionConfirmed(true);
            }}
          >
            Yes, I am 21+
          </Button>
          <Button 
            variant="outline"
            className="web-age-gate__button w-full font-serif text-base h-11 rounded-lg border-border hover:bg-foreground hover:text-background transition-colors duration-300"
            onClick={() => {
              window.location.href = "https://google.com";
            }}
          >
            No, I am under 21
          </Button>
        </div>
      </div>
    </div>
  );
}
