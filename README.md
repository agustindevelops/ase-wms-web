# ASE WMS Web

Admin web app for Aniah Social Events warehouse management. Built from the [Next.js Firebase starter](https://github.com/milliorn/nextjs-firebase-starter) and branded to match [aniahsocialevents.com](https://aniahsocialevents.com/).

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Auth / data | Firebase Auth + Firestore |
| Mobile companion | `ase-wms-app` (Expo barcode / label printing) |

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
- Authenticated calls should send the Firebase **ID token** (`Authorization: Bearer <idToken>`). That is the cross-app credential — you do not need a separate opaque “cross-reference token” for Auth.
- Server routes that trust the mobile app should verify ID tokens with Firebase Admin (`FIREBASE_ADMIN_*` in `.env.example`).
- Optional static `ASE_WMS_API_KEY` is only for machine-to-machine fallbacks; prefer ID tokens.

See `.env.example` for the full template.

## Branding

Colors, Nickainley display font, logos, and floral imagery are aligned with the marketing site (`aniah-social-events`):

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
  context/       # AuthContextProvider
  firebase/      # Auth + Firestore helpers
  constant/      # env helpers
  lib/api/       # aseApiFetch (Bearer ID token)
public/
  images/        # ASE logos + floral background
  fonts/         # Nickainley
  favicon/
```
