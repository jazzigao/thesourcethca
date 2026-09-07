import { useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { Loader2, ArrowUpRight, Leaf, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProductSize, Product } from "@workspace/api-client-react";
import { getProductGallery, getProductImage } from "@/lib/product-images";
import { getExperienceNotes } from "@/lib/product-copy";
import sourceEmblem from "@/assets/source-emblem.webp";
import { ReviewSection } from "@/components/reviews/ReviewSection";

const getStrainDisplay = (strainType: string) => {
  const [type, ...details] = strainType.split("·").map(part => part.trim());
  return { type, mix: details.join(" · ") };
};

const getListingFlavor = (product: Product) => {
  const notes = product.flavorNotes.slice(0, 4).join(" · ");
  return notes || "Small-batch cultivar";
};

const getDisplaySizes = (product: Product): ProductSize[] =>
  product.type === "flower" ? [] : product.sizes;

const FLOWER_TIERS = ["Premium Indoor Flower", "Greenhouse Flower", "Sungrown Flower"];

const getDefaultSize = (product: Product): ProductSize | undefined => {
  const sizes = getDisplaySizes(product);
  return product.type === "rosin"
    ? sizes.find((size) => size.grams === 7) ?? sizes[0]
    : sizes[0];
};

const getStrainTone = (strainType: string) => {
  const value = strainType.toLowerCase();
  if (value.includes("hybrid")) return "hybrid";
  if (value.includes("sativa")) return "sativa";
  return "indica";
};

export default function Shop() {
  const { data: products, isLoading } = useListProducts();
  const { addItem } = useCart();
  const [selectedSizes, setSelectedSizes] = useState<Record<string, ProductSize>>({});
  const [selectedImages, setSelectedImages] = useState<Record<string, number>>({});

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSizeSelect = (productId: string, size: ProductSize) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  const handleAddToCart = (product: Product) => {
    const size = selectedSizes[product.id] || getDefaultSize(product);
    if (!size) return;

    addItem({
      productId: product.id,
      grams: size.grams,
      quantity: 1,
      price: size.price,
      name: product.name,
      imageUrl: getProductImage(product)
    });
    
    toast.success(`Added to Cart! (${size.grams}g)`, { duration: 2200 });
  };

  const catalogProducts = products || [];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-12">
      <div className="space-y-4 border-b border-border pb-6 pt-2">
        <img src={sourceEmblem} alt="The Source logo" className="source-logo source-logo--shop" />
         <h1 className="font-serif text-4xl md:text-5xl tracking-tight leading-[.95] text-foreground">Current Drops</h1>
         <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
           Small-batch, cold-cure live hash rosin. Cultivated with intention, washed with care by hand, and sold directly by the farmers that grew it from seed. Everything is artisan designed and made with love and care, and we hope you can see and feel the difference.
        </p>
      </div>

      <nav className="shop-strain-rail" aria-label="Jump to a strain">
        <div className="shop-strain-rail__heading">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The full garden</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Tap a thumbnail for details</span>
        </div>
        <div className="shop-strain-rail__items">
          {catalogProducts.map((product) => {
            const strainTone = getStrainTone(product.strainType);
            return (
              <a
                key={product.id}
                href={`#product-${product.id}`}
                className={`shop-strain-thumb shop-strain-thumb--${strainTone}`}
                aria-label={`Jump to ${product.name}`}
              >
                <img
                  src={getProductImage(product)}
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                />
                <span>{product.name}</span>
              </a>
            );
          })}
        </div>
      </nav>

      <div className="space-y-5">
        {catalogProducts.map((product, index) => {
          const displaySizes = getDisplaySizes(product);
          const gallery = getProductGallery(product);
          const selectedImageIndex = selectedImages[product.id] ?? 0;
          const selectedImage = gallery[selectedImageIndex] ?? gallery[0];
           const currentSize = selectedSizes[product.id] || getDefaultSize(product);
          const isSoldOut = product.status === 'sold_out' || product.stock === 0;
          const isComingSoon = product.status === 'coming_soon';
          const isUnavailable = isSoldOut || isComingSoon;
          const isEven = index % 2 === 0;
           const strain = getStrainDisplay(product.strainType);
           const strainTone = getStrainTone(product.strainType);

          return (
              <div id={`product-${product.id}`} key={product.id} className={`product-listing product-listing--${strainTone} ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} flex flex-col gap-4 lg:gap-6 items-center p-2.5 md:p-3.5 scroll-mt-24`}>
              
              {/* Image Column */}
               <div className="w-full lg:w-[44%] relative group">
                 <div className="image-double-border overflow-hidden bg-card aspect-[4/3] max-h-[360px] relative z-10">
                   <img
                     src={selectedImage?.src ?? getProductImage(product)}
                    alt={product.name} 
                     width={1024}
                     height={1024}
                     loading="lazy"
                     decoding="async"
                    className={`w-full h-full object-cover transition-transform duration-1000 ${isSoldOut ? 'grayscale opacity-70' : 'group-hover:scale-105'}`}
                  />
                   <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
                      <span className={`info-blue-bar ${index % 2 ? 'info-blue-bar-alt' : ''} rounded-md px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-sm backdrop-blur`}>
                      {product.type}
                    </span>
                    {isSoldOut && (
                       <span className="info-blue-bar info-blue-bar-strong rounded-md px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-sm backdrop-blur">
                        Sold Out
                      </span>
                    )}
                    {isComingSoon && (
                       <span className="info-blue-bar info-blue-bar-alt rounded-md px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-sm backdrop-blur">
                        Coming Soon
                      </span>
                    )}
                  </div>
                 <div className="product-gallery-thumbs" aria-label={`${product.name} photo gallery`}>
                   {gallery.map((image, imageIndex) => (
                     <button
                       type="button"
                       key={image.label}
                       className={`product-gallery-thumb ${imageIndex === selectedImageIndex ? "product-gallery-thumb--active" : ""}`}
                       aria-label={`Show ${image.label}`}
                       aria-pressed={imageIndex === selectedImageIndex}
                       onClick={() => setSelectedImages((previous) => ({ ...previous, [product.id]: imageIndex }))}
                     >
                       <img src={image.src} alt="" loading="lazy" decoding="async" />
                     </button>
                   ))}
                 </div>
                </div>
              </div>
              
              {/* Details Column */}
                <div className="w-full lg:w-[56%] flex flex-col space-y-4 min-w-0">
                   <div className="space-y-2">
                    <div className="product-identity-row flex flex-wrap items-start gap-3">
                      <div className="strain-reference-stack">
                        <div className="cultivar-highlight flex flex-col gap-1">
                          <span className="cultivar-type flex items-center gap-1">
                            <Leaf className="h-3 w-3 shrink-0" /> {strain.type}
                          </span>
                          {strain.mix && <span className="cultivar-mix">{strain.mix}</span>}
                        </div>
                        {product.referenceUrl && product.referenceLabel && (
                          <a
                            className="reference-link reference-link--strain"
                            href={product.referenceUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {product.referenceLabel} <ArrowUpRight className="h-3 w-3 shrink-0" />
                          </a>
                        )}
                      </div>
                     {product.potency > 0 && (
                       <span className="self-center text-xs font-bold uppercase tracking-widest text-primary">
                         {product.potency}% THC
                       </span>
                     )}
                   </div>
                         <h2 className={`shop-item-title item-title item-title--${product.type === 'flower' ? 'flower' : 'rosin'} text-[clamp(2.25rem,4.5vw,3.8rem)] tracking-tight`}>
                    {product.name}
                  </h2>
                </div>

                    <div className="copy-glow-box-frame">
                      <div className="copy-glow-box space-y-2">
                        <div className="flavor-profile">
                            <span className="copy-heading">Flavor Profile / Notes Of</span>
                          <span className="listing-summary">{getListingFlavor(product)}</span>
                        </div>
                         <div className="copy-section">
                           <span className="copy-heading">Experience</span>
                           <p className={`item-experience ${index % 3 === 1 ? 'item-description--caramel' : index % 3 === 2 ? 'item-description--purple' : ''}`}>
                             {getExperienceNotes(product)}
                           </p>
                         </div>
                         <div className="copy-section">
                           <span className="copy-heading">Strain Description</span>
                           <p className="item-description">{product.description}</p>
                         </div>
                      </div>
                    </div>
                 <div className="lineage-meta">
                   <span className="copy-heading">Lineage</span>
                   <p className="listing-lineage">{product.lineage}</p>
                 </div>

                 <div className="py-2.5 border-y border-border/50">
                  {product.effects && product.effects.length > 0 && (
                     <div className="space-y-2">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Effects
                      </h4>
                      <div className="flex flex-wrap gap-2">
                         {product.effects.map(effect => (
                           <span key={effect} className="effects-description text-xs bg-muted px-2 py-1">
                            {effect}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                  <div className="space-y-3 pt-1">
                   <div className="flex justify-between items-end">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Size</span>
                      <span className="font-serif text-3xl">{currentSize ? `$${currentSize.price}` : 'Tier options below'}</span>
                  </div>

                   {product.type === "flower" && (
                     <div className="space-y-2">
                       <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Organic flower tiers</span>
                       <div className="flex flex-wrap gap-2" aria-label="Organic flower tiers">
                         {FLOWER_TIERS.map((tier) => (
                           <span key={tier} className="rounded-md border border-[hsl(var(--orange-light))] bg-[hsl(var(--button-sage)/.34)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground">
                             {tier}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}
                  
                  {/* Size Selector */}
                   {displaySizes.length > 0 && (
                     <div className="flex flex-wrap gap-3">
                       {displaySizes.map(size => (
                        <button
                          key={size.grams}
                          onClick={() => handleSizeSelect(product.id, size)}
                           className={`size-select-button min-w-20 flex-1 rounded-md py-2.5 text-sm font-bold uppercase tracking-widest transition-all duration-300 ${
                            currentSize?.grams === size.grams 
                                ? 'size-select-button--selected border-2 border-[hsl(var(--orange-dark))] shadow-[0_0_8px_hsl(var(--button-sage-hover)/.72)]'
                                : 'border border-[hsl(var(--orange-light))] hover:border-[hsl(var(--magenta))]'
                          }`}
                        >
                           {size.grams}g - ${size.price}
                        </button>
                      ))}
                    </div>
                  )}

                   <Button
                          className="w-full rounded-full font-serif text-lg h-12 gap-2 add-to-bag-button transition-all duration-300"
                    disabled={isUnavailable}
                    onClick={() => handleAddToCart(product)}
                  >
                     {isComingSoon ? 'Coming Soon' : isSoldOut ? 'Out of Stock' : <>Add to Bag <span className="add-to-bag-plus" aria-hidden="true">+</span></>}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {catalogProducts.length === 0 && (
        <div className="text-center py-32 text-muted-foreground space-y-4">
          <p className="font-serif text-4xl">No products currently available.</p>
          <p className="text-lg">Please check back during our next drop or join the newsletter.</p>
        </div>
      )}
      <ReviewSection />
    </div>
  );
}