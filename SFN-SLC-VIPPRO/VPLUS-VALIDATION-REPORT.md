# VPLUS — Release Validation Report

Release target: **Sky First School VPLUS — VIP PRO**

## Kết quả rà soát bắt buộc

- PASS — JavaScript syntax check cho backend, Durable Object, media client, classroom, AI và Pages Function.
- PASS — Static import path resolution.
- PASS — Named import/export compatibility; phát hiện và sửa mismatch `mountClassroomV13` → `mountClassroomVPLUS` trước khi đóng gói.
- PASS — Migration audit trên SQLite sạch: toàn bộ 12 file migration chạy theo thứ tự, 65 bảng được tạo, các bảng VPLUS bắt buộc đều tồn tại.
- PASS — Không còn frontend gọi đường dẫn cũ `/api/live/sfu/*` hoặc `live-v13`.
- PASS — Không còn thông báo người dùng kiểu “Mesh dự phòng”, “SFU · …”, hay thông báo reconnect gắn tên phiên bản cũ.
- PASS — `REALTIME_APP_SECRET`, `AI_API_KEY`, `AI_RESEARCH_API_KEY` không xuất hiện trong public frontend.
- PASS — Tab và pane hạ tầng chỉ dành cho `super_admin`; pane hệ thống bị loại khỏi DOM đối với role khác.
- PASS — Public health endpoint chỉ trả trạng thái dịch vụ tối thiểu.
- PASS — Setup/bootstrap không trả fingerprint token, SQL statement, D1 error/cause hoặc chi tiết hạ tầng cho giao diện người dùng.
- PASS — AI có permission guard, quota, audit, research adapter và action confirmation foundation.
- PASS — Teacher/student classroom sử dụng thông báo tự nhiên thay cho thuật ngữ hạ tầng.

## Lệnh kiểm tra tích hợp trong source

```bash
npm run validate:vplus
```

Lệnh này chạy syntax check và audit VPLUS trước mỗi lần phát hành.

## Phạm vi xác nhận

Không phát hiện lỗi trong các kiểm tra tĩnh, import/export, migration/schema và privacy/gating có thể chạy trong môi trường build hiện tại.

Một bản web realtime không thể được cam kết tuyệt đối “0 lỗi trên mọi thiết bị/mạng” nếu chưa chạy deployment production thật với Cloudflare bindings/secrets, SFU credentials, AI provider và ma trận browser/device thực tế. Vì vậy các lỗi runtime phụ thuộc hạ tầng bên ngoài vẫn phải được kiểm tra sau deploy bằng staging/canary trước khi mở rộng production.

## Cấu hình production không được hard-code

- `REALTIME_APP_ID`
- `REALTIME_APP_SECRET`
- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`
- tùy chọn: `AI_RESEARCH_URL`, `AI_RESEARCH_API_KEY`

Các secret phải cấu hình ở Cloudflare Secrets/Variables phù hợp, không đưa vào frontend hoặc commit giá trị bí mật.
