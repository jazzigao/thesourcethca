import { useGetStorefrontSummary, useListProducts, useSubscribeNewsletter, type Product, type ProductSize } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRight, Send } from "lucide-react";
import { useCart } from "@/store/cart";
import { getProductImage } from "@/lib/product-images";
import { getExperienceNotes } from "@/lib/product-copy";
import heroCrystals from "@/assets/hero-cannabis-crystals.jpg";
import sourceEmblem from "@/assets/source-emblem.webp";

const getStrainDisplay = (strainType: string) => {
  const [type, ...details] = strainType.split("·").map(part => part.trim());
  return { type, mix: details.join(" · ") };
};

const getListingFlavor = (flavorNotes: string[]) => {
  const notes = flavorNotes.slice(0, 4).join(" · ");
  return notes ? `Flavor · ${notes}` : "Small-batch cultivar";
};

const FLOWER_TIERS = ["Premium Indoor Flower", "Greenhouse Flower", "Sungrown Flower"];

const getStrainTone = (strainType: string) => {
  const value = strainType.toLowerCase();
  if (value.includes("indica-dominant") || value.startsWith("indica")) return "indica";
  if (value.includes("sativa-dominant") || value.startsWith("sativa")) return "sativa";
  return "hybrid";
};

const getDisplaySizes = (product: Product): ProductSize[] =>
  product.type === "flower" ? [] : product.sizes;

const getDefaultSize = (product: Product): ProductSize | undefined => {
  const sizes = getDisplaySizes(product);
  return product.type === "rosin"
    ? sizes.find((size) => size.grams === 7) ?? sizes[0]
    : sizes[0];
};

