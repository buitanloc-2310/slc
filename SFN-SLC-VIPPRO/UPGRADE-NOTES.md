# Bản nâng cấp vận hành

Bản này được nâng cấp trực tiếp từ source người dùng gửi, không lấy lại source cũ.

## Nâng cấp chính
- 8 dạng không gian lớp: lớp học, khóa học, nhóm học tập, workshop, phụ đạo, đào tạo TNV, CLB học tập, lớp sự kiện.
- Nhiều mã tham gia riêng cho từng lớp; giới hạn lượt dùng, bật/tắt mã, nhãn nhóm và vai trò học viên/quan sát viên.
- Mã tham gia không hiển thị cho học viên; chỉ giáo viên/trợ giảng thấy khu vực quản lý mã và QR.
- 4 chế độ live: lớp học, hội thảo, trình bày, thảo luận.
- Live có micro/camera tắt mặc định, khử vọng/giảm ồn phía trình duyệt, camera HD mục tiêu, chia sẻ màn hình, giơ tay, phản ứng, đếm người, chat, toàn màn hình.
- Giao diện tài khoản ẩn mã SFN khỏi khu vực người dùng thông thường; dùng nhãn vai trò thân thiện.
- Thành viên lớp không bị lộ mã tài khoản trong danh sách lớp.
- Thu gọn các dòng kỹ thuật/phiên bản không cần thiết trong UI quản trị.
- Lớp cũ tự tương thích: bảng mở rộng được tạo an toàn bằng CREATE TABLE IF NOT EXISTS khi dùng tính năng lớp hoặc chạy nâng cấp hệ thống.

## Bảo mật
- Mã tham gia riêng chỉ cấp quyền học viên hoặc quan sát viên. Không cho dùng mã công khai để tự nâng quyền giáo viên/trợ giảng.
- Quyền giáo viên/trợ giảng vẫn phải được quản trị hoặc người có quyền thêm trực tiếp.
