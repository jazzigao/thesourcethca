import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  checkoutIntentAuditTable,
  checkoutIntentsTable,
  db,
  newsletterSubscriptionsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  reviewClaimsTable,
  reviewsTable,
  wholesaleApplicationsTable,
  type CheckoutIntentOrderItem,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  CreateOrderBody,
  CreateOrderResponse,
  ClaimReviewBody,
  ClaimReviewResponse,
  GetLoyaltyResponse,
  GetStorefrontSummaryResponse,
  ListRecoveryCheckoutIntentsResponse,
  ListOrdersResponse,
  ListProductsResponse,
  ListReviewsResponse,
  ResolveCheckoutIntentBody,
  ResolveCheckoutIntentResponse,
  SubscribeNewsletterBody,
  SubscribeNewsletterResponse,
  SubmitWholesaleApplicationBody,
  SubmitWholesaleApplicationResponse,
  SubmitReviewBody,
  SubmitReviewResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { shopifyStorefrontRequest } from "../lib/shopifyStorefrontClient.js";
import { shopifyAdminRequest } from "../lib/shopifyAdminClient.js";

const router: IRouter = Router();

const REVIEW_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const REVIEW_ATTEMPT_LIMIT = 10;
const reviewAttempts = new Map<string, number[]>();

type ShopifyReviewOrder = {
  id: string;
  name: string;
  email?: string | null;
  displayFinancialStatus: string;
  lineItems: {
    nodes: Array<{
      product: { handle: string; title: string } | null;
      title: string;
    }>;
  };
};

function reviewSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for review claims.");
  }
  return secret;
}

function hashReviewToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueReviewToken(claimId: string): string {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const signature = crypto
    .createHmac("sha256", reviewSigningSecret())
    .update(`${claimId}.${nonce}`)
    .digest("base64url");
  return `${claimId}.${nonce}.${signature}`;
}

function verifyReviewToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return false;
  const [claimId, nonce, signature] = parts;
  const expected = crypto
    .createHmac("sha256", reviewSigningSecret())
    .update(`${claimId}.${nonce}`)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function canAttemptReviewClaim(ip: string): boolean {
  const now = Date.now();
  const recentAttempts = (reviewAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < REVIEW_ATTEMPT_WINDOW_MS,
  );
  if (recentAttempts.length >= REVIEW_ATTEMPT_LIMIT) {
    reviewAttempts.set(ip, recentAttempts);
    return false;
  }
  recentAttempts.push(now);
  reviewAttempts.set(ip, recentAttempts);
  return true;
}

function normalizeOrderNumber(value: string): string {
  return `#${value.trim().replace(/^#/, "")}`;
}

function normalizeReviewEmail(value: string): string {
  return value.trim().toLowerCase();
}

function reviewFailure(res: Response): void {
  res.status(400).json({
    error: "We could not verify that purchase. Check the order number and buyer email.",
  });
}

function isConfiguredAdmin(userId: string): boolean {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((configuredId) => configuredId.trim())
    .filter(Boolean)
    .includes(userId);
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return false;
  }

  const [adminUser] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));
  if (!adminUser?.isAdmin && !isConfiguredAdmin(req.user.id)) {
    res.status(403).json({ error: "Administrator access required." });
    return false;
  }

  return true;
}

type StoreProduct = {
  id: string;
  name: string;
  type: "rosin" | "flower";
  potency: number;
  description: string;
  strainType: string;
  lineage: string;
  effects: string[];
  flavorNotes: string[];
  referenceLabel?: string;
  referenceUrl?: string;
  color: string;
  stock: number;
  status: "available" | "coming_soon" | "sold_out";
  imageDisclaimer: string;
  sizes: Array<{ grams: number; price: number }>;
};

const STANDARD_ROSIN_SIZES: Array<{ grams: number; price: number }> = [
  { grams: 1, price: 40 },
  { grams: 3.5, price: 90 },
  { grams: 7, price: 175 },
  { grams: 14, price: 300 },
  { grams: 28, price: 550 },
];

