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
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` — optional; both are needed to send new-order notifications.

Secrets can be added with `wrangler pages secret put SECRET_NAME --project-name green-glow`. Never put secret values in source control.

## Telegram notifications

Create a bot with [@BotFather](https://t.me/BotFather) using `/newbot`, then copy the bot token. Open a conversation with the new bot and send `/start`. Call Telegram's `getUpdates` endpoint using that bot token; the `message.chat.id` in the response is the chat ID to receive notifications. Add both values as Pages secrets. The bot sends the order details after the order is saved.

## Tests

Run the local tests with:

```powershell
npm test
```
