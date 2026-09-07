export function LegalDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={[
        "mx-auto max-w-3xl text-center text-muted-foreground/80",
        compact
          ? "text-[9px] leading-[1.45]"
          : "border-t border-border/50 pt-4 text-[10px] leading-relaxed",
      ].join(" ")}
    >
      <strong className="font-semibold text-primary">
        COLD CURED LIVE ROSIN THCA - 100% Solventless.
      </strong>{" "}
      THCa products are federally legal under the 2018 Farm Bill when derived
      from hemp and containing less than 0.3% Delta-9 THC by dry weight. THCa
      is non-psychoactive in its raw form, it converts to THC when heated. Laws
      may vary by state, so please check your local state regulations before
      purchasing.
    </p>
  );
}