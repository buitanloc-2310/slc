# SLC — Trung tâm Học tập Số Sky First Network

Domain: `https://slc.skyfirst.io.vn`

Bản source này là nền tảng chạy trên Cloudflare Workers, D1, R2 và Durable Objects.

## Hạ tầng đã chốt

- D1 binding: `DB`
- D1 database id: `6fd6a6c3-aae6-4b11-89e0-8e13a0e27d3c`
- R2 binding: `FILES`
- R2 bucket: `skyfirsthoctap`
- Durable Object binding: `LIVE_ROOM`
- Email hỗ trợ hiển thị: `support@skyfirst.io.vn`

## Chức năng đã viết chạy thật trong source

- Giao diện SLC responsive, gradient rực rỡ, không dùng nền trắng tinh làm chủ đạo.
- Logo Sky First do chủ dự án cung cấp.
- Footer: Quyền riêng tư, Bảo mật, Điều khoản, Hỗ trợ, nhận diện Việt Nam.
- Chỉ tài khoản SFN được đăng nhập; không có đăng ký tự do.
- Form yêu cầu cấp tài khoản có ảnh chân dung, ảnh HS/SV, đơn vị học tập, lớp/khóa, SFN unit, vai trò, mục đích, quyền mong muốn.
- Admin duyệt yêu cầu và hệ thống cấp SFN ID.
- Kích hoạt tài khoản bằng token và tự đặt mật khẩu.
- Giới hạn giai đoạn khởi tạo tối đa 10.000 tài khoản, cưỡng chế ở cả API và D1.
- Quản lý phiên đăng nhập bằng cookie HttpOnly/Secure/SameSite.
- Lớp học, mã lớp, tham gia bằng mã.
- Bảng tin lớp.
- Học liệu upload trực tiếp vào R2.
- Bài tập và nhiệm vụ TNV.
- Nộp bài dạng text/file.
- Kiểm tra định kỳ, autosave, event log, chấm tự động MCQ/True-False.
- Chế độ kiểm tra khóa các khu khác trong SLC khi phiên thi đang hoạt động.
- Ghi nhận rời tab, blur, fullscreen exit, copy, paste.
- Phòng học WebRTC thật cho lớp nhỏ: mic, camera, share screen, chat realtime.
- Signaling realtime dùng Durable Object, không ghi presence/cam/mic liên tục vào D1.
- QR lớp sinh trực tiếp trên web.
- PDF/TXT/MD/CSV/JSON -> trích nội dung -> tạo quiz draft trên web.
- Support ticket thật.
- Admin Control Center và thống kê tài khoản/lớp/yêu cầu.
- Optional Resend: gửi email kích hoạt nếu có `RESEND_API_KEY`.

## Giới hạn kỹ thuật cần hiểu đúng

Phòng học hiện dùng WebRTC mesh, hoạt động thật nhưng phù hợp lớp nhỏ. Khi cần hàng chục/hàng trăm camera đồng thời, nên thay media layer bằng SFU riêng. Source hiện không giả vờ có SFU.

Website có thể khóa các chức năng trong SLC và phát hiện một số sự kiện trình duyệt khi thi, nhưng trình duyệt không thể khóa toàn bộ Windows/macOS. Thi nghiêm ngặt cấp kiosk cần SFN Exam Client/Safe Exam Browser tương thích ở giai đoạn sau.

## Khởi tạo

1. Cài Node.js.
2. Chạy `npm install`.
3. Chạy migrations:

```bash
npm run db:migrate
```

4. Tạo secret bootstrap:

```bash
npx wrangler secret put SETUP_TOKEN
```

5. Nếu muốn gửi email kích hoạt tự động:

```bash
npx wrangler secret put RESEND_API_KEY
```

6. Deploy:

```bash
npm run deploy
```

7. Khởi tạo Super Admin đầu tiên duy nhất:

```bash
curl -X POST https://slc.skyfirst.io.vn/api/setup/bootstrap \
  -H "content-type: application/json" \
  -H "x-setup-token: YOUR_SETUP_TOKEN" \
  -d '{"full_name":"SFN Super Admin","email":"admin@example.com","phone":"","password":"CHANGE-THIS-STRONG-PASSWORD"}'
```

Sau khi đã có user đầu tiên, endpoint bootstrap tự từ chối chạy lại.

## Giới hạn 10.000 tài khoản

Có ba lớp bảo vệ:

1. `users.sfn_no CHECK(sfn_no BETWEEN 1 AND 10000)`.
2. Trigger `trg_users_max_10000` chặn insert khi đủ 10.000 user.
3. Counter API chỉ tăng khi `value < 10000`.

Do đó giai đoạn khởi tạo không thể cấp SFN ID vượt quá `SFN10000`.

## Cấu trúc dữ liệu

D1 chỉ giữ metadata/quan hệ cần bền vững: account, class, membership, assignment, exam, score, ticket...

R2 giữ file nặng: ảnh xác minh, học liệu, bài nộp.

Durable Objects giữ signaling realtime cho live classroom.

## Chính sách thiết kế

- Icon dùng cùng hệ SVG `currentColor`, không mỗi icon một màu.
- Màu rực rỡ nằm ở gradient/background/card, không biến icon thành bảng màu.
- Nhận diện Việt Nam được đặt tinh tế ở footer.
- Không sử dụng wording khiến SLC tự nhận là cơ sở giáo dục được cấp phép.
