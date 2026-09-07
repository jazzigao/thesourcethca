import type { Product } from "@workspace/api-client-react";

const EXPERIENCE_NOTES: Record<string, string> = {
  "gak-smoovie":
    "Inhale: bright melon, ripe berry, and a ribbon of creamy citrus. Onset: quick, clear, and quietly happy. Flavor transition: the fruit folds into soft pastry and light earth. Exhale: berry skin and spice linger with a relaxed, easygoing mood.",
  "high-fructose-corn-syrup":
    "Inhale: sweet candy, cream, and hot gas with a savory GMO edge. Onset: warm happiness arrives fast, then settles behind the eyes. Flavor transition: syrupy fruit gives way to pine, diesel, and damp earth. Exhale: a full, slow relaxation built for an unhurried evening.",
  gmo:
    "Inhale: garlic, cracked pepper, and chemical fuel. Onset: immediate, bright, and euphoric with a focused first lift. Flavor transition: the sharp gas rounds into roasted earth and umami. Exhale: heavy soil, diesel, and a long, deeply relaxing finish.",
  fizz:
    "Inhale: strawberry cake, vanilla cream, and guava. Onset: sparkling, happy, and creatively buoyant. Flavor transition: tropical fruit opens into soft berry custard with a faint floral edge. Exhale: creamy fruit and mellow euphoria, leaving the body loose but light.",
  "ogkb-melonade":
    "Inhale: creamy cookie funk, lemon peel, and sweet melon. Onset: clear, lifted, and conversational. Flavor transition: citrus turns to ripe melon before a thread of diesel and gas appears. Exhale: earthy warmth and a fuller, deeply relaxed finish.",
};

export function getExperienceNotes(product: Product) {
  return (
    EXPERIENCE_NOTES[product.id] ??
    "Inhale: a gentle aromatic opening. Onset: measured and clear. Flavor transition: layered fruit, cream, earth, or fuel as the cultivar opens. Exhale: a clean, lingering finish with an easy, settled mood."
  );
}