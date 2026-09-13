# Trung tâm Học tập Số Sky First Network — V10 HARDENED SUPER CENTER

**Sky First Network Digital Learning Center** · `https://slc.skyfirst.io.vn`

V10 tập trung vào hai mục tiêu: **vận hành phần lớn trên website/Admin** và **giảm các lỗi lõi có thể gây mất quyền truy cập, lộ dữ liệu hoặc khóa người dùng**. D1 tiếp tục chỉ giữ dữ liệu quan hệ; R2 giữ tệp; Durable Object xử lý signaling realtime; trình duyệt giữ autosave cục bộ khi phù hợp.

## V10 nâng cấp chính

- Control Center tự nâng schema V10 khi Super Admin mở trang quản trị.
- Trang chẩn đoán lõi: D1, bảng V10, R2 binding, Durable Object, Resend và Setup Token.
- Ghi `request_id` cho lỗi server và lưu sự cố 5xx vào `system_incidents` để truy vết.
- Rate-limit đăng nhập theo định danh + IP băm; không lưu IP thô.
- Phiên đăng nhập dùng thời hạn cấu hình từ Admin; có force logout và tự dọn dữ liệu tạm.
- Sửa quyền truy cập lớp: bài tập, bài kiểm tra, bài nộp và file nộp không còn dựa vào ID đoán được.
- Kích hoạt tài khoản vô hiệu hóa các activation token cũ của cùng người dùng.
- Upload an toàn hơn: giới hạn file xác minh; xóa object R2 nếu insert metadata D1 lỗi; file HTML/SVG/JS nguy hiểm được tải xuống thay vì chạy inline cùng origin.
- Exam Mode có resume sau reload, autosave D1 + localStorage, timeout server, tự giải phóng lock khi hết thời gian và trình soạn MCQ trực tiếp trên web.
- Class Chat và Lịch lớp tích hợp ngay trong trang lớp.
- Giáo viên/trợ giảng xem bài nộp và chấm điểm trực tiếp trên web.
- Live Classroom dùng access token do backend cấp; client không còn tự khai role/name để signaling tin tưởng.
- Hỗ trợ khách vào phòng học bằng link riêng khi Admin cho phép; mic/camera vẫn tắt mặc định.
- Token phòng học đủ dài cho phiên học trên 12 giờ; WebRTC mesh vẫn chỉ phù hợp phòng nhỏ. Muốn lớp lớn cần SFU/TURN chuyên dụng.
- Public policy HTML được lọc các thẻ/thuộc tính nguy hiểm trước khi render.
- Security headers áp dụng cho API/static response; API trả lỗi kèm request ID thay vì lộ chi tiết exception nội bộ.

## Web-first / Admin-first

Sau deploy, các tác vụ thường ngày có thể làm trên Control Center: xét hồ sơ, cấp SFN ID, tạo hàng loạt tài khoản, phân quyền, khóa/mở, gửi lại link đặt mật khẩu, đăng xuất phiên, tạo/lưu trữ lớp, đổi mã lớp, thêm thành viên, quản lý ticket, website public, thông báo, email template, chính sách, xuất dữ liệu, dọn token/session và chạy chẩn đoán hệ thống.

### Nâng từ V9 lên V10

1. Deploy source V10.
2. Đăng nhập bằng Super Admin.
3. Mở **Control Center**. Frontend gọi `/api/admin/system/upgrade`; endpoint chạy migration idempotent cho V9 + V10.
4. Mở tab **Hệ thống** → **Kiểm tra lõi hệ thống**.
5. Nếu dùng email, bấm **Gửi email kiểm tra**.

Không bắt buộc chạy SQL thủ công khi Super Admin vẫn đăng nhập được. `migrations/0006_v10_hardening.sql` vẫn được giữ để CI, backup hoặc phục hồi.

## Cloudflare bindings

- D1 binding: `DB`
- D1 database ID: `6fd6a6c3-aae6-4b11-89e0-8e13a0e27d3c`
- R2 binding: `FILES`
- R2 bucket: `skyfirsthoctap`
- Durable Object binding: `LIVE_ROOM`
- Secret cần thiết cho email: `RESEND_API_KEY`
- Secret khởi tạo hệ thống: `SETUP_TOKEN`
- Sender: `Trung tâm Học tập Số Sky First Network <slc@skyfirst.io.vn>`

## Kiểm tra trước deploy

```bash
npm run check
npx wrangler deploy --dry-run
```

Sau deploy dùng **Control Center → Hệ thống → Kiểm tra lõi hệ thống** để xác minh cấu hình thật trên Cloudflare.

> V10 giảm đáng kể các lỗi đã phát hiện bằng static audit và kiểm tra migration, nhưng không nên tuyên bố bất kỳ hệ thống phần mềm nào “không thể có lỗi”. Với dữ liệu thật, nên thử nghiệm staging trước khi mở rộng quy mô.
