# Classroom Experience Rebuild

Bản này được nâng trực tiếp từ source `slc-main.zip` và giữ nguyên cấu hình PBKDF2 `iterations: 10000` trong `src/index.js`.

## Những thay đổi chạy thật

- Giao diện lớp học mới dạng workspace riêng, không còn card/tab giao diện gốc.
- 8 dạng lớp: lớp học, khóa học, nhóm học tập, workshop, phụ đạo, đào tạo TNV, CLB học tập, lớp sự kiện.
- Nhiều mã tham gia cho cùng một lớp, giới hạn lượt dùng, hạn sử dụng, bật/tắt, vai trò học viên/quan sát viên.
- Mã lớp và SFN ID được ẩn khỏi giao diện học viên thông thường; quản trị/người phụ trách vẫn có công cụ quản lý.
- Phòng học trực tuyến có pre-join, chọn thiết bị, camera/micro tắt mặc định, khử vọng/giảm ồn/auto gain, HD camera, chia sẻ màn hình, chat, roster, giơ tay, reactions, fullscreen, PiP, phím tắt M/V/H, trạng thái kết nối.
- Giáo viên/trợ giảng có mute, tắt camera, remove thành viên, mute all, khóa phòng và đổi chế độ phòng.
- Responsive cho desktop/tablet/mobile. Safari/iOS sẽ tự ẩn tính năng không được trình duyệt hỗ trợ.
- Durable Object signaling worker thật nằm trong `live-worker/`. Pages cần binding `LIVE_SERVICE` tới Worker `sfn-slc-live` để WebRTC signaling hoạt động.

## Hạ tầng live

WebRTC hiện là mesh, phù hợp phòng nhỏ/vừa. Để chạy lớp đông theo mô hình Google Meet cần bổ sung SFU/TURN. Giao diện không giả lập tính năng đó và không tuyên bố sức chứa lớn khi chưa có SFU.
