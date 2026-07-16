# fetch-price.com

UK tech & appliance **price-drop alert** list → GVT / UKAIR affiliate rails (money path **D → A**).

Canonical clone: `C:\Users\dalec\repos\fetch-price` (prefer `repos\` over OneDrive).

## Netlify

| Field | Value |
|---|---|
| Site ID | `cf64488a-23c8-4c4e-ae52-4423c583ec24` |
| Domain | fetch-price.com |
| Publish | `.` |
| Functions | `netlify/functions` |
| Subscribe API | `POST /api/subscribe` |

## Environment variables (set in Netlify UI — do not commit)

| Var | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | yes (for live signup) | Resend API key |
| `RESEND_AUDIENCE_ID` | optional | Resend audience for contacts; omit until Dale creates one — do not invent IDs |
| `RESEND_FROM` | optional | defaults to `Fetch Price <alerts@fetch-price.com>` (domain must be verified in Resend) |

## Deploy

**Telegram-tap only** via `fleet/netlify-release` / manual Netlify deploy.  
**NEVER auto-deploy** on push. Credit guard ignore is in `netlify.toml`. Kill switch: `netlify-deploy-STOP.flag`.

```bash
# After Telegram approval — example release path (estate skill)
node …/netlify-release.mjs --approved-by telegram
# or: netlify deploy --prod --dir=.  (manual, approved)
```

## Local

Static pages: open `index.html` or any static server.  
Function needs Netlify CLI + env: `npx netlify dev`.

## Affiliate

ASA-style disclosure on every page and every alert email. Links may earn commission from Amazon / eBay / Awin.