const seedProducts: StoreProduct[] = [
  {
    id: "gak-smoovie",
    name: "Gak Smoovie",
    type: "rosin" as const,
    potency: 79,
    description:
      "Gak Smoovie is an evenly balanced hybrid bred from Gak and 4 Locoz by Dying Breed Seeds. Its cultivar profile is known for sweet melon and berry layered with creamy citrus, sugar and a light spice, while reported effects pair an immediate, clear-headed lift with a calmer body finish. In cold-cure rosin, that fruit-and-cream character translates into a bright, silky jar with a lively aromatic top note.",
    strainType: "Balanced hybrid · 50% indica / 50% sativa",
    lineage: "Gak × 4 Locoz",
    effects: ["Uplifting", "Cerebral", "Energizing", "Calming", "Relaxing"],
    flavorNotes: ["Creamy", "Fruity", "Melon", "Citrus", "Spicy"],
    referenceLabel: "AllBud strain reference",
    referenceUrl: "https://www.allbud.com/marijuana-strains/hybrid/gak-smoovie",
    color: "lime",
    stock: 8,
    status: "available" as const,
    imageDisclaimer:
      "Editorial batch imagery; natural color and texture vary by harvest and cure.",
    sizes: STANDARD_ROSIN_SIZES,
  },
  {
    id: "high-fructose-corn-syrup",
    name: "High Fructose Corn Syrup",
    type: "rosin" as const,
    potency: 82,
    description:
      "High Fructose Corn Syrup, often shortened to HFCS, is an indica-leaning hybrid that crosses GMO with OZ Kush BX2. The cultivar combines GMO’s savory, resin-heavy depth with OZ Kush’s sweet gas and pine, creating a dense profile that can move from candy-like sweetness into diesel, earth and spice. Reported effects are relaxed, uplifted and euphoric, giving this golden cold cure a rich, unhurried character.",
    strainType: "Indica-leaning hybrid · 60% indica / 40% sativa",
    lineage: "GMO × OZ Kush BX2",
    effects: ["Relaxed", "Uplifted", "Euphoric"],
    flavorNotes: ["Gassy", "Fuel", "Pungent", "Pine", "Earthy"],
    referenceLabel: "Leafly strain reference",
    referenceUrl: "https://www.leafly.com/strains/high-fructose-corn-syrup",
    color: "honey",
    stock: 6,
    status: "available" as const,
    imageDisclaimer:
      "Editorial batch imagery; natural color and texture vary by harvest and cure.",
    sizes: STANDARD_ROSIN_SIZES,
  },
  {
    id: "gmo",
    name: "GMO",
    type: "rosin" as const,
    potency: 83,
    description:
      "GMO, also called GMO Cookies or Garlic Cookies, is the celebrated indica-dominant cross of Chemdawg and Girl Scout Cookies. Its unusually savory terpene profile layers garlic and onion funk over chemical fuel, pepper and damp earth, with a pungent finish that has made it a benchmark extraction cultivar. Consumers commonly report an early euphoric lift followed by deep body relaxation and sleepiness, making this a bold, slow-evening cold cure.",
    strainType: "Indica-dominant hybrid · commonly reported near 90% indica",
    lineage: "Chemdawg × Girl Scout Cookies",
    effects: ["Euphoric", "Relaxed", "Sleepy"],
    flavorNotes: ["Gassy", "Fuel", "Pungent", "Spicy", "Earthy"],
    referenceLabel: "Leafly strain reference",
    referenceUrl: "https://www.leafly.com/strains/gmo-cookies",
    color: "forest",
    stock: 10,
    status: "available" as const,
    imageDisclaimer:
      "Editorial batch imagery; natural color and texture vary by harvest and cure.",
    sizes: STANDARD_ROSIN_SIZES,
  },
  {
    id: "fizz",
    name: "Fizz",
    type: "rosin" as const,
    potency: 77,
    description:
      "The Fizz from Bloom Seed Co. pairs Sherb Cake with Strawberry Guava, bringing creamy dessert genetics together with vivid tropical fruit. Strawberry cake, vanilla and guava lead the aromatic profile, followed by a soft minty freshness and a relaxed, lingering finish. It is documented as a modern hybrid with reported energetic, uplifted and creative effects that can settle into an easy euphoric calm.",
    strainType: "Hybrid · often described as indica-leaning",
    lineage: "Sherb Cake × Strawberry Guava",
    effects: ["Energetic", "Uplifted", "Creative", "Euphoric", "Relaxed"],
    flavorNotes: ["Creamy", "Fruity", "Vanilla", "Berry", "Tropical"],
    referenceLabel: "Proper Cannabis strain reference",
    referenceUrl: "https://www.propercannabis.com/genetics/the-fizz",
    color: "orange",
    stock: 4,
    status: "available" as const,
    imageDisclaimer:
      "Editorial batch imagery; natural color and texture vary by harvest and cure.",
    sizes: STANDARD_ROSIN_SIZES,
  },
  {
    id: "ogkb-melonade",
    name: "OGKB Melonade",
    type: "rosin" as const,
    potency: 82,
    description:
      "OGKB Melonade is presented here as the documented OGKB 2.1 × Melonade expression, a fruit-gas hybrid sometimes cataloged as Melonade Breath. OGKB contributes dense cookie funk and body while Melonade—bred from Watermelon Zkittlez and Lemon Tree—brings bright citrus, sweet melon and tropical lift. The resulting rosin profile balances euphoric clarity with a fuller relaxed finish and a resin-rich, creamy texture.",
    strainType: "Hybrid",
    lineage: "OGKB 2.1 × Melonade (Watermelon Zkittlez × Lemon Tree)",
    effects: ["Euphoric", "Uplifted", "Relaxed", "Cerebral"],
    flavorNotes: ["Creamy", "Fruity", "Citrus", "Gassy", "Earthy"],
    referenceLabel: "LIT Farms lineage reference",
    referenceUrl:
      "https://auctions.neptuneseedbank.com/product/melonade-breath-strain/",
    color: "lavender",
    stock: 7,
    status: "available" as const,
    imageDisclaimer:
      "Editorial batch imagery; natural color and texture vary by harvest and cure.",
    sizes: STANDARD_ROSIN_SIZES,
  },
  {
    id: "organic-cannabis-flower",
    name: "Organic Cannabis Flower",
    type: "flower" as const,
    potency: 0,
    description:
      "Our coming-soon flower program is reserved for organically cultivated, resin-forward seasonal selections with visible trichome maturity, careful hand finishing and full batch traceability. Cultivar name, breeder lineage, dominant aromas and expected effects will be published with each harvest so the listing always reflects the flower actually sealed in the jar rather than a generic strain promise.",
    strainType: "Seasonal cultivar · announced per harvest",
    lineage: "Single-source cultivar lineage published with each release",
    effects: ["Varies by cultivar and batch"],
    flavorNotes: ["Organic", "Floral", "Earthy", "Pine", "Seasonal"],
    color: "sage",
    stock: 10,
    status: "coming_soon" as const,
    imageDisclaimer:
      "Editorial flower imagery; cultivar, color and structure vary by seasonal harvest.",
    sizes: [
      { grams: 3.5, price: 25 },
      { grams: 15, price: 125 },
      { grams: 28, price: 200 },
    ],
  },
];

type StoreProductRow = typeof productsTable.$inferSelect;

async function ensureProductsSeeded(): Promise<void> {
  await db
    .insert(productsTable)
    .values(
      seedProducts.map((product) => ({
        ...product,
        referenceLabel: product.referenceLabel ?? null,
        referenceUrl: product.referenceUrl ?? null,
      })),
    )
    .onConflictDoNothing();
}

function toStoreProduct(row: StoreProductRow): StoreProduct {
  return {
    id: row.id,
    name: row.name,
    type: row.type as StoreProduct["type"],
    potency: row.potency,
    description: row.description,
    strainType: row.strainType,
    lineage: row.lineage,
    effects: row.effects,
    flavorNotes: row.flavorNotes,
    referenceLabel: row.referenceLabel ?? undefined,
    referenceUrl: row.referenceUrl ?? undefined,
    color: row.color,
    stock: row.stock,
    status: row.status as StoreProduct["status"],
    imageDisclaimer: row.imageDisclaimer,
    sizes: row.type === "rosin" ? STANDARD_ROSIN_SIZES : row.sizes,
  };
}

async function getStoredProducts(): Promise<StoreProduct[]> {
  await ensureProductsSeeded();
  const rows = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.createdAt));
  return sortStorefrontProducts(rows.map(toStoreProduct));
}

const STOREFRONT_PRODUCT_ORDER = [
  "fizz",
  "gak-smoovie",
  "ogkb-melonade",
  "high-fructose-corn-syrup",
  "gmo",
  "organic-cannabis-flower",
] as const;

