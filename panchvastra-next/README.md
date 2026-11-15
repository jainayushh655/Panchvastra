# PANCHVASTRA — Next.js application

Next.js App Router migration of the PANCHVASTRA storefront.

**This application is additive.** The Vite application in the repository root is still the
live storefront, is unchanged, and keeps its own `package.json`, scripts and Vercel
configuration. The two run independently, which is what makes the Vite app the reference
and the rollback for the whole migration: at any point, production can stay on it.

## Running it

```bash
cd panchvastra-next
npm install
npm run dev        # http://localhost:3000  (the Vite app uses :5173)
```

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Development server                           |
| `npm run build`     | Production build                             |
| `npm run start`     | Serves the production build                  |
| `npm run lint`      | ESLint over `src/`                           |
| `npm run typecheck` | `tsc --noEmit`                               |

No environment variables are required to run any of these. See `.env.example`.

## Layout

```
src/
├── app/            Routes, layout, providers, error/loading/not-found boundaries
├── components/     Shared UI
├── context/        React context providers
├── hooks/          Shared hooks
├── lib/            Pure utilities, env config, metadata defaults
├── mappers/        DTO -> UI model (ported from the Vite app)
├── services/       API layer
│   ├── http/       Browser: axios client, auth storage, multipart, pagination
│   └── server/     Server Components: anonymous `fetch` with Next caching
└── types/          Request/response DTOs and shared models (ported verbatim)
```

## Things worth knowing before changing anything

**The API layer is split by runtime, not by resource.** `services/http/client.ts` is the
browser client: it reads the JWT from `localStorage` in a request interceptor, so it can
never run in a Server Component. `services/server/serverApi.ts` is for Server Components:
anonymous `fetch`, Next cache integration, public catalogue reads only. Authenticated
reads stay in the browser.

**The 401 policy is load-bearing.** `services/http/client.ts` signs a user out on a 401 —
but never for the sign-in endpoints (a wrong OTP is a form error, not an expired session)
and never for the payment and order-placement endpoints (money may already have moved).
That allow-list lives in `services/endpoints.ts`. Changing it has consequences that are
invisible in normal use.

**The theme is configured in CSS, not JavaScript.** There is no `tailwind.config.js`.
The brand palette, the re-anchored `white`/`black`/`zinc` ramp, the fonts and the type
scale are all in the `@theme` block in `src/app/globals.css`. `--color-white` is cream,
deliberately — see the comment there before "fixing" it.

**Environment variables are split by visibility.** `src/lib/env.ts` holds `NEXT_PUBLIC_*`
values, which are inlined into the browser bundle; nothing secret may go there.
`src/lib/env.server.ts` holds server-only values and throws if read from the browser.

## Migration phases

1. ~~Migration audit~~ — complete
2. ~~Next.js foundation~~ — complete (this commit)
3. Shared components and layouts
4. Customer website
5. Admin panel
6. API integration and regression testing
7. SEO and deployment

`/migration-status` shows the current state and whether the environment is configured.
It makes no API requests.
