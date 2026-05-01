# TIRYAQ Frontend

This repository contains the TIRYAQ user-facing web application.
It is built with Next.js and is intended to be deployed independently from the backend service.

## Purpose

The frontend is responsible for:

- application pages and routing
- patient and doctor dashboards
- multilingual UI rendering
- community and publication interfaces
- AI assistant user experience
- frontend-side Supabase session flows
- proxying or calling backend API endpoints

Business logic and protected server integrations should remain in the backend repository.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase client SDK
- Framer Motion

## Local development

Install dependencies and start the app:

```powershell
npm install
npm run dev
```

Default local URL:

- `http://127.0.0.1:3000`

For a complete local stack, run the backend separately on:

- `http://127.0.0.1:4000`

## Available scripts

```powershell
npm run dev
npm run dev:webpack
npm run build
npm run start
npm run lint
```

## Environment variables

Use `.env.example` as the base configuration.

Main groups:

- Supabase public app keys
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- AI-related public Supabase keys
  - `NEXT_PUBLIC_AI_SUPABASE_URL`
  - `NEXT_PUBLIC_AI_SUPABASE_ANON_KEY`
- frontend to backend routing
  - `BACKEND_ORIGIN`
  - `NEXT_PUBLIC_BACKEND_ORIGIN`
- public application origin
  - `APP_BASE_URL`
  - `NEXT_PUBLIC_APP_BASE_URL`

Important:

- In local development, point backend origin variables to `http://127.0.0.1:4000`.
- In production, both backend origin variables must point to the deployed backend service, not to the frontend URL.

## Project structure

- `src/app/`: routes and layouts
- `src/components/`: reusable UI components
- `src/features/`: feature-oriented modules
- `src/lib/`: shared frontend libraries such as i18n
- `src/utils/`: helpers, API adapters, Supabase utilities
- `public/`: static assets, icons, fonts, manifest files

## Integration notes

- The frontend depends on the backend for AI chat, AI vision, admin APIs, and other protected flows.
- UI text should be connected to the active language state instead of being hardcoded in components.
- When adding or changing API payloads, update the backend contract at the same time.

## Deployment

Recommended target: Vercel

Typical production settings:

- build command: `npm run build`
- start command: `npm run start`
- root directory: this repository root

Before deployment, verify:

- backend origin variables point to the live backend
- app base URL variables match the public frontend domain
- all required public environment variables are set

## Related repositories

- root workspace repository: overall coordination/documentation
- backend repository: API, AI orchestration, admin logic, database-facing routes
