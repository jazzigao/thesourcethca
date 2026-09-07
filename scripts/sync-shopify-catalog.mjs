import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(
  new URL("../shopify-admin-api.mjs", import.meta.url),
);

const products = [
  {
    handle: "gak-smoovie",
    title: "Gak Smoovie",
    type: "Cold Cure Live Hash Rosin",
    potency: 79,
    stock: 8,
    description: "Bright lime notes with a slow, silky finish.",
  },
  {
    handle: "high-fructose-corn-syrup",
    title: "High Fructose Corn Syrup",
    type: "Cold Cure Live Hash Rosin",
    potency: 82,
    stock: 6,
    description: "A dense, golden cure with an unapologetically sweet nose.",
  },
  {
    handle: "gmo",
    title: "GMO",
    type: "Cold Cure Live Hash Rosin",
    potency: 83,
    stock: 10,
    description: "Savory, deep, and richly aromatic for the slow moment.",
  },
  {
    handle: "fizz",
    title: "Fizz",
    type: "Cold Cure Live Hash Rosin",
    potency: 77,
    stock: 4,
    description: "Citrus lift, soft fizz, and an easy, sunlit finish.",
  },
  {
    handle: "ogkb-melonade",
    title: "OGKB Melonade",
    type: "Cold Cure Live Hash Rosin",
    potency: 82,
    stock: 7,
    description: "Melon softness and a refined lavender-tinted aroma.",
  },
  {
    handle: "organic-cannabis-flower",
    title: "Organic Cannabis Flower",
    type: "Organic Cannabis Flower",
    potency: 0,
    stock: 10,
    description: "Sun-grown flower, preserved for a future farm-to-table drop.",
    comingSoon: true,
  },
];

const rosinSizes = [
  { grams: 1, price: 25 },
  { grams: 2, price: 40 },
  { grams: 5, price: 95 },
  { grams: 14, price: 200 },
  { grams: 28, price: 350 },
];

const flowerSizes = [
  { grams: 14, price: 95 },
  { grams: 28, price: 200 },
];

