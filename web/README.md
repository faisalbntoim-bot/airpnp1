# SakanHubb — Web (Marketing Site)

Public marketing website for SakanHubb — a Saudi real-estate platform.
Built with **Next.js 14 (App Router) + TypeScript**. Server-rendered
static pages with i18n (Arabic default + English), RTL-aware, no
JavaScript required to view.

**This project is not the app itself.** The iOS app lives in `../ios/`,
the backend lives in `../backend/`. This site only advertises the
product — it has no access to production data, no secrets, and no
payment integration.

## Absolute rules

- ❌ No secrets in source, env, or Vercel environment variables of this project
  (no `JWT_SECRET`, no `TAP_SECRET_KEY`, no `MOYASAR_SECRET_KEY`, no DB URL, no SMS keys)
- ❌ No payment collection or card data
- ❌ No production API wiring (this repo does not fetch from the SakanHub backend)
- ✅ Anything you put in `.env` here must start with `NEXT_PUBLIC_` and be safe to publish

Public marketing pages only. Signups + payments belong in the app.

## Local development

Requirements: Node 20+ (Node 22 verified).

```bash
cd web
npm install
npm run dev
# open http://localhost:3000  → redirects to /ar
#                             → /en for the English version
```

Type-checking and production build:

```bash
npm run typecheck
npm run build
```

## Structure

```
web/
├── app/
│   ├── globals.css              # design tokens + component styles (light + dark)
│   ├── layout.tsx               # root shell (no <html>)
│   ├── page.tsx                 # / → redirect to /ar (default locale)
│   ├── [locale]/
│   │   ├── layout.tsx           # sets <html lang dir>, metadata, OG, icons
│   │   └── page.tsx             # renders the landing sections
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── Header.tsx               # sticky nav + language toggle
│   ├── Hero.tsx
│   ├── Features.tsx             # 6 feature cards with inline SVG icons
│   ├── HowItWorks.tsx           # 4-step numbered flow
│   ├── CTA.tsx                  # signup band (opens with TestFlight)
│   └── Footer.tsx
├── lib/
│   └── i18n.ts                  # typed dictionary loader
├── messages/
│   ├── ar.json                  # Arabic copy (default)
│   └── en.json                  # English copy
├── public/
│   └── favicon.svg              # gold "S" wordmark
├── .env.example                 # empty — only NEXT_PUBLIC_* allowed
├── next.config.mjs              # security headers + strict-mode
├── tsconfig.json
└── package.json
```

## i18n

- Segment routing: `/ar` and `/en`
- Dictionary loaded synchronously from `messages/*.json` (typed via `Dictionary`)
- Language toggle in the header switches segment while preserving the current section anchor
- `<html lang dir>` is set per-locale by `app/[locale]/layout.tsx`
- All layout uses CSS logical properties so RTL / LTR share one rule set

To add a language:
1. Add `xx.json` to `messages/` mirroring the shape of `ar.json`.
2. Extend `locales` in `lib/i18n.ts`.
3. Update the header toggle if you want cycle behaviour.

## SEO

- Per-locale `<title>` + `<meta name="description">`
- Canonical + `alternates.languages` (`ar-SA`, `en-US`, `x-default`)
- Open Graph + Twitter card
- `robots.ts` + `sitemap.ts` generate `/robots.txt` and `/sitemap.xml` at build
- No tracking, no analytics, no third-party scripts

## Design

- Warm neutral ground (`--ground`), deep gold accent (`--accent`)
- System font stack — no web-font fetches (fast + private)
- Automatic light + dark theme via `prefers-color-scheme`
- Responsive breakpoints at 900px + 620px + 560px
- Reduced-motion aware
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<ol>`, `<footer>`

## Deploying to Vercel

1. Push this repo to GitHub (already done — branch on the parent repo).
2. From <https://vercel.com/new>, import `faisalbntoim-bot/airpnp1`.
3. **Root Directory**: `web`
4. **Build Command**: `npm run build`   *(default)*
5. **Output Directory**: `.next`         *(default)*
6. **Install Command**: `npm install`    *(default)*
7. Add the environment variable `NEXT_PUBLIC_SITE_URL` = `https://<your-domain>` (or the Vercel preview URL).
8. Deploy. Vercel automatically creates preview URLs for every branch.

### Custom domain

Once you own `sakanhub.com`:

- Vercel → Project → Settings → Domains → Add `sakanhub.com`
- Follow the DNS instructions (Vercel auto-provisions the TLS cert)
- Update `NEXT_PUBLIC_SITE_URL` to the final domain and redeploy

### Do NOT add to Vercel

- Server-side secrets of any kind
- Environment variables that are not prefixed `NEXT_PUBLIC_`
- Analytics or tracking IDs without a PDPL review

## Content copy source

`messages/ar.json` and `messages/en.json` are the single source of truth
for every string on the site. Non-technical edits happen there — no code
change required.
