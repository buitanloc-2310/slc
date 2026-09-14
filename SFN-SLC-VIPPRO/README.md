# V10.1 Pages — Setup Token Diagnostics Hotfix

Bản này bổ sung chẩn đoán trực tiếp cho Cloudflare Pages khi khởi tạo hệ thống. `/api/health` chỉ trả về trạng thái boolean của binding/secret, tuyệt đối không trả giá trị secret. Nếu SETUP_TOKEN thiếu, sai, hoặc D1 chưa bind, API cài đặt trả mã lỗi riêng để biết chính xác nguyên nhân.

# Trung tâm Học tập Số Sky First Network — V10 Pages Edition

Phiên bản này được chuyển từ Worker-first sang **Cloudflare Pages + Pages Functions** để deploy trực tiếp bằng màn hình Pages Git Integration.

## Kiến trúc

- `public/` — giao diện web.
- `functions/api/[[path]].js` — gateway Pages Functions cho toàn bộ `/api/*`.
- `src/index.js` — lõi API V10 dùng chung.
- D1 `DB` — dữ liệu quan hệ và cấu hình.
- R2 `FILES` — tệp, học liệu, ảnh xác minh và bài nộp.
- `migrations/` — schema và migration dự phòng.

## Build

```text
Framework preset: None
Build command: npm install && npm run check
Build output directory: public
Root directory: SFN-SLC-VIPPRO
```

## Chức năng V10 giữ nguyên

Tài khoản SFN, giới hạn 10.000 tài khoản, yêu cầu cấp tài khoản, tra cứu, khởi tạo Super Admin, Control Center, phân quyền, lớp học, thành viên lớp, thông báo, học liệu R2, bài tập, bài nộp/chấm điểm, kiểm tra, chế độ thi, ticket hỗ trợ, CMS, email template, chính sách, nhật ký quản trị, incident log, chẩn đoán hệ thống và các cơ chế hardening của V10.

## Realtime

Cloudflare Pages không thể tự tạo Durable Object trong cùng Pages project. Source đã xử lý thiếu binding an toàn: các phần còn lại vẫn chạy; endpoint realtime trả 503 có mã `LIVE_SIGNALING_NOT_BOUND` cho đến khi binding Durable Object/Service được thêm.

Xem `PAGES-SETUP.md` để triển khai.


## V10.3 Pages D1 Installer Fix
- Sửa lỗi `PRAGMA foreign_keys = ON;` làm `/api/setup/install` trả `D1_EXEC_ERROR: incomplete input` trên Cloudflare Pages Functions.
- Installer tự loại bỏ PRAGMA `foreign_keys` trước khi gửi schema vào D1.
- Có thể chạy lại an toàn sau lần cài dở vì schema sử dụng `IF NOT EXISTS`/`INSERT OR IGNORE`.
