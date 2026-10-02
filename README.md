# Green Glow

Arabic storefront for Green Glow, deployed as a Cloudflare Pages project. Pages Functions save orders to D1; the administrator dashboard is available at `/admin`.

## Cloudflare setup

The Pages output directory is `public`. Create the D1 database and attach it to `wrangler.toml` as the `DB` binding, then apply the schema:

```powershell
wrangler d1 create green_glow_orders_db --binding DB --update-config
wrangler d1 migrations apply green_glow_orders_db --remote
```

Set these Pages secrets before deploying:

- `ADMIN_PASSWORD` — administrator sign-in password.
- `SESSION_SECRET` — a long, random value used to sign administrator sessions.

Secrets can be added with `wrangler pages secret put SECRET_NAME --project-name green-glow`. Never put secret values in source control.

## WhatsApp

Customers reach the shop through a floating WhatsApp button and a pre-filled order message shown after checkout. The number is `CFG.sellerWA` in `public/index.html`. The admin page links each order's phone to a WhatsApp chat.

## Tests

Run the local tests with:

```powershell
npm test
```
