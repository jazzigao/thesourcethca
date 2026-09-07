# The Source — Website + Mobile App

A clean, transferable GitHub workspace containing the current The Source website, matching Expo mobile app, shared API server, generated API clients, source assets, and deployment configuration for rebuilds on GitHub, Netlify, Vercel, and a future custom domain.

The website and mobile app share the same emblem, palette, typography direction, product data, item-name gradients, menu labels, age gate, Shopify commerce flow, and updated farmer-owned brand story. Each platform keeps its native responsive presentation for a polished desktop, mobile-web, iOS, and Android experience.

## Project layout

- `apps/the-source-website/` — Vite storefront website
- `apps/the-source-mobile/` — Expo Router mobile app
- `services/api-server/` — Express API for Shopify, auth, carts, checkout, and orders
- `lib/` — shared database, API schema, generated clients, and auth packages
- `scripts/` — catalog and workspace scripts
- `source-assets/` — packaged logos, product images, and source media
- `.env.example` — deployment and custom-domain variables
- `netlify.toml` — Netlify website build and SPA fallback
- `vercel.json` — Vercel website build and SPA fallback

## Install from GitHub

```bash
pnpm install --frozen-lockfile
```

## Run locally

In separate terminals:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/the-source-website run dev
pnpm --filter @workspace/the-source-mobile run dev
```

For the website, use `PORT=3000 BASE_PATH=/`. For Expo, set `EXPO_PUBLIC_DOMAIN` to the public API hostname before starting the app. The mobile client intentionally uses the public domain rather than a hardcoded localhost URL.

## Build the website

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/the-source-website build
```

The static output is written to `apps/the-source-website/dist/public`.

## Check/build the mobile app

```bash
pnpm --filter @workspace/the-source-mobile typecheck
pnpm --filter @workspace/the-source-mobile test
EXPO_PUBLIC_DOMAIN=your-domain.example pnpm --filter @workspace/the-source-mobile build
```

Generated mobile build output is intentionally excluded from the archive and should be rebuilt in CI or the target app service.

## Deploy to Hostinger

See `HOSTINGER_DEPLOYMENT.md` for the Hostinger Web App settings. The full launch uses a website Web App and a separate API Web App; the Expo mobile source is included for native EAS builds.

## Frozen lockfile deployment

This export pins pnpm to 10.26.1 and includes platform-specific install configuration in `netlify.toml` and `vercel.json`. See `DEPLOYMENT_LOCKFILE_FIX.md` before importing the repository.

## Deploy from GitHub to Netlify or Vercel

1. Put the extracted workspace in a GitHub repository.
2. Import the repository into Netlify or Vercel from the repository root.
3. Use the included `netlify.toml` or `vercel.json`; both build the website and publish the SPA output.
4. Deploy `services/api-server/` as the API service, or route `/api/*` from the website host to the API service.
5. If the API is separate, replace the placeholder API hostname in `netlify.toml` and add the equivalent Vercel rewrite.
6. Set `EXPO_PUBLIC_DOMAIN` to the public hostname serving the API routes.
7. Attach the custom domain in the Netlify or Vercel domain settings. The website build uses `BASE_PATH=/`, so it is ready for a root custom domain.

Keep Shopify credentials, session secrets, database URLs, and API credentials in GitHub/Netlify/Vercel secret settings. Never commit them to this repository.

## QR codes

The `qr-codes/` folder contains ready-to-print assets for the current public destinations:

- `qr-codes/website-qr.png` — https://thesourcerosin.store
- `qr-codes/mobile-app-qr.png` — https://solventless-rosin-store.replit.app/mobile/
- `qr-codes/printable-qr-sheet.html` — two-code sheet designed for browser printing
- `qr-codes/qr-manifest.json` — machine-readable destination list

## Rebuildability notes

- The archive excludes `node_modules`, build output, Expo caches, screenshots, Replit-only artifact manifests, and temporary files.
- The frozen lockfile is included for reproducible installs.
- The exported website uses the packaged `source-assets/` directory through its Vite alias.
- The workspace aligns React type packages in the export so a clean web-plus-Expo install can pass typechecking.
- The navigation uses separated, equal-width tabs on web and mobile.
- Current brand copy is present in both platforms: “Small-batch, cold-cure live hash rosin. Cultivated with intention, washed with care by hand, and sold directly by the farmers that grew it from seed. Everything is artisan designed and made with love and care, and we hope you can see and feel the difference.”

## Verification

- Website typecheck passed from a clean extracted install.
- Website production build passed with `PORT=3000 BASE_PATH=/`.
- Mobile typecheck passed.
- Mobile tests passed: 6/6.
- Archive integrity, legacy filename, and generated-file checks passed.
