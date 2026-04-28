# TIRYAQ Frontend

Frontend Next.js deployable on Vercel.

## Role

- pages, layouts, dashboards, community, assistant UI
- no business API routes hosted here
- all `/api/*` calls are rewritten to the backend service

## Local run

```powershell
npm install
npm run dev
```

Frontend listens on `http://127.0.0.1:3000`.

For local full-stack usage, run the backend separately on `http://127.0.0.1:4000`.

## Required environment variables

Copy `.env.example` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BACKEND_ORIGIN=http://127.0.0.1:4000`

## Vercel

- Root directory: `TIRYAQ/frontend`
- Build command: `npm run build`
- Output: Next.js default
- Environment variables required for production:
  - `BACKEND_ORIGIN=https://tiryaq-backeend.onrender.com`
  - `NEXT_PUBLIC_BACKEND_ORIGIN=https://tiryaq-backeend.onrender.com`
  - `APP_BASE_URL=https://tiryaq-chi.vercel.app`
  - `NEXT_PUBLIC_APP_BASE_URL=https://tiryaq-chi.vercel.app`
- `BACKEND_ORIGIN` and `NEXT_PUBLIC_BACKEND_ORIGIN` must both point to the Render backend, never to the Vercel frontend URL.
