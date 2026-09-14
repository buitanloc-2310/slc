# Nâng cấp từ slc-main.zip của người dùng

Baseline: đúng file `slc-main.zip` người dùng tải lên. Không lấy lại các ZIP cũ của trợ lý.

## Thay đổi thật
- Giữ nguyên `PBKDF2 iterations: 10000` trong `src/index.js`.
- Phòng học được thay giao diện toàn màn hình mới, tách khỏi giao diện website thường.
- Mỗi người tham gia tự bật/tắt micro, camera, chia sẻ màn hình độc lập.
- WebRTC tạo audio/video transceiver ngay khi kết nối, nên một người bật camera/micro sau khi đã vào phòng vẫn truyền được cho người khác mà không cần vào lại.
- Signaling fallback chạy bằng Cloudflare Pages + D1, không còn bắt buộc phải có Durable Object để mic/cam/chat hoạt động ở phòng nhỏ.
- Chat trong buổi học được lưu qua D1 và đồng bộ cho cả tài khoản lẫn khách.
- Có danh sách người tham gia, trạng thái mic/cam/chia sẻ màn hình, giơ tay, reaction, chọn thiết bị, trạng thái mạng và responsive mobile/tablet/desktop.
- Học viên không còn thấy mã tham gia lớp trên header lớp; giáo viên/trợ giảng vẫn thấy.
- Có hỗ trợ TURN qua biến môi trường `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` nếu cần vượt NAT/firewall khó.

## Giới hạn kỹ thuật
Kiến trúc WebRTC mesh phù hợp phòng nhỏ. Muốn phòng lớn như Google Meet ở quy mô hàng chục/hàng trăm người cần SFU chuyên dụng (LiveKit/Cloudflare Calls/mediasoup...) và TURN. Bản này không giả vờ biến mesh thành hạ tầng Meet quy mô lớn.
