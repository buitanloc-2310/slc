# Cài đặt SLC V10 trên Cloudflare Pages

Bản này đã chuyển API từ Worker entrypoint sang **Pages Functions** để phù hợp với màn hình Cloudflare Pages mà dự án hiện có.

## Build configuration

Điền đúng:

- Framework preset: `None`
- Build command: `npm install && npm run check`
- Build output directory: `public`
- Root directory: `SFN-SLC-VIPPRO`

Không ghi `SFN-SLC-VIPPRO/public` trong ô Build output directory vì Root directory đã được đặt riêng.

## Bindings

Bản này khai báo D1 và R2 trong `wrangler.json`:

- D1 binding: `DB`
- Database ID: `6fd6a6c3-aae6-4b11-89e0-8e13a0e27d3c`
- R2 binding: `FILES`
- Bucket: `skyfirsthoctap`

Nếu Cloudflare dashboard yêu cầu tạo binding thủ công, dùng đúng tên binding trên.

## Secrets bắt buộc/khuyến nghị

Trong Pages project > Settings > Variables and Secrets:

- `SETUP_TOKEN`: mã bí mật do quản trị viên tự đặt để cài đặt lần đầu.
- `RESEND_API_KEY`: cần nếu muốn hệ thống gửi email thật qua Resend.

Không commit hai giá trị này vào GitHub.

## Kiểm tra sau deploy

Mở:

`https://<domain>/api/health`

Nếu Pages Functions hoạt động, API phải trả JSON thay vì HTML/405.

Sau đó mở:

`https://<domain>/api/setup/status`

Nếu D1 chưa có schema, giao diện cài đặt lần đầu sẽ cho phép nhập SETUP_TOKEN và khởi tạo hệ thống.

## Lớp học trực tuyến realtime

Cloudflare Pages Functions có thể **sử dụng** Durable Object, nhưng Cloudflare không cho tạo/deploy Durable Object ngay bên trong Pages project. Vì vậy toàn bộ phần tài khoản, D1, R2, lớp học, bài tập, thi, quản trị, email, hỗ trợ... chạy trên Pages Functions; riêng WebSocket realtime của phòng học cần một Durable Object Worker có sẵn và binding `LIVE_ROOM`, hoặc Service Binding `LIVE_SERVICE`.

Nếu chưa liên kết realtime, API phòng live trả mã 503 rõ ràng thay vì làm hỏng toàn hệ thống.
