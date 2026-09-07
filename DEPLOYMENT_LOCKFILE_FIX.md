# Netlify and Vercel lockfile fix

This deployment bundle pins the package manager to:

```text
pnpm 10.26.1
```

The lockfile was regenerated and verified with that exact version.

The deployment configuration also separates installation from the website build:

- Vercel uses `installCommand` for the frozen install.
- Netlify uses the pinned pnpm version inside the build command and sets `PNPM_VERSION`.
- The website build command only builds the Vite website.

When importing the repository:

- Set the project root to `/`.
- Do not set the root to `apps/the-source-website`.
- Keep the included `pnpm-lock.yaml`.
- Do not run `npm install` or generate a second `package-lock.json`.

If you edit dependencies later, regenerate the lockfile with pnpm 10.26.1 before pushing:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```