# ASE WMS Web

Web dashboard for the **Aniah Social Events Warehouse Management System (ASE WMS)** — the computer-side half of a two-interface inventory system.

**Scope:** [Project Scope Statement - ASE WMS](https://agustindevelops.atlassian.net/wiki/spaces/ASE/pages/161775617/Project+Scope+Statement+-+ASE+WMS)

## Purpose

ASE WMS gives Aniah Social Events a single place to track what inventory the business owns, how many units are available, where each item is stored, what is assigned to upcoming events, and what was picked up or returned (including shortages and damage).

This repo (`ase-wms-web`) is the **web dashboard**: detailed inventory administration, search/filter, and completing item records that are awkward to edit on a phone. It shares the same inventory data as the mobile warehouse app (`ase-wms-app`), which is optimized for on-site cataloging, pulling, and returning.

Together they establish the inventory foundation needed for a later customer-facing rental storefront (out of scope for the initial MVP).

## Role in the system

| Interface | Repo | Primary use |
| --- | --- | --- |
| Web dashboard | `ase-wms-web` (this project) | Full catalog, detailed item fields (description, pricing, materials, purchase links), search/filter, admin workflows from a computer |
| Mobile warehouse app | `ase-wms-app` | Fast cataloging (photo, name, qty, location), pull lists, scan pick/return on the warehouse floor |

Per the scope statement, **Admin** (business owner) is the active role for MVP. Staff-limited access is deferred until there are employees who need pick/return-only permissions.

### Web dashboard responsibilities (from scope)

- View and manage the full inventory catalog
- Complete or update detailed item information after mobile cataloging
- Search and filter inventory
- Manage prices, descriptions, categories, and purchase/replacement links
- Support pick/return and missing/broken quantity review (shared data with the mobile app)
- Event schedule / booking views may move to phase 2

### Explicitly out of MVP scope

Customer storefront, accounts, payments, delivery routing, advanced analytics, accounting integrations, and polished visual design are excluded from the 24-hour MVP. See the [scope statement](https://agustindevelops.atlassian.net/wiki/spaces/ASE/pages/161775617/Project+Scope+Statement+-+ASE+WMS) for the full exclusion list.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Auth / data | Firebase Auth + Firestore |
| Mobile companion | `ase-wms-app` (Expo barcode / label printing) |

Scaffolded from the [Next.js Firebase starter](https://github.com/milliorn/nextjs-firebase-starter); branding aligned with [aniahsocialevents.com](https://aniahsocialevents.com/).

## Getting started

```bash
cp .env.example .env.local
# fill Firebase + optional API keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users land on the branded admin portal; signed-in users go to `/admin`.

## Firebase + ase-wms-app tokens

Use the **same Firebase project** for this web admin and `ase-wms-app`.

- Client `NEXT_PUBLIC_FIREBASE_*` values can be shared across apps (they are public by design).
- Authenticated calls should send the Firebase **ID token** (`Authorization: Bearer <idToken>`). That is the cross-app credential — you do not need a separate opaque cross-reference token for Auth.
- Server routes that trust the mobile app should verify ID tokens with Firebase Admin (`FIREBASE_ADMIN_*` in `.env.example`).
- Optional static `ASE_WMS_API_KEY` is only for machine-to-machine fallbacks; prefer ID tokens.

See `.env.example` for the full template.

## Branding

Colors, Nickainley display font, logos, and floral imagery follow the marketing site (`aniah-social-events`):

- cream `#FFFCF9`, brown scale, peach accents, green CTAs
- logos under `public/images/`
- favicons under `public/favicon/`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

## Project layout

```
src/
  app/           # routes: /, /signin, /signup, /admin
  components/    # shared UI (e.g. LoadingOverlay)
  context/       # AuthContextProvider
  firebase/      # Auth + Firestore helpers
  constant/      # env helpers
  lib/api/       # aseApiFetch (Bearer ID token)
public/
  images/        # ASE logos + floral background
  fonts/         # Nickainley
  favicon/
```

## Constraints

From the project scope: **Time → Budget → Quality**. MVP targets a functional dashboard on free-tier / already available resources; reliability and accurate inventory data outrank visual polish.
