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
| Auth | Firebase Auth (client) + Firebase Admin (Bearer verify on API) |
| Database | Prisma 7 + PostgreSQL (server-only) |
| Mobile companion | `ase-wms-app` (Expo barcode / label printing) |

Scaffolded from the [Next.js Firebase starter](https://github.com/milliorn/nextjs-firebase-starter); branding aligned with [aniahsocialevents.com](https://aniahsocialevents.com/).

## Getting started

```bash
cp .env.template .env.local
# fill DATABASE_URL, NEXT_PUBLIC_FIREBASE_*, FIREBASE_ADMIN_*
npm install
npx prisma migrate dev --name init_user
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users land on the branded admin portal; signed-in users go to `/admin`.

## Firebase Bearer + Prisma (ASE-9)

Use the **same Firebase project** for this web admin and `ase-wms-app`. No NextAuth; APIs expect `Authorization: Bearer <Firebase ID token>`.

### Env checklist

See [`.env.template`](./.env.template). You need:

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Prisma Console → Connect → **direct TCP** `postgres://…` (not `prisma+postgres://`) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Console → Project settings → Web app |
| `FIREBASE_ADMIN_PROJECT_ID` / `CLIENT_EMAIL` / `PRIVATE_KEY` | Firebase Console → Service accounts → Generate private key |
| `S3_API_URL` | Cloudflare R2 S3 API URL: `https://<accountId>.r2.cloudflarestorage.com/<bucket>` |
| `CLOUDFLARE_ACCESS_KEY_ID` | Cloudflare → R2 → Manage API Tokens → Access Key ID |
| `CLOUDFLARE_ACCESS_KEY` | Same token screen → Secret Access Key (shown once) |

`DATABASE_URL`, `FIREBASE_ADMIN_*`, and Cloudflare R2 keys are **server-only** — never prefix them with `NEXT_PUBLIC_`.

### Pattern for secured API routes

```ts
import {
  isAuthFailure,
  requireFirebaseUser, // token only — no Prisma
  requirePrismaUser,   // token first, then User + organization membership
} from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) return auth.response; // 401, no DB

  // Only after verify:
  const rows = await prisma.$queryRaw`SELECT 1`;
  // Or: const { user, organization, role } = await requirePrismaUser(request);
}
```

`requirePrismaUser` loads the Prisma `User` and `OrganizationMembership` after Bearer verification. `organizationId` comes from the verified Firebase custom claim (stamped from membership). Authorization is organization-scoped. Warehouse routes additionally require that the path warehouse belongs to that organization.

Client helpers: `wmsFetch("/api/…", { idToken })` (same origin) or `aseApiFetch` for a remote API base URL.

### Smoke endpoints

| Route | Behavior |
| --- | --- |
| `GET /api/health` | Bearer required → `SELECT 1` |
| `GET /api/me` | Bearer required → user, organization, role, warehouses |
| `POST /api/img/upload` | Bearer → create `File` + presigned PUT (`{userId}/inventory/{fileId}`) |
| `POST /api/img/verify` | Bearer → HEAD/magic checks → `uploaded` + File row (fail deletes object+row) |
| `GET /api/test/img?file_id=` | Bearer → owner-scoped File + signed/public read URL |
| `DELETE /api/img/{id}` | Bearer → owner-scoped delete |

### Cloudflare R2 image uploads (ASE-11)

Only three env vars:

| Variable | Role |
| --- | --- |
| `S3_API_URL` | Bucket address (`endpoint` + `/bucket`) |
| `CLOUDFLARE_ACCESS_KEY_ID` | R2 S3 access key id |
| `CLOUDFLARE_ACCESS_KEY` | R2 S3 secret access key |

Do **not** use `CLOUDFLARE_API_TOKEN` for uploads — that is a different Cloudflare credential. Client apps never get R2 keys; they only receive a short-lived `upload_url` from `POST /api/img/upload`.

From `/admin`, use **Run authenticated smoke** after env + migrate are set.

## Branding

Colors, Nickainley display font, logos, and floral imagery follow the marketing site (`aniah-social-events`):

- cream `#FFFCF9`, brown scale, peach accents, green CTAs
- logos under `public/images/`
- favicons under `public/favicon/`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:push` | Push schema without migration files |
| `npm run db:seed` | Seed lookup rows (ADMIN role) |
| `npm run db:studio` | Prisma Studio |

## Project layout

```
prisma/          # schema + migrations
prisma.config.ts # DATABASE_URL for Prisma CLI
src/
  app/           # routes: /, /signin, /signup, /admin, /api/*
  app/api/       # health + me (Bearer → Prisma)
  components/    # shared UI (e.g. LoadingOverlay)
  context/       # AuthContextProvider
  firebase/      # client Auth + Firestore helpers
  lib/auth/      # Firebase Admin verify + requirePrismaUser
  lib/db/        # Prisma singleton, first-login warehouse bootstrap
  lib/api/       # wmsFetch / aseApiFetch (Bearer ID token)
  generated/     # Prisma client (gitignored; generated on install)
public/
  images/        # ASE logos + floral background
  fonts/         # Nickainley
  favicon/
```

## Constraints

From the project scope: **Time → Budget → Quality**. MVP targets a functional dashboard on free-tier / already available resources; reliability and accurate inventory data outrank visual polish.
