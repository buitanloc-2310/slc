# Cloudflare Pages deployment — SLC V10 Pages Edition

## Màn Build configuration

```text
Framework preset: None
Build command: npm install && npm run check
Build output directory: public
Root directory: SFN-SLC-VIPPRO
```

Bản Pages Edition có thư mục `/functions`, vì vậy Cloudflare sẽ tự deploy Pages Functions cùng site public.

## Sau khi deploy

1. Kiểm tra `/api/health` phải trả JSON.
2. Kiểm tra `/api/setup/status`.
3. Đặt secret `SETUP_TOKEN`.
4. Đặt `RESEND_API_KEY` nếu dùng email.
5. Mở website và chạy khởi tạo lần đầu.

D1 và R2 đã được khai báo trong `wrangler.json` với binding `DB` và `FILES`.

Riêng realtime WebSocket cần Durable Object external binding theo giới hạn của Cloudflare Pages.
