# The Source — Hostinger Launch Guide

This archive contains the complete The Source workspace:

- `apps/the-source-website/` — Vite website
- `apps/the-source-mobile/` — Expo iOS/Android source
- `services/api-server/` — Express API for products, carts, checkout, accounts, and orders
- `lib/` — shared database, API schema, generated clients, and authentication packages
- `source-assets/` — logos and product media

## Important: Hostinger requires two web apps for the full experience

The website is a static Vite build. The API is a separate Node.js process. For Shopify cart, checkout, accounts, orders, wholesale forms, and reviews to work in production, deploy both:

1. A website Web App on `thesourcerosin.store`
2. An API Web App on `api.thesourcerosin.store`

Hostinger's Node.js Web App flow is available on supported Business Web Hosting and Cloud plans. If your plan does not show **Websites → Add Website → Node.js web app**, use a Hostinger VPS or upgrade to a plan that supports Node.js Web Apps.

The Expo mobile source is included for native iOS and Android builds. It is not launched as a static website by the website Web App.

## 1. Upload the archive

You can either:

- Upload this archive in hPanel through **Websites → Add Website → Node.js web app → Upload your files**, or
- Put the extracted files in a GitHub repository and select **Import Git repository**.

For an archive upload, upload this archive as one project. Do not upload `node_modules`, build output, or the ZIP inside another ZIP.

The project root is the folder containing:

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/
services/
lib/
source-assets/
```

## 2. Website Web App settings

Create the first Hostinger Web App for the website.

Use:

```text
Application type: Other
Node.js version: 20
Project root: /
Build command:
corepack enable && pnpm install --frozen-lockfile && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/the-source-website build
Output directory:
apps/the-source-website/dist/public
Entry file:
leave blank for a static React/Vite output
```

If Hostinger asks for a start command for this static output, use the static/React option rather than starting Vite in development mode. Do not use `pnpm dev` in production.

Website environment variables:

```text
BASE_PATH=/
```

The build creates the deployable website at:

```text
apps/the-source-website/dist/public
```

The included SPA fallback file is copied into the website's public assets so direct links such as `/shop`, `/account`, and `/wholesale` continue to work on Apache-based hosting.

## 3. API Web App settings

Create a second Hostinger Web App for the API and attach it to:

```text
api.thesourcerosin.store
```

Use:

```text
Application type: Node.js
Node.js version: 20
Project root: /
Build command:
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server build
Entry/start command:
node --enable-source-maps services/api-server/dist/index.mjs
```

The API listens on Hostinger's assigned `PORT`. Do not replace it with a hardcoded public port.

Required API environment variables:

```text
NODE_ENV=production
DATABASE_URL=<your production PostgreSQL connection string>
SESSION_SECRET=<generate a new strong secret>
```

The current API also uses Replit-managed authentication and Shopify connector environment variables. Those values are not included in this archive. Before moving the API completely off Replit, configure an equivalent production Shopify integration and authentication setup on Hostinger, or keep the API running on Replit and point the website to that public API deployment.

Never commit these values to GitHub or upload them inside a visible `.env` file.

## 4. Connect the website to the API

The recommended arrangement is:

```text
https://thesourcerosin.store       → website Web App
https://api.thesourcerosin.store   → API Web App
```

The frontend should call the API through the public API hostname. Configure the mobile build variable as:

```text
EXPO_PUBLIC_DOMAIN=api.thesourcerosin.store
```

If the API is hosted separately, configure either a same-origin proxy at the website host or allow the website origin in the API's CORS settings. A static website alone cannot provide the API routes.

## 5. Point the custom domain

In Hostinger:

1. Open **Websites** and choose the website Web App.
2. Add or connect `thesourcerosin.store`.
3. At the domain's DNS management screen, apply the exact A/CNAME records Hostinger displays.
4. Add `www.thesourcerosin.store` if you want the `www` version.
5. Add `api.thesourcerosin.store` to the API Web App and apply its displayed DNS record.
6. Wait for DNS propagation.
7. Enable or confirm the free SSL certificate for both hostnames.

Do not point the main domain and API subdomain at the same Web App.

## 6. Verify the production launch

Test these in order:

1. `https://thesourcerosin.store` loads over HTTPS.
2. Refreshing `/shop`, `/account`, `/wholesale`, and `/contact` does not return a 404.
3. Products load from the API.
4. Add-to-cart works.
5. Shopify checkout opens.
6. Account login and logout work.
7. Review verification and submission work.
8. Wholesale submission works.
9. The API responds at `https://api.thesourcerosin.store`.

If the website loads but products do not, the frontend deployment is working and the API, database, Shopify integration, or CORS configuration still needs attention.

## 7. Native mobile app

The mobile code is in:

```text
apps/the-source-mobile/
```

Build the native app with Expo/EAS, not as a Hostinger static upload. Build it with the public API hostname:

```bash
EXPO_PUBLIC_DOMAIN=api.thesourcerosin.store pnpm --filter @workspace/the-source-mobile build
```

For App Store and Google Play builds, use Expo Application Services:

```bash
npx eas build --platform ios
npx eas build --platform android
```

The QR code for the mobile experience currently points to the existing Replit mobile URL. Regenerate that QR code after the mobile experience receives a new Hostinger or custom-domain URL.