function FeaturedProductTile({ product }: { product: Product }) {
  const { addItem } = useCart();
  const sizes = getDisplaySizes(product);
  const [selectedSize, setSelectedSize] = useState<ProductSize | undefined>(getDefaultSize(product));
  const isAvailable = product.status === "available" && product.stock > 0;
  const strain = getStrainDisplay(product.strainType);
  const tone = getStrainTone(product.strainType);

  return (
    <article className={`product-tile product-listing product-listing--${tone}`} data-testid={`card-featured-product-${product.id}`}>
      <Link href={`/shop#product-${product.id}`} className="product-tile__image image-double-border" aria-label={`View details for ${product.name}`} data-testid={`link-featured-product-${product.id}`}>
        <img src={getProductImage(product)} alt={product.name} width={1024} height={1024} loading="lazy" decoding="async" />
        <span className="info-blue-bar product-tile__badge">{product.type === "flower" ? "FLOWER" : "COLD CURE"}</span>
        <span className="info-blue-bar info-blue-bar-alt product-tile__potency">{product.potency}% THC</span>
      </Link>
      <div className="product-tile__content">
        <div className="product-tile__heading">
          <Link href={`/shop#product-${product.id}`} className="item-title product-tile__title">{product.name}</Link>
          <span className="product-tile__stock">{isAvailable ? `${product.stock} left` : "Future drop"}</span>
        </div>
        <div className="cultivar-highlight">
          <span className="cultivar-type">{strain.type}</span>
          {strain.mix ? <span className="cultivar-mix">{strain.mix}</span> : null}
        </div>
        <div className="copy-glow-box-frame">
          <div className="copy-glow-box product-tile__copy">
            <div className="copy-section">
              <span className="copy-heading">Flavor Profile / Notes Of</span>
              <p className="listing-summary">{getListingFlavor(product.flavorNotes)}</p>
            </div>
            <div className="copy-section">
              <span className="copy-heading">Experience</span>
              <p className="item-experience">{getExperienceNotes(product)}</p>
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
        {product.type === "flower" ? (
          <div className="product-tile__options">
            <span className="copy-heading">Organic flower tiers</span>
            <div className="product-tile__size-row">
              {FLOWER_TIERS.map((tier) => (
                <span key={tier} className="product-tile__size">{tier}</span>
              ))}
            </div>
          </div>
        ) : null}
        {sizes.length ? (
          <div className="product-tile__options">
            <span className="copy-heading">Available sizes</span>
            <div className="product-tile__size-row">
              {sizes.map((size) => (
                <button
                  type="button"
                  key={`${size.grams}-${size.price}`}
                  className={`product-tile__size ${selectedSize?.grams === size.grams ? "product-tile__size--selected" : ""}`}
                  onClick={() => setSelectedSize(size)}
                  aria-label={`Select ${size.grams} grams for $${size.price}`}
                  aria-pressed={selectedSize?.grams === size.grams}
                  data-testid={`button-size-${product.id}-${size.grams}`}
                >
                  {size.grams}g · ${size.price}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="product-tile__footer">
          <strong>{selectedSize ? `${selectedSize.grams}g · $${selectedSize.price}` : product.type === "flower" ? "Tier options below" : "Details soon"}</strong>
          <Button
            type="button"
            className="add-to-bag-button product-tile__add"
            disabled={!isAvailable || !selectedSize}
            onClick={() => {
              if (!selectedSize) return;
              addItem({
                productId: product.id,
                grams: selectedSize.grams,
                quantity: 1,
                price: selectedSize.price,
                name: product.name,
                imageUrl: getProductImage(product),
              });
              toast.success(`Added to Cart! (${selectedSize.grams}g)`, { duration: 2200 });
            }}
            data-testid={`button-add-featured-${product.id}`}
          >
            {isAvailable ? <>Add to Bag <span className="add-to-bag-plus" aria-hidden="true">+</span></> : product.status === "coming_soon" ? "Coming Soon" : "Out of Stock"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { data: summary, isLoading: loadingSummary } = useGetStorefrontSummary();
  const { data: products, isLoading: loadingProducts } = useListProducts();
  const subscribe = useSubscribeNewsletter();
  
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactError, setContactError] = useState("");
  const [heroDropsHovered, setHeroDropsHovered] = useState(false);
  const [heroDropsPressed, setHeroDropsPressed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    subscribe.mutate({ data: { email } }, {
      onSuccess: () => {
        toast.success("Subscribed to the list.");
        setEmail("");
      },
      onError: () => {
        toast.error("Failed to subscribe.");
      }
    });
  };

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    const name = contactName.trim();
    const emailAddress = contactEmail.trim();
    const message = contactMessage.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress) || !message) {
      const validationMessage = "Please add your name, a valid email, and your question.";
      setContactError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setContactError("");
    const subject = encodeURIComponent(`The Source help request from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${emailAddress}\n\n${message}`);
    window.location.href = `mailto:help@seedtotable.com?subject=${subject}&body=${body}`;
    toast.success("Your email app is ready with your question.");
  };

  if (loadingSummary || loadingProducts) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const activeDropProducts = products?.filter(p => p.status === 'available') || [];
  const comingSoonProducts = products?.filter(p => p.status === 'coming_soon') || [];

  return (
    <div className="space-y-14">
      {/* Hero Section */}
      <section className="home-hero-panel min-h-0 flex flex-col justify-center items-center text-center space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <img
          src={sourceEmblem}
          alt="The Source logo"
          width={1040}
          height={1019}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="source-logo source-logo--hero"
        />
        <p className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-primary">
          {summary?.heroEyebrow || "Grown from Seed"}
        </p>
        <h1 className="font-serif text-4xl md:text-6xl max-w-4xl tracking-tight leading-[.96] text-foreground">
           100% Solventless.<br />
           Organic &amp; Pure.<br />
           Directly Shipped, from Farm to Your Door.
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
           <span className="hero-copy-lead">Live Hash Rosin. Cold Cure. Small batch made. Artisan Quality. Farmer Owned.</span><br />
            From organic seed to your table, every high-quality flower is grown with care, carefully harvested, and flash-frozen at its peak. Pressed 100% solventlessly with only ice, pressure, and water, our live hash rosin preserves pure, natural flavors of the best parts of the flower. It’s truly the cream of the crop. Made for connoisseurs, delivered fresh with care, you’ll be blissed by the outstanding quality of every single small batch artisan rosin jar. Unique strains for every kind of mood, with strong terpenes that explode with flavor at each twist of the puck. Collect them all for your daily driver rotations, special occasions, or sharing with friends and family.<br />Simply put, Pure Rosin is Pure Happiness!
        </p>
         <div className="pt-1 flex flex-col items-center gap-2">
           <p className="collection-live-text text-base md:text-lg font-bold">The Garden Collection is now live.</p>
            <Link
              href="/shop"
              className="see-all-link group inline-flex items-center gap-3"
              data-hovered={heroDropsHovered ? "true" : undefined}
              data-pressed={heroDropsPressed ? "true" : undefined}
              data-testid="link-hero-drops"
              onPointerDown={() => setHeroDropsPressed(true)}
              onPointerEnter={() => setHeroDropsHovered(true)}
              onPointerLeave={() => {
                setHeroDropsHovered(false);
                setHeroDropsPressed(false);
              }}
              onPointerUp={() => setHeroDropsPressed(false)}
            >
            See New Drops <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </div>
         <div className="hero-image-frame w-full max-w-sm aspect-[16/10] overflow-hidden bg-card">
           <img
             src={heroCrystals}
             alt="Frosted cannabis flower and pale whipped live rosin with visible trichome crystals"
             width={1024}
             height={1024}
             loading="eager"
             fetchPriority="high"
             decoding="async"
             className="h-full w-full object-cover opacity-90"
           />
         </div>
         <span className="text-xs uppercase tracking-[.2em] text-muted-foreground">Traceable cultivar · cold cure · no shortcuts</span>
      </section>

      {/* Featured Drop */}
      <section className="space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-border/50 pb-5">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl md:text-4xl text-foreground">Featured Live Rosin</h2>
            <p className="info-blue-bar rounded-md px-3 py-1.5 text-sm text-foreground font-light">{summary?.activeDrop || "Our latest wash, available now."}</p>
          </div>
          <Link href="/shop" className="see-all-link group flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300">
            See All <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform duration-300" />
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The full garden</p>
              <h3 className="font-serif text-3xl md:text-4xl text-foreground">Every current expression</h3>
            </div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Tap a jar for details</span>
          </div>
           <div className="grid grid-cols-3 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {(products ?? []).map((product) => {
              const strainTone = getStrainTone(product.strainType);
              const isOrganicCannabisFlower = product.name.trim().toLowerCase() === 'organic cannabis flower';
              return (
              <Link
                key={product.id}
                href={`/shop#product-${product.id}`}
                className={`thumbnail-card thumbnail-card--${strainTone} group image-double-border relative block aspect-square overflow-hidden`}
              >
                <img
                  src={getProductImage(product)}
                  alt={product.name}
                  width={1024}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="thumbnail-tone-overlay pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-300 group-hover:opacity-60" />
                 <div className="thumbnail-hover-rainbow opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="thumbnail-bottom-gradient pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true" />
                <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="bg-[hsl(var(--accent)/0.86)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-foreground">
                    {product.potency > 0 ? `${product.potency}% THC` : "Coming soon"}
                  </span>
                </div>
                  <div className={`thumbnail-title thumbnail-title--${product.type === 'flower' ? 'flower' : 'rosin'} thumbnail-title--${strainTone} ${isOrganicCannabisFlower ? 'thumbnail-title--sage-special' : ''} absolute inset-x-0 bottom-0 px-3 py-2.5 text-sm font-bold`}>
                  <span className="thumbnail-name-plate" data-testid={`text-home-thumbnail-name-${product.id}`}>{product.name}</span>
                </div>
              </Link>
              );
            })}
          </div>
        </div>

        {activeDropProducts[0] ? (
          <FeaturedProductTile product={activeDropProducts[0]} />
        ) : (
          <div className="product-listing p-6 text-center text-muted-foreground">The next cure is being prepared.</div>
        )}
      </section>

      {/* Coming Soon */}
      {comingSoonProducts.length > 0 && (
        <section className="layered-border listing-surface p-5 md:p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-noise opacity-50 z-0" />
          <div className="relative z-10 space-y-8">
            <div className="lavender-gradient-strip -mx-5 md:-mx-8 -mt-5 md:-mt-8 mb-6 md:mb-8" aria-hidden="true" />
            <div className="text-center space-y-3 max-w-3xl mx-auto">
               <h2 className="font-serif text-3xl md:text-4xl text-foreground group-hover:text-accent transition-colors duration-700">Coming Soon: Flower</h2>
              <p className="text-lg text-muted-foreground font-light">The same dedication to quality, in its original form. Preview our upcoming harvests.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {comingSoonProducts.slice(0, 2).map((product, index) => (
                <div key={product.id} className="flex gap-5 items-center border-t border-border/30 pt-5">
                   <div className="image-double-border h-28 w-28 md:h-32 md:w-32 bg-muted overflow-hidden shrink-0 filter grayscale opacity-60">
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      width={1024}
                      height={1024}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="info-blue-bar info-blue-bar-alt rounded-md px-2 py-1 text-xs font-bold uppercase tracking-[0.2em]">Harvesting Soon</p>
                      <h3 className="item-title item-title--flower text-[clamp(1.7rem,3vw,2.2rem)]">{product.name}</h3>
                    <p className={`item-description line-clamp-2 ${index % 2 ? 'text-[hsl(var(--description-purple))]' : 'text-[hsl(var(--description-forest))]'}`}>{product.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="home-promise" aria-label="Store promise">
        <span className="home-promise__mark" aria-hidden="true">+</span>
        <p>21+ only. Available exclusively where permitted. Grown from seed, farm to table.</p>
      </div>

      {/* Newsletter */}
      <section className="max-w-3xl mx-auto text-center space-y-6 pb-16">
        <div className="space-y-3">
           <h2 className="font-serif text-3xl md:text-4xl text-foreground">Latest Updates</h2>
           <p className="text-lg text-muted-foreground font-light leading-relaxed">
            {summary?.membersMessage || "Be the first to know about new drops, limited releases, and members-only events."}
          </p>
        </div>
        
        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
          <Input 
            type="email" 
            placeholder="Enter your email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-md bg-background text-base border-foreground/30 focus-visible:ring-accent focus-visible:border-accent"
            required
          />
           <Button
            type="submit" 
             className="h-12 rounded-md px-6 bg-foreground text-background hover:bg-accent hover:text-accent-foreground font-serif text-base shrink-0 transition-colors duration-300 border-none shadow-none"
            disabled={subscribe.isPending}
          >
            {subscribe.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Subscribe"}
          </Button>
        </form>
      </section>

      <section id="contact" className="contact-section max-w-3xl mx-auto space-y-5 scroll-mt-24">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Questions &amp; Help</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground">Talk with Our Team.</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Send us a question about an order, product, eligibility, or anything else. Your email app will open with the message ready to send.
          </p>
          <p className="contact-email-note">help@seedtotable.com</p>
        </div>
        <form onSubmit={handleContact} className="grid gap-3 text-left" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              aria-label="Your name"
              placeholder="Your name"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                if (contactError) setContactError("");
              }}
              className="h-11 rounded-md bg-background/75 text-sm"
              required
            />
            <Input
              type="email"
              aria-label="Your email"
              placeholder="Your email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                if (contactError) setContactError("");
              }}
              className="h-11 rounded-md bg-background/75 text-sm"
              required
            />
          </div>
          <textarea
            aria-label="Your question"
            placeholder="How can we help?"
            value={contactMessage}
            onChange={(e) => {
              setContactMessage(e.target.value);
              if (contactError) setContactError("");
            }}
            className="min-h-28 w-full resize-y rounded-md border bg-background/75 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            required
          />
          {contactError ? (
            <p role="alert" className="rounded-md border border-[hsl(var(--orange-dark)/0.55)] bg-[hsl(var(--orange-light)/0.38)] px-3 py-2 text-sm font-bold text-[hsl(var(--description-caramel))]">
              {contactError}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full sm:w-auto sm:justify-self-start rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground">
            Email Questions &amp; Help <Send className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </section>
    </div>
  );
}