function sortStorefrontProducts(products: StoreProduct[]): StoreProduct[] {
  const displayRank = new Map<string, number>(
    STOREFRONT_PRODUCT_ORDER.map((productId, index) => [productId, index]),
  );

  return [...products].sort((a, b) => {
    const rankA = displayRank.get(a.id) ?? STOREFRONT_PRODUCT_ORDER.length;
    const rankB = displayRank.get(b.id) ?? STOREFRONT_PRODUCT_ORDER.length;
    return rankA - rankB;
  });
}

async function persistCatalogSnapshot(catalog: StoreProduct[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const product of catalog) {
      await tx
        .update(productsTable)
        .set({
          stock: product.stock,
          status: product.status,
          sizes: product.sizes,
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, product.id));
    }
  });
}

type ShopifyVariant = {
  id: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: { amount: string };
  selectedOptions: Array<{ name: string; value: string }>;
};

type ShopifyProduct = {
  handle: string;
  description: string;
  variants: { nodes: ShopifyVariant[] };
};

const STOREFRONT_PRODUCTS_QUERY = `#graphql
  query SeedToTableProducts {
    products(first: 50) {
      nodes {
        handle
        description
        variants(first: 20) {
          nodes {
            id
            availableForSale
            quantityAvailable
            price { amount }
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

async function getShopifyProducts(): Promise<ShopifyProduct[]> {
  const data = await shopifyStorefrontRequest<{
    products: { nodes: ShopifyProduct[] };
  }>(STOREFRONT_PRODUCTS_QUERY);
  return data.products.nodes;
}

function gramsFromVariant(variant: ShopifyVariant): number | null {
  const size = variant.selectedOptions.find(
    (option) => option.name === "Size",
  )?.value;
  const grams = Number.parseFloat(size?.replace("g", "") ?? "");
  if (!Number.isFinite(grams)) return null;
  return grams;
}

function getHostedCheckoutUrl(checkoutUrl: string | null | undefined): string {
  if (!checkoutUrl) {
    throw new Error("Shopify did not return a checkout URL.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(checkoutUrl);
  } catch {
    throw new Error("Shopify returned an invalid checkout URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Shopify returned an insecure checkout URL.");
  }

  return parsedUrl.toString();
}

const CHECKOUT_INTENT_STATUS = {
  pending: "pending",
  creatingCart: "creating_cart",
  cartCreated: "cart_created",
  savingOrder: "saving_order",
  orderCreated: "order_created",
  recoveryRequired: "recovery_required",
  resolved: "resolved",
} as const;

class InvalidCheckoutIdempotencyKeyError extends Error {}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function getCheckoutRequestHash(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function getCheckoutIdempotencyKey(
  input: unknown,
  headerValue: string | string[] | undefined,
): string {
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const normalizedHeader = header?.trim();
  if (normalizedHeader) {
    if (normalizedHeader.length > 255) {
      throw new InvalidCheckoutIdempotencyKeyError(
        "The Idempotency-Key header must be 255 characters or fewer.",
      );
    }
    return normalizedHeader;
  }

  // Older clients do not send a key. A deterministic fallback still makes an
  // exact retry safe while a changed cart gets a new intent.
  return `request_${getCheckoutRequestHash(input)}`;
}

const GUEST_CHECKOUT_COOKIE = "st_guest_checkout";
const GUEST_CHECKOUT_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

function signGuestCheckoutId(id: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for guest checkout.");
  }
  return crypto.createHmac("sha256", secret).update(id).digest("hex");
}

function parseGuestCheckoutCookie(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const [id, signature] = value.split(".");
  if (
    !id ||
    !signature ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !/^[0-9a-f]{64}$/i.test(signature)
  ) {
    return null;
  }

  const expected = signGuestCheckoutId(id);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  return id;
}

function getCheckoutOwnerScope(req: Request, res: Response): string {
  if (req.isAuthenticated()) return req.user.id;

  const existingId = parseGuestCheckoutCookie(
    req.cookies?.[GUEST_CHECKOUT_COOKIE],
  );
  const guestId = existingId ?? crypto.randomUUID();
  if (!existingId) {
    res.cookie(
      GUEST_CHECKOUT_COOKIE,
      `${guestId}.${signGuestCheckoutId(guestId)}`,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: GUEST_CHECKOUT_COOKIE_MAX_AGE_MS,
        path: "/",
      },
    );
  }
  return `guest:${guestId}`;
}

function toCheckoutResponse(
  intent: Pick<
    typeof checkoutIntentsTable.$inferSelect,
    "shopifyCartId" | "checkoutUrl"
  >,
) {
  if (!intent.shopifyCartId || !intent.checkoutUrl) {
    throw new Error("Checkout intent is missing Shopify cart details.");
  }
  return {
    id: intent.shopifyCartId,
    status: "checkout_ready" as const,
    message: "Continue to the licensed retailer’s secure, age-gated checkout.",
    checkoutUrl: intent.checkoutUrl,
  };
}

function isCheckoutIntentInProgress(status: string): boolean {
  return (
    status === CHECKOUT_INTENT_STATUS.creatingCart ||
    status === CHECKOUT_INTENT_STATUS.savingOrder
  );
}

function toRecoveryCheckoutIntentResponse(
  intent: typeof checkoutIntentsTable.$inferSelect,
) {
  return {
    id: intent.id,
    status: intent.status,
    shopifyCartId: intent.shopifyCartId,
    checkoutUrl: intent.checkoutUrl,
    error: intent.lastError,
    requestedItems: intent.requestItems,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
  };
}

const LIVE_CATALOG_CACHE_TTL_MS = 60_000;

let liveCatalogCache:
  | {
      catalog?: StoreProduct[];
      expiresAt: number;
      inFlight?: Promise<StoreProduct[]>;
    }
  | undefined;

async function loadLiveCatalog(): Promise<StoreProduct[]> {
  const storedProducts = await getStoredProducts();
  const shopifyProducts = await getShopifyProducts();
  const liveByHandle = new Map(
    shopifyProducts.map((product) => [product.handle, product]),
  );

  const catalog = storedProducts.map((storedProduct) => {
    if (storedProduct.status === "coming_soon") return storedProduct;

    const live = liveByHandle.get(storedProduct.id);
    if (!live) {
      throw new Error(
        `Shopify product "${storedProduct.id}" is not visible to the storefront.`,
      );
    }

    const sizes = live.variants.nodes
      .map((variant) => {
        const grams = gramsFromVariant(variant);
        return grams === null
          ? null
          : { grams, price: Number.parseFloat(variant.price.amount) };
      })
      .filter((size): size is { grams: number; price: number } => size !== null)
      .sort((a, b) => a.grams - b.grams);

    if (!sizes.length) {
      throw new Error(
        `Shopify product "${storedProduct.id}" has no purchasable jar sizes.`,
      );
    }

    const quantities = live.variants.nodes.map(
      (variant) => variant.quantityAvailable ?? 0,
    );
    const stock = Math.max(0, ...quantities);
    const status: StoreProduct["status"] = live.variants.nodes.some(
      (variant) => variant.availableForSale,
    )
      ? "available"
      : "sold_out";

    return {
      ...storedProduct,
      sizes,
      stock,
      status,
    };
  });

  await persistCatalogSnapshot(catalog);
  return sortStorefrontProducts(catalog);
}

async function getLiveCatalog(): Promise<StoreProduct[]> {
  const now = Date.now();
  if (liveCatalogCache?.catalog && liveCatalogCache.expiresAt > now) {
    return liveCatalogCache.catalog;
  }
  if (liveCatalogCache?.inFlight) {
    return liveCatalogCache.inFlight;
  }

  const inFlight = loadLiveCatalog();
  liveCatalogCache = {
    expiresAt: now + LIVE_CATALOG_CACHE_TTL_MS,
    inFlight,
  };

  try {
    const catalog = await inFlight;
    liveCatalogCache = {
      catalog,
      expiresAt: Date.now() + LIVE_CATALOG_CACHE_TTL_MS,
    };
    return catalog;
  } catch (error) {
    liveCatalogCache = undefined;
    throw error;
  }
}

function invalidateLiveCatalogCache(): void {
  liveCatalogCache = undefined;
}

router.get("/products", async (req, res): Promise<void> => {
  try {
    const catalog = await getLiveCatalog();
    res.json(ListProductsResponse.parse(catalog));
  } catch (error) {
    req.log.warn(
      { error },
      "Unable to read live Shopify catalog; using stored catalog",
    );
    try {
      const catalog = await getStoredProducts();
      res.json(ListProductsResponse.parse(catalog));
    } catch (storedError) {
      req.log.error({ error: storedError }, "Unable to read stored catalog");
      res.status(503).json({
        error:
          "The product catalog is temporarily unavailable. Please try again shortly.",
      });
    }
  }
});

router.get("/storefront-summary", async (_req, res): Promise<void> => {
  res.json(
    GetStorefrontSummaryResponse.parse({
      heroEyebrow: "Limited harvest · 2026",
      heroTitle:
        "Small-batch. 100% Pure Solventless.\nLive Hash Rosin, Delivered to your Door.",
      heroDescription:
        "Cold-cured Artisan Live Hash Rosin.\nGrown organically from seed with loving care.\nCarefully harvested flash frozen high quality flowers.\nPressed 100% Solventless with only ice, pressure, and water.\nPure and flavorful, natural cream of the crop.",
      activeDrop: "THE GARDEN COLLECTION IS LIVE NOW",
      membersMessage: "Join the table: earn 10% back for every $100 spent.",
    }),
  );
});

router.get("/reviews", async (_req, res): Promise<void> => {
  const reviews = await db
    .select()
    .from(reviewsTable)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(100);

  res.json(
    ListReviewsResponse.parse(
      reviews.map((review) => ({
        id: review.id,
        productId: review.productId,
        productName: review.productName,
        reviewerName: review.reviewerName,
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt,
      })),
    ),
  );
});

router.post("/reviews/claim", async (req, res): Promise<void> => {
  const ip = req.ip ?? req.header("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!canAttemptReviewClaim(ip)) {
    res.status(429).json({
      error: "Too many verification attempts. Please try again later.",
    });
    return;
  }

  const parsed = ClaimReviewBody.safeParse(req.body);
  const email = typeof parsed.data?.email === "string"
    ? normalizeReviewEmail(parsed.data.email)
    : "";
  if (
    !parsed.success ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    parsed.data.orderNumber.trim().length === 0
  ) {
    reviewFailure(res);
    return;
  }

  try {
    const orderNumber = normalizeOrderNumber(parsed.data.orderNumber);
    const orderSearchNumber = orderNumber.replace(/^#/, "");
    const shopifyData = await shopifyAdminRequest<{
      orders: { nodes: ShopifyReviewOrder[] };
    }>(
      `query FindPaidReviewOrder($query: String!) {
        orders(first: 10, query: $query) {
          nodes {
            id
            name
            email
            displayFinancialStatus
            lineItems(first: 100) {
              nodes {
                title
                product { handle title }
              }
            }
          }
        }
      }`,
      { query: `name:${orderSearchNumber}` },
    );

    const order = shopifyData.orders.nodes.find(
      (candidate) =>
        normalizeOrderNumber(candidate.name) === orderNumber &&
        candidate.displayFinancialStatus === "PAID" &&
        normalizeReviewEmail(candidate.email ?? "") === email,
    );
    if (!order) {
      reviewFailure(res);
      return;
    }

    const purchasedProducts = new Map<string, string>();
    for (const lineItem of order.lineItems.nodes) {
      if (lineItem.product?.handle) {
        purchasedProducts.set(lineItem.product.handle, lineItem.product.title);
      }
    }
    if (purchasedProducts.size === 0) {
      reviewFailure(res);
      return;
    }

    const existingReviews = await db
      .select({ productId: reviewsTable.productId })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.shopifyOrderId, order.id),
          inArray(reviewsTable.productId, [...purchasedProducts.keys()]),
        ),
      );
    const alreadyReviewed = new Set(existingReviews.map((review) => review.productId));
    const eligibleProducts = [...purchasedProducts.entries()].filter(
      ([productId]) => !alreadyReviewed.has(productId),
    );
    if (eligibleProducts.length === 0) {
      reviewFailure(res);
      return;
    }

    const expiresAt = new Date(Date.now() + REVIEW_CLAIM_TTL_MS);
    const claims = [];
    for (const [productId, productName] of eligibleProducts) {
      const claimId = `review_claim_${crypto.randomUUID()}`;
      const token = issueReviewToken(claimId);
      await db.insert(reviewClaimsTable).values({
        id: claimId,
        tokenHash: hashReviewToken(token),
        shopifyOrderId: order.id,
        productId,
        productName,
        expiresAt,
      });
      claims.push({
        productId,
        productName,
        token,
        reviewUrl: `/reviews?token=${encodeURIComponent(token)}&product=${encodeURIComponent(productId)}`,
        expiresAt,
      });
    }

    res.json(ClaimReviewResponse.parse({ claims }));
  } catch (error) {
    req.log.error({ error }, "Unable to verify Shopify review purchase");
    reviewFailure(res);
  }
});

router.post("/reviews", async (req, res): Promise<void> => {
  const parsed = SubmitReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please complete the review fields." });
    return;
  }

  const reviewerName = parsed.data.reviewerName.trim();
  const reviewText = parsed.data.text.trim();
  if (
    reviewerName.length < 2 ||
    reviewText.length < 10 ||
    !Number.isInteger(parsed.data.rating)
  ) {
    res.status(400).json({ error: "Please complete the review fields." });
    return;
  }

  try {
    if (!verifyReviewToken(parsed.data.token)) {
      res.status(400).json({ error: "This review link is invalid or expired." });
      return;
    }

    const tokenHash = hashReviewToken(parsed.data.token);
    const [claim] = await db
      .select()
      .from(reviewClaimsTable)
      .where(eq(reviewClaimsTable.tokenHash, tokenHash))
      .limit(1);
    if (!claim || claim.expiresAt.getTime() <= Date.now()) {
      res.status(400).json({ error: "This review link is invalid or expired." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(
          and(
            eq(reviewsTable.shopifyOrderId, claim.shopifyOrderId),
            eq(reviewsTable.productId, claim.productId),
          ),
        )
        .limit(1);
      if (existing) return { kind: "duplicate" as const };

      const [claimed] = await tx
        .update(reviewClaimsTable)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(reviewClaimsTable.id, claim.id),
            isNull(reviewClaimsTable.usedAt),
            gt(reviewClaimsTable.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!claimed) return { kind: "expired" as const };

      const [review] = await tx
        .insert(reviewsTable)
        .values({
          id: `review_${crypto.randomUUID()}`,
          shopifyOrderId: claim.shopifyOrderId,
          productId: claim.productId,
          productName: claim.productName,
          reviewerName,
          rating: parsed.data.rating,
          text: reviewText,
        })
        .onConflictDoNothing({
          target: [reviewsTable.shopifyOrderId, reviewsTable.productId],
        })
        .returning();
      return review ? { kind: "created" as const, review } : { kind: "duplicate" as const };
    });

    if (result.kind === "duplicate") {
      res.status(409).json({ error: "A review was already submitted for this purchase." });
      return;
    }
    if (result.kind === "expired") {
      res.status(400).json({ error: "This review link is invalid or expired." });
      return;
    }

    res.status(201).json(
      SubmitReviewResponse.parse({
        id: result.review.id,
        productId: result.review.productId,
        productName: result.review.productName,
        reviewerName: result.review.reviewerName,
        rating: result.review.rating,
        text: result.review.text,
        createdAt: result.review.createdAt,
      }),
    );
  } catch (error) {
    req.log.error({ error }, "Unable to publish purchaser review");
    res.status(500).json({ error: "Unable to publish the review right now." });
  }
});

router.get("/loyalty", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const orders = await db
    .select({ subtotal: ordersTable.subtotal })
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.user.id));
  const points = Math.floor(
    orders.reduce((total, order) => total + order.subtotal, 0),
  );
  const dollarsToNextReward = 100 - (points % 100 || 0);

  res.json(
    GetLoyaltyResponse.parse({
      points,
      dollarsToNextReward,
      rewardMessage: `Spend $${dollarsToNextReward} more to unlock your next $10 off.`,
    }),
  );
});

router.get("/orders", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.user.id))
    .orderBy(desc(ordersTable.createdAt));
  const orderIds = orders.map((order) => order.id);
  const items = orderIds.length
    ? await db
        .select()
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, orderIds))
        .orderBy(asc(orderItemsTable.id))
    : [];
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const existing = itemsByOrder.get(item.orderId) ?? [];
    existing.push(item);
    itemsByOrder.set(item.orderId, existing);
  }

  res.json(
    ListOrdersResponse.parse(
      orders.map((order) => ({
        id: order.id,
        status: order.status,
        subtotal: order.subtotal,
        createdAt: order.createdAt,
        items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
          productId: item.productId,
          productName: item.productName,
          grams: item.grams,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      })),
    ),
  );
});

router.post("/newsletter", async (req, res): Promise<void> => {
  const parsed = SubscribeNewsletterBody.safeParse(req.body);
  if (!parsed.success || !/^\S+@\S+\.\S+$/.test(parsed.data?.email ?? "")) {
    req.log.warn("Invalid newsletter subscription");
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [subscription] = await db
    .insert(newsletterSubscriptionsTable)
    .values({
      id: `sub_${crypto.randomUUID()}`,
      email,
      status: "subscribed",
    })
    .onConflictDoUpdate({
      target: newsletterSubscriptionsTable.email,
      set: { status: "subscribed", updatedAt: new Date() },
    })
    .returning();

  res.status(201).json(
    SubscribeNewsletterResponse.parse({
      id: subscription.id,
      email: subscription.email,
      status: subscription.status,
    }),
  );
});

router.post("/wholesale-applications", async (req, res): Promise<void> => {
  const parsed = SubmitWholesaleApplicationBody.safeParse(req.body);
  if (!parsed.success || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data?.email.trim() ?? "")) {
    req.log.warn({ errors: parsed.error?.message }, "Invalid wholesale application");
    res.status(400).json({ error: "Please review the application and enter a valid email address." });
    return;
  }

  const application = parsed.data;
  const normalized = {
    businessName: application.businessName.trim(),
    businessType: application.businessType.trim(),
    license: application.license.trim(),
    contactName: application.contactName.trim(),
    email: application.email.trim().toLowerCase(),
    phone: application.phone.trim(),
    location: application.location.trim(),
    interest: application.interest.trim(),
    volume: application.volume.trim(),
    message: application.message?.trim() || null,
  };
  const requiredValues = [
    normalized.businessName,
    normalized.businessType,
    normalized.license,
    normalized.contactName,
    normalized.email,
    normalized.phone,
    normalized.location,
    normalized.interest,
    normalized.volume,
  ];
  if (requiredValues.some((value) => value.length === 0)) {
    res.status(400).json({ error: "Please complete every required application field." });
    return;
  }

  const [saved] = await db
    .insert(wholesaleApplicationsTable)
    .values({
      id: `wholesale_${crypto.randomUUID()}`,
      ...normalized,
      status: "received",
    })
    .returning();

  res.status(201).json(
    SubmitWholesaleApplicationResponse.parse({
      id: saved.id,
      status: saved.status,
    }),
  );
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid checkout request");
    res.status(400).json({ error: "Please review your cart and try again." });
    return;
  }

  if (!parsed.data.ageVerified || !parsed.data.jurisdictionConfirmed) {
    res.status(400).json({
      error: "Age and delivery jurisdiction confirmation are required.",
    });
    return;
  }

  if (!parsed.data.guestCheckout && !req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in to save this order." });
    return;
  }

  let claimedCartIntentId: string | null = null;
  let externalCartRecovery: {
    shopifyCartId: string;
    checkoutUrl: string;
    subtotal: number;
    orderItems: CheckoutIntentOrderItem[];
  } | null = null;

  try {
    const requestHash = getCheckoutRequestHash(parsed.data);
    const idempotencyKey = getCheckoutIdempotencyKey(
      parsed.data,
      req.header("Idempotency-Key"),
    );
    const ownerScope = getCheckoutOwnerScope(req, res);

    // This insert is deliberately before any Shopify request. The unique
    // owner/key pair is the durable claim that makes retries safe.
    const [createdIntent] = await db
      .insert(checkoutIntentsTable)
      .values({
        id: `intent_${crypto.randomUUID()}`,
        idempotencyKey,
        ownerScope,
        requestHash,
        requestItems: parsed.data.items,
        guestCheckout: parsed.data.guestCheckout,
        status: CHECKOUT_INTENT_STATUS.pending,
      })
      .onConflictDoNothing({
        target: [
          checkoutIntentsTable.ownerScope,
          checkoutIntentsTable.idempotencyKey,
        ],
      })
      .returning();

    const intent =
      createdIntent ??
      (
        await db
          .select()
          .from(checkoutIntentsTable)
          .where(
            and(
              eq(checkoutIntentsTable.ownerScope, ownerScope),
              eq(checkoutIntentsTable.idempotencyKey, idempotencyKey),
            ),
          )
          .limit(1)
      )[0];

    if (!intent) {
      throw new Error("The checkout intent could not be loaded.");
    }

    if (intent.requestHash !== requestHash) {
      res.status(409).json({
        error:
          "This Idempotency-Key was already used for a different checkout.",
      });
      return;
    }

    if (intent.status === CHECKOUT_INTENT_STATUS.resolved) {
      res.status(409).json({
        error:
          "This checkout intent was resolved by an operator and cannot be resumed.",
      });
      return;
    }

    if (intent.status === CHECKOUT_INTENT_STATUS.orderCreated) {
      res
        .status(200)
        .json(CreateOrderResponse.parse(toCheckoutResponse(intent)));
      return;
    }

    if (isCheckoutIntentInProgress(intent.status)) {
      // The order transaction can commit just before the process loses the
      // connection needed to finalize this intent. Reconcile that case before
      // treating the state as an active concurrent request.
      if (intent.shopifyCartId) {
        const [committedOrder] = await db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.id, intent.shopifyCartId))
          .limit(1);
        if (committedOrder) {
          await db
            .update(checkoutIntentsTable)
            .set({
              status: CHECKOUT_INTENT_STATUS.orderCreated,
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(checkoutIntentsTable.id, intent.id));
          res
            .status(200)
            .json(CreateOrderResponse.parse(toCheckoutResponse(intent)));
          return;
        }
      }
      res.status(409).json({
        error:
          "This checkout is already being prepared. Please retry shortly if the checkout link does not open.",
      });
      return;
    }

    let activeIntent = intent;
    if (intent.status === CHECKOUT_INTENT_STATUS.pending) {
      const [claimedIntent] = await db
        .update(checkoutIntentsTable)
        .set({
          status: CHECKOUT_INTENT_STATUS.creatingCart,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(checkoutIntentsTable.id, intent.id),
            eq(checkoutIntentsTable.status, CHECKOUT_INTENT_STATUS.pending),
          ),
        )
        .returning();

      if (!claimedIntent) {
        res.status(409).json({
          error:
            "This checkout is already being prepared. Please retry shortly.",
        });
        return;
      }
      activeIntent = claimedIntent;
      claimedCartIntentId = claimedIntent.id;
    }

    let checkoutIntent = activeIntent;

    if (
      activeIntent.status === CHECKOUT_INTENT_STATUS.creatingCart ||
      activeIntent.status === CHECKOUT_INTENT_STATUS.pending
    ) {
      const storedProducts = await getStoredProducts();
      const shopifyProducts = await getShopifyProducts();
      const preparedItems = parsed.data.items.map((item) => {
        const product = shopifyProducts.find(
          (candidate) => candidate.handle === item.productId,
        );
        const variant = product?.variants.nodes.find(
          (candidate) =>
            gramsFromVariant(candidate) === item.grams &&
            candidate.availableForSale,
        );
        const storedProduct = storedProducts.find(
          (candidate) => candidate.id === item.productId,
        );

        if (!variant || !storedProduct) {
          throw new Error(
            `The selected ${item.grams}g jar is unavailable. Refresh the catalog and try again.`,
          );
        }

        return {
          line: { merchandiseId: variant.id, quantity: item.quantity },
          historyItem: {
            productId: item.productId,
            productName: storedProduct.name,
            grams: item.grams,
            quantity: item.quantity,
            unitPrice: Number.parseFloat(variant.price.amount),
          },
        };
      });
      const lines = preparedItems.map((item) => item.line);
      const subtotal =
        preparedItems.reduce(
          (totalCents, item) =>
            totalCents +
            Math.round(item.historyItem.unitPrice * 100) *
              item.historyItem.quantity,
          0,
        ) / 100;

      const data = await shopifyStorefrontRequest<{
        cartCreate: {
          cart: { id: string; checkoutUrl: string } | null;
          userErrors: Array<{ message: string }>;
        };
      }>(
        `#graphql
          mutation CreateSeedToTableCart($lines: [CartLineInput!]!) {
            cartCreate(input: { lines: $lines }) {
              cart { id checkoutUrl }
              userErrors { message }
            }
          }
        `,
        { lines },
      );

      const shopifyError = data.cartCreate.userErrors[0];
      if (shopifyError) throw new Error(shopifyError.message);
      const cart = data.cartCreate.cart;
      if (!cart) {
        throw new Error("Shopify did not return a cart.");
      }
      const checkoutUrl = getHostedCheckoutUrl(cart.checkoutUrl);
      const orderItems = preparedItems.map(({ historyItem }) => historyItem);
      externalCartRecovery = {
        shopifyCartId: cart.id,
        checkoutUrl,
        subtotal,
        orderItems,
      };

      // Save the Shopify result separately from the order transaction. If the
      // order transaction fails, this row remains a reviewable recovery record
      // and the next attempt can skip cartCreate entirely.
      const [cartIntent] = await db
        .update(checkoutIntentsTable)
        .set({
          status: CHECKOUT_INTENT_STATUS.cartCreated,
          shopifyCartId: cart.id,
          checkoutUrl,
          subtotal,
          orderItems,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(checkoutIntentsTable.id, activeIntent.id))
        .returning();

      if (!cartIntent) {
        throw new Error(
          "Shopify checkout was created, but its recovery record could not be saved.",
        );
      }
      checkoutIntent = cartIntent;
      claimedCartIntentId = null;
      externalCartRecovery = null;
    }

    if (
      !checkoutIntent.shopifyCartId ||
      !checkoutIntent.checkoutUrl ||
      checkoutIntent.subtotal === null ||
      !checkoutIntent.orderItems?.length
    ) {
      res.status(409).json({
        error:
          "This checkout needs review because its Shopify cart details are incomplete.",
      });
      return;
    }

    // A prior request may have committed the order and failed before it could
    // mark the intent complete. Reconcile by Shopify cart ID before inserting.
    const [existingOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, checkoutIntent.shopifyCartId))
      .limit(1);
    if (existingOrder) {
      await db
        .update(checkoutIntentsTable)
        .set({
          status: CHECKOUT_INTENT_STATUS.orderCreated,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(checkoutIntentsTable.id, checkoutIntent.id));
      res
        .status(200)
        .json(CreateOrderResponse.parse(toCheckoutResponse(checkoutIntent)));
      return;
    }

    // Only one retry may own the order insert. A concurrent retry receives a
    // safe in-progress response instead of racing into duplicate records.
    const [orderClaim] = await db
      .update(checkoutIntentsTable)
      .set({
        status: CHECKOUT_INTENT_STATUS.savingOrder,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(checkoutIntentsTable.id, checkoutIntent.id),
          or(
            eq(checkoutIntentsTable.status, CHECKOUT_INTENT_STATUS.cartCreated),
            eq(
              checkoutIntentsTable.status,
              CHECKOUT_INTENT_STATUS.recoveryRequired,
            ),
          ),
        ),
      )
      .returning();

    if (!orderClaim) {
      const [reconciledOrder] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, checkoutIntent.shopifyCartId))
        .limit(1);
      if (reconciledOrder) {
        res
          .status(200)
          .json(CreateOrderResponse.parse(toCheckoutResponse(checkoutIntent)));
        return;
      }
      res.status(409).json({
        error:
          "This checkout is being saved. Please retry shortly if it does not appear in order history.",
      });
      return;
    }

    try {
      await db.transaction(async (tx) => {
        await tx.insert(ordersTable).values({
          id: checkoutIntent.shopifyCartId!,
          userId: checkoutIntent.guestCheckout ? null : req.user!.id,
          status: "checkout_ready",
          subtotal: checkoutIntent.subtotal!,
          checkoutUrl: checkoutIntent.checkoutUrl!,
        });
        await tx.insert(orderItemsTable).values(
          checkoutIntent.orderItems!.map(
            (historyItem: CheckoutIntentOrderItem) => ({
              orderId: checkoutIntent.shopifyCartId!,
              ...historyItem,
            }),
          ),
        );
      });
    } catch (orderError) {
      try {
        await db
          .update(checkoutIntentsTable)
          .set({
            status: CHECKOUT_INTENT_STATUS.recoveryRequired,
            lastError:
              orderError instanceof Error
                ? orderError.message
                : "The order record could not be saved.",
            updatedAt: new Date(),
          })
          .where(eq(checkoutIntentsTable.id, checkoutIntent.id));
      } catch (recoveryError) {
        req.log.error(
          { error: recoveryError, checkoutIntentId: checkoutIntent.id },
          "Unable to update failed checkout recovery record",
        );
      }
      throw orderError;
    }

    try {
      await db
        .update(checkoutIntentsTable)
        .set({
          status: CHECKOUT_INTENT_STATUS.orderCreated,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(checkoutIntentsTable.id, checkoutIntent.id));
    } catch (intentUpdateError) {
      // The order transaction is committed. A retry reconciles it by cart ID,
      // so do not create another order if this final update was interrupted.
      req.log.error(
        { error: intentUpdateError, checkoutIntentId: checkoutIntent.id },
        "Order saved but checkout intent status could not be finalized",
      );
    }

    res
      .status(201)
      .json(CreateOrderResponse.parse(toCheckoutResponse(checkoutIntent)));
  } catch (error) {
    if (error instanceof InvalidCheckoutIdempotencyKeyError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (claimedCartIntentId) {
      const recovery = externalCartRecovery;
      try {
        await db
          .update(checkoutIntentsTable)
          .set({
            status: recovery
              ? CHECKOUT_INTENT_STATUS.recoveryRequired
              : CHECKOUT_INTENT_STATUS.pending,
            ...(recovery
              ? {
                  shopifyCartId: recovery.shopifyCartId,
                  checkoutUrl: recovery.checkoutUrl,
                  subtotal: recovery.subtotal,
                  orderItems: recovery.orderItems,
                }
              : {}),
            lastError:
              error instanceof Error
                ? error.message
                : "Checkout could not be prepared.",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(checkoutIntentsTable.id, claimedCartIntentId),
              eq(
                checkoutIntentsTable.status,
                CHECKOUT_INTENT_STATUS.creatingCart,
              ),
            ),
          );
      } catch (intentRecoveryError) {
        req.log.error(
          { error: intentRecoveryError, checkoutIntentId: claimedCartIntentId },
          "Unable to release failed checkout intent",
        );
      }
    }
    req.log.error({ error }, "Unable to create Shopify checkout");
    res.status(502).json({
      error:
        "Secure checkout could not be prepared. Your cart is saved; please try again shortly.",
    });
  }
});

router.get(
  "/admin/checkout-intents/recovery",
  async (req, res): Promise<void> => {
    if (!(await requireAdmin(req, res))) return;

    const intents = await db
      .select()
      .from(checkoutIntentsTable)
      .where(
        eq(
          checkoutIntentsTable.status,
          CHECKOUT_INTENT_STATUS.recoveryRequired,
        ),
      )
      .orderBy(asc(checkoutIntentsTable.createdAt));

    res.json(
      ListRecoveryCheckoutIntentsResponse.parse(
        intents.map(toRecoveryCheckoutIntentResponse),
      ),
    );
  },
);

router.post(
  "/admin/checkout-intents/:id/resolve",
  async (req, res): Promise<void> => {
    if (!(await requireAdmin(req, res))) return;

    const parsedBody = ResolveCheckoutIntentBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      res.status(400).json({
        error: "Provide a valid recovery resolution.",
      });
      return;
    }

    const [resolvedIntent] = await db.transaction(async (tx) => {
      const [updatedIntent] = await tx
        .update(checkoutIntentsTable)
        .set({
          status: CHECKOUT_INTENT_STATUS.resolved,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(checkoutIntentsTable.id, req.params.id),
            eq(
              checkoutIntentsTable.status,
              CHECKOUT_INTENT_STATUS.recoveryRequired,
            ),
          ),
        )
        .returning();

      if (!updatedIntent) return [null];

      await tx.insert(checkoutIntentAuditTable).values({
        id: `checkout_intent_audit_${crypto.randomUUID()}`,
        checkoutIntentId: updatedIntent.id,
        operatorUserId: req.user!.id,
        action: "resolve",
        outcome: parsedBody.data.outcome ?? "confirmed",
        note: parsedBody.data.note ?? null,
        previousStatus: CHECKOUT_INTENT_STATUS.recoveryRequired,
      });

      return [updatedIntent];
    });

    if (resolvedIntent) {
      res.json(
        ResolveCheckoutIntentResponse.parse(
          toRecoveryCheckoutIntentResponse(resolvedIntent),
        ),
      );
      return;
    }

    const [currentIntent] = await db
      .select()
      .from(checkoutIntentsTable)
      .where(eq(checkoutIntentsTable.id, req.params.id))
      .limit(1);
    if (!currentIntent) {
      res.status(404).json({ error: "Checkout intent not found." });
      return;
    }
    if (currentIntent.status === CHECKOUT_INTENT_STATUS.resolved) {
      res.json(
        ResolveCheckoutIntentResponse.parse(
          toRecoveryCheckoutIntentResponse(currentIntent),
        ),
      );
      return;
    }

    res.status(409).json({
      error: "Only checkout intents awaiting recovery can be resolved.",
    });
  },
);

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Please provide valid inventory details." });
    return;
  }

  await ensureProductsSeeded();
  const [productRow] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));
  const product = productRow ? toStoreProduct(productRow) : undefined;
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  try {
    const data = await shopifyAdminRequest<{
      products: {
        nodes: Array<{
          id: string;
          variants: {
            nodes: Array<{
              inventoryItem: {
                id: string;
                inventoryLevels: {
                  nodes: Array<{
                    location: { id: string };
                    quantities: Array<{ name: string; quantity: number }>;
                  }>;
                };
              };
            }>;
          };
        }>;
      };
      locations: { nodes: Array<{ id: string }> };
    }>(
      `#graphql
        query AdminProduct($query: String!) {
          products(first: 1, query: $query) {
            nodes {
              id
              variants(first: 20) {
                nodes {
                  inventoryItem {
                    id
                    inventoryLevels(first: 20) {
                      nodes {
                        location { id }
                        quantities(names: ["available"]) { name quantity }
                      }
                    }
                  }
                }
              }
            }
          }
          locations(first: 1) { nodes { id } }
        }
      `,
      { query: `handle:${params.data.id}` },
    );

    const shopifyProduct = data.products.nodes[0];
    const location = data.locations.nodes[0];
    if (!shopifyProduct || !location) {
      throw new Error(
        "The matching Shopify product or inventory location is unavailable.",
      );
    }

    const targetStock = body.data.status === "sold_out" ? 0 : body.data.stock;

    if (targetStock !== undefined) {
      const quantities = shopifyProduct.variants.nodes.map((variant) => {
        const currentLevel = variant.inventoryItem.inventoryLevels.nodes.find(
          (level) => level.location.id === location.id,
        );
        const currentQuantity =
          currentLevel?.quantities.find(
            (quantity) => quantity.name === "available",
          )?.quantity ?? 0;

        return {
          inventoryItemId: variant.inventoryItem.id,
          locationId: location.id,
          quantity: targetStock,
          changeFromQuantity: currentQuantity,
        };
      });

      const inventoryUpdate = await shopifyAdminRequest<{
        inventorySetQuantities: {
          userErrors: Array<{ message: string }>;
        };
      }>(
        `#graphql
          mutation SetInventory($input: InventorySetQuantitiesInput!) {
            inventorySetQuantities(input: $input) @idempotent(key: "the-source-admin-${params.data.id}-${Date.now()}") {
              userErrors { message }
            }
          }
        `,
        {
          input: {
            name: "available",
            reason: "correction",
            quantities,
          },
        },
      );
      const error = inventoryUpdate.inventorySetQuantities.userErrors[0];
      if (error) throw new Error(error.message);
    }

    if (body.data.status !== undefined) {
      const shopifyStatus =
        body.data.status === "coming_soon" ? "DRAFT" : "ACTIVE";
      const statusUpdate = await shopifyAdminRequest<{
        productUpdate: { userErrors: Array<{ message: string }> };
      }>(
        `#graphql
          mutation UpdateProductStatus($product: ProductUpdateInput!) {
            productUpdate(product: $product) {
              userErrors { message }
            }
          }
        `,
        { product: { id: shopifyProduct.id, status: shopifyStatus } },
      );
      const error = statusUpdate.productUpdate.userErrors[0];
      if (error) throw new Error(error.message);
    }

    const [updatedProduct] = await db
      .update(productsTable)
      .set({
        ...(targetStock !== undefined ? { stock: targetStock } : {}),
        ...(body.data.status !== undefined ? { status: body.data.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, params.data.id))
      .returning();

    if (!updatedProduct) {
      throw new Error("The updated product could not be saved.");
    }

    invalidateLiveCatalogCache();
    res.json(UpdateProductResponse.parse(toStoreProduct(updatedProduct)));
  } catch (error) {
    req.log.error({ error }, "Unable to update Shopify inventory");
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Shopify inventory could not be updated.",
    });
  }
});

export default router;
