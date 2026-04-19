# SS & CMS Leadership Report

Internal IgniteTech dashboard for Strategic Services and CMS leadership reporting.

## Authentication — Google OAuth

Sign-in uses Google OpenID Connect (`openid-client` + Passport). The OAuth consent screen is configured as **Internal** in the Google Cloud project, which is what enforces the company-only perimeter. Code-side, the callback verifies the `hd` claim is non-empty (rejects personal Gmail) but never compares it to a specific domain — any IgniteTech Workspace domain (`@ignitetech.com`, `@khoros.com`, `@trilogy.com`, `@devfactory.com`, `@gfi.com`, …) is accepted.

**OAuth client:** in the GCP project managed by the app owner.
**Scopes:** `openid email profile`

**Registered redirect URIs** (must match Google Cloud Console exactly):

```
https://sscmadashboard.ignitetech.ai/api/auth/google/callback   (prod)
https://ps-leadership-report.replit.app/api/auth/google/callback (preview)
http://localhost:5000/api/auth/google/callback                   (dev)
```

**Environment variables:** see `.env.example`. In Replit, set these in Secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `DATABASE_URL`

## Development

```
npm install
cp .env.example .env   # fill in values
npm run dev            # starts on PORT (default 5000)
```

## Deployment

Deployed to Replit (`autoscale` target). `npm run build` then `npm run start`.
