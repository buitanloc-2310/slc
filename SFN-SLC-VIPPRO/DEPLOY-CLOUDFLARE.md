# Deploy Cloudflare — V10

Dự án này là **Cloudflare Worker**, không phải Pages static-only.

Nếu repository vẫn có thư mục bọc `SFN-SLC-VIPPRO/`:

- Root directory: `SFN-SLC-VIPPRO`
- Build command: `npm install && npm run check`
- Deploy command: `npx wrangler deploy`
- Không nhập Build output directory kiểu Pages.

Bindings đã khai trong `wrangler.jsonc`:

- `DB` → D1 `sfn-slc-db`
- `FILES` → R2 `skyfirsthoctap`
- `LIVE_ROOM` → Durable Object `LiveRoom`

Secrets cần đặt trong Cloudflare:

- `SETUP_TOKEN`
- `RESEND_API_KEY`

Sau khi deploy V10 từ V9: đăng nhập Super Admin → mở **Control Center** → tab **Hệ thống** → **Kiểm tra lõi hệ thống**. Control Center tự gọi endpoint nâng schema idempotent.
