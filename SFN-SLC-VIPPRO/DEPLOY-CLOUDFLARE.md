# Deploy SLC đúng kiểu Cloudflare Worker

Dự án này là Cloudflare Worker + Assets + D1 + R2 + Durable Objects, KHÔNG phải Cloudflare Pages tĩnh.

## GitHub root phải có trực tiếp
- package.json
- wrangler.jsonc
- src/
- public/
- migrations/

Không để tất cả nằm trong thư mục con `SFN-SLC-VIPPRO/`.

## Cloudflare
Tạo/import dưới Workers, không chọn Pages static hosting.

- Install/build command: `npm install && npm run check`
- Deploy command: `npx wrangler deploy`
- Root directory: `/` (để trống nếu giao diện cho phép)

Sau đó chạy D1 migrations một lần:
`npx wrangler d1 migrations apply sfn-slc-db --remote`

Secrets:
- SETUP_TOKEN
- RESEND_API_KEY (nếu dùng email)

Custom domain:
- slc.skyfirst.io.vn
