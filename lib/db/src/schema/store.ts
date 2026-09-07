import {
  index,
  integer,
  boolean,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const productsTable = pgTable("store_products", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  potency: real("potency").notNull(),
  description: text("description").notNull(),
  strainType: text("strain_type").notNull(),
  lineage: text("lineage").notNull(),
  effects: text("effects").array().notNull(),
  flavorNotes: text("flavor_notes").array().notNull(),
  referenceLabel: text("reference_label"),
  referenceUrl: text("reference_url"),
  color: text("color").notNull(),
  stock: integer("stock").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  imageDisclaimer: text("image_disclaimer").notNull(),
  sizes: jsonb("sizes")
    .$type<Array<{ grams: number; price: number }>>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CheckoutIntentRequestItem = {
  productId: string;
  grams: number;
  quantity: number;
};

export type CheckoutIntentOrderItem = {
  productId: string;
  productName: string;
  grams: number;
  quantity: number;
  unitPrice: number;
};

export const checkoutIntentsTable = pgTable(
  "store_checkout_intents",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    ownerScope: varchar("owner_scope", { length: 255 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    requestItems: jsonb("request_items")
      .$type<CheckoutIntentRequestItem[]>()
      .notNull(),
    guestCheckout: boolean("guest_checkout").notNull(),
    status: varchar("status", { length: 30 }).notNull(),
    shopifyCartId: varchar("shopify_cart_id", { length: 255 }),
    checkoutUrl: text("checkout_url"),
    subtotal: numeric("subtotal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    orderItems: jsonb("order_items").$type<CheckoutIntentOrderItem[]>(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("store_checkout_intents_owner_key_idx").on(
      table.ownerScope,
      table.idempotencyKey,
    ),
    index("store_checkout_intents_status_idx").on(table.status),
  ],
);

export const checkoutIntentAuditTable = pgTable(
  "store_checkout_intent_audit",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    checkoutIntentId: varchar("checkout_intent_id", { length: 255 })
      .notNull()
      .references(() => checkoutIntentsTable.id, { onDelete: "cascade" }),
    operatorUserId: varchar("operator_user_id", { length: 255 })
      .notNull()
      .references(() => usersTable.id),
    action: varchar("action", { length: 50 }).notNull(),
    outcome: varchar("outcome", { length: 50 }).notNull(),
    note: text("note"),
    previousStatus: varchar("previous_status", { length: 30 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("store_checkout_intent_audit_intent_idx").on(table.checkoutIntentId),
    index("store_checkout_intent_audit_operator_idx").on(table.operatorUserId),
  ],
);

export const ordersTable = pgTable(
  "store_orders",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).references(() => usersTable.id),
    status: varchar("status", { length: 30 }).notNull(),
    subtotal: numeric("subtotal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    checkoutUrl: text("checkout_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("store_orders_user_id_idx").on(table.userId)],
);

export const orderItemsTable = pgTable(
  "store_order_items",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    orderId: varchar("order_id", { length: 255 })
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    productId: varchar("product_id", { length: 100 }).notNull(),
    productName: text("product_name").notNull(),
    grams: real("grams").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
  },
  (table) => [index("store_order_items_order_id_idx").on(table.orderId)],
);

export const reviewClaimsTable = pgTable(
  "store_review_claims",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    shopifyOrderId: varchar("shopify_order_id", { length: 255 }).notNull(),
    productId: varchar("product_id", { length: 100 }).notNull(),
    productName: text("product_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("store_review_claims_token_hash_idx").on(table.tokenHash),
    index("store_review_claims_order_product_idx").on(
      table.shopifyOrderId,
      table.productId,
    ),
    index("store_review_claims_expires_at_idx").on(table.expiresAt),
  ],
);

export const reviewsTable = pgTable(
  "store_reviews",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    shopifyOrderId: varchar("shopify_order_id", { length: 255 }).notNull(),
    productId: varchar("product_id", { length: 100 }).notNull(),
    productName: text("product_name").notNull(),
    reviewerName: varchar("reviewer_name", { length: 80 }).notNull(),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("store_reviews_order_product_idx").on(
      table.shopifyOrderId,
      table.productId,
    ),
    index("store_reviews_product_idx").on(table.productId),
    index("store_reviews_created_at_idx").on(table.createdAt),
  ],
);

export const newsletterSubscriptionsTable = pgTable(
  "newsletter_subscriptions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    status: varchar("status", { length: 20 }).notNull().default("subscribed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const wholesaleApplicationsTable = pgTable(
  "wholesale_applications",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    businessName: text("business_name").notNull(),
    businessType: varchar("business_type", { length: 80 }).notNull(),
    license: varchar("license", { length: 160 }).notNull(),
    contactName: text("contact_name").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 80 }).notNull(),
    location: text("location").notNull(),
    interest: varchar("interest", { length: 80 }).notNull(),
    volume: text("volume").notNull(),
    message: text("message"),
    status: varchar("status", { length: 30 }).notNull().default("received"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wholesale_applications_email_idx").on(table.email),
    index("wholesale_applications_status_idx").on(table.status),
  ],
);

export const insertProductSchema = createInsertSchema(productsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertCheckoutIntentSchema = createInsertSchema(
  checkoutIntentsTable,
).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  createdAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItemsTable);
export const insertReviewClaimSchema = createInsertSchema(reviewClaimsTable).omit({
  createdAt: true,
});
export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  createdAt: true,
});
export const insertNewsletterSubscriptionSchema = createInsertSchema(
  newsletterSubscriptionsTable,
).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertWholesaleApplicationSchema = createInsertSchema(
  wholesaleApplicationsTable,
).omit({
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type InsertCheckoutIntent = z.infer<typeof insertCheckoutIntentSchema>;
export type CheckoutIntent = typeof checkoutIntentsTable.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type InsertReviewClaim = z.infer<typeof insertReviewClaimSchema>;
export type ReviewClaim = typeof reviewClaimsTable.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
export type InsertNewsletterSubscription = z.infer<
  typeof insertNewsletterSubscriptionSchema
>;
export type NewsletterSubscription =
  typeof newsletterSubscriptionsTable.$inferSelect;
export type InsertWholesaleApplication = z.infer<
  typeof insertWholesaleApplicationSchema
>;
export type WholesaleApplication =
  typeof wholesaleApplicationsTable.$inferSelect;