function admin(query, variables = {}) {
  const result = execFileSync(
    process.execPath,
    [helperPath, JSON.stringify({ query, variables })],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const payload = JSON.parse(result);
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

function assertNoUserErrors(payload, action) {
  const userErrors = payload.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(
      `${action}: ${userErrors.map((error) => error.message).join("; ")}`,
    );
  }
}

function sizesFor(product) {
  return product.comingSoon ? flowerSizes : rosinSizes;
}

function variantLabel(grams) {
  return `${grams}g`;
}

function getSizeOption(variant) {
  return variant.selectedOptions.find((option) => option.name === "Size")?.value;
}

const context = admin(`
  query CatalogContext {
    locations(first: 10) { nodes { id name } }
    publications(first: 20) { nodes { id name } }
    products(first: 100) {
      nodes { id handle }
    }
  }
`);

const location = context.locations.nodes[0];
if (!location) throw new Error("No Shopify inventory location is available.");

const publicationNames = new Set(["Replit", "Shop"]);
const publications = context.publications.nodes.filter((publication) =>
  publicationNames.has(publication.name),
);

if (!publications.some((publication) => publication.name === "Replit")) {
  throw new Error(
    "The Replit sales channel publication is not available yet. Catalog creation stopped before publishing.",
  );
}

const existingByHandle = new Map(
  context.products.nodes.map((product) => [product.handle, product]),
);
const synced = [];

for (const product of products) {
  const sizes = sizesFor(product);
  let shopifyProduct = existingByHandle.get(product.handle);

  if (!shopifyProduct) {
    const created = admin(
      `
        mutation CreateProduct($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product { id handle }
            userErrors { field message }
          }
        }
      `,
      {
        product: {
          title: product.title,
          handle: product.handle,
          descriptionHtml: `<p>${product.description}</p><p><strong>${product.potency}% potency</strong></p><p>21+ only. Available where permitted.</p>`,
          vendor: "Seed to Table",
          productType: product.type,
          tags: [
            "Seed to Table",
            "21+",
            "Regulated",
            product.comingSoon ? "Coming Soon" : "Cold Cure",
          ],
          status: product.comingSoon ? "DRAFT" : "ACTIVE",
          productOptions: [
            {
              name: "Size",
              values: sizes.map((size) => ({ name: variantLabel(size.grams) })),
            },
          ],
        },
      },
    ).productCreate;
    assertNoUserErrors(created, `Create ${product.title}`);
    shopifyProduct = created.product;
  }

  const loadVariants = () =>
    admin(
      `
        query ProductVariants($productId: ID!) {
          product(id: $productId) {
            id
            variants(first: 20) {
              nodes {
                id
                selectedOptions { name value }
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
      `,
      { productId: shopifyProduct.id },
    ).product;

  let productWithVariants = loadVariants();
  const existingLabels = new Set(
    productWithVariants.variants.nodes
      .map(getSizeOption)
      .filter(Boolean),
  );
  const missingSizes = sizes.filter(
    (size) => !existingLabels.has(variantLabel(size.grams)),
  );

  if (missingSizes.length) {
    const hasStandaloneVariant =
      productWithVariants.variants.nodes.length === 1 && !existingLabels.size;
    const createdVariants = admin(
      `
        mutation CreateVariants(
          $productId: ID!,
          $variants: [ProductVariantsBulkInput!]!,
          $strategy: ProductVariantsBulkCreateStrategy
        ) {
          productVariantsBulkCreate(
            productId: $productId,
            variants: $variants,
            strategy: $strategy
          ) {
            productVariants { id }
            userErrors { field message }
          }
        }
      `,
      {
        productId: shopifyProduct.id,
        variants: (hasStandaloneVariant ? sizes : missingSizes).map((size) => ({
          price: String(size.price),
          optionValues: [{ optionName: "Size", name: variantLabel(size.grams) }],
        })),
        strategy: hasStandaloneVariant
          ? "REMOVE_STANDALONE_VARIANT"
          : "PRESERVE_STANDALONE_VARIANT",
      },
    ).productVariantsBulkCreate;
    assertNoUserErrors(createdVariants, `Create ${product.title} sizes`);
    productWithVariants = loadVariants();
  }

  const variants = productWithVariants.variants.nodes;
  const sizesByLabel = new Map(
    sizes.map((size) => [variantLabel(size.grams), size]),
  );
  const sizedVariants = variants.map((variant) => {
    const size = sizesByLabel.get(getSizeOption(variant));
    if (!size) {
      throw new Error(
        `${product.title} has a Shopify variant without a valid Size option.`,
      );
    }
    return { ...variant, size };
  });

  const priceUpdate = admin(
    `
      mutation SetPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id price }
          userErrors { field message }
        }
      }
    `,
    {
      productId: shopifyProduct.id,
      variants: sizedVariants.map((variant) => ({
        id: variant.id,
        price: String(variant.size.price),
      })),
    },
  ).productVariantsBulkUpdate;
  assertNoUserErrors(priceUpdate, `Set ${product.title} prices`);

  for (const variant of sizedVariants) {
    const tracking = admin(
      `
        mutation TrackInventory($id: ID!, $input: InventoryItemInput!) {
          inventoryItemUpdate(id: $id, input: $input) {
            inventoryItem { id tracked }
            userErrors { field message }
          }
        }
      `,
      { id: variant.inventoryItem.id, input: { tracked: true } },
    ).inventoryItemUpdate;
    assertNoUserErrors(tracking, `Track ${product.title} inventory`);

    const activation = admin(
      `
        mutation ActivateInventory($inventoryItemId: ID!, $locationId: ID!) {
          inventoryActivate(
            inventoryItemId: $inventoryItemId,
            locationId: $locationId
          ) @idempotent(key: "the-source-${product.handle}-${variant.size.grams}-activate") {
            inventoryLevel { id }
            userErrors { field message }
          }
        }
      `,
      {
        inventoryItemId: variant.inventoryItem.id,
        locationId: location.id,
      },
    ).inventoryActivate;
    assertNoUserErrors(activation, `Activate ${product.title} inventory`);
  }

  const quantityUpdate = admin(
    `
      mutation SetInventory($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) @idempotent(key: "the-source-${product.handle}-set-inventory") {
          inventoryAdjustmentGroup { id }
          userErrors { field message }
        }
      }
    `,
    {
      input: {
        name: "available",
        reason: "correction",
        quantities: sizedVariants.map((variant) => ({
          inventoryItemId: variant.inventoryItem.id,
          locationId: location.id,
          quantity: product.stock,
          changeFromQuantity:
            variant.inventoryItem.inventoryLevels.nodes
              .find((level) => level.location.id === location.id)
              ?.quantities.find((quantity) => quantity.name === "available")
              ?.quantity ?? 0,
        })),
      },
    },
  ).inventorySetQuantities;
  assertNoUserErrors(quantityUpdate, `Set ${product.title} stock`);

  if (!product.comingSoon) {
    const published = admin(
      `
        mutation PublishProduct($productId: ID!, $publications: [PublicationInput!]!) {
          publishablePublish(id: $productId, input: $publications) {
            publishable { availablePublicationsCount { count } }
            userErrors { field message }
          }
        }
      `,
      {
        productId: shopifyProduct.id,
        publications: publications.map((publication) => ({
          publicationId: publication.id,
        })),
      },
    ).publishablePublish;
    assertNoUserErrors(published, `Publish ${product.title}`);
  }

  synced.push({
    handle: product.handle,
    productId: shopifyProduct.id,
    variants: sizedVariants.map((variant) => ({
      grams: variant.size.grams,
      variantId: variant.id,
    })),
    published: !product.comingSoon,
  });
}

console.log(
  JSON.stringify(
    {
      location: location.name,
      publications: publications.map((publication) => publication.name),
      synced,
    },
    null,
    2,
  ),
);