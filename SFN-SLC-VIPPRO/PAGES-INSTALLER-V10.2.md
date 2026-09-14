# V10.2 Pages — Diagnostic Installer

Bản này thay đổi trình cài D1 để dễ xác định lỗi HTTP 500 trên Cloudflare Pages.

- Cài schema theo 3 stage: `core_schema`, `v9_schema`, `v10_schema`.
- Nếu D1 lỗi, API trả JSON có `detail.stage`, `detail.error`, `detail.cause`.
- Giao diện Setup hiển thị trực tiếp stage và lỗi D1 thay vì chỉ `HTTP 500`.
- Có thể chạy lại installer sau khi sửa lỗi; schema hiện dùng `CREATE ... IF NOT EXISTS` và `INSERT OR IGNORE` ở các phần cài đặt chính.
- Không trả hoặc ghi giá trị `SETUP_TOKEN` ra response.

Sau deploy, bấm Cài đặt dữ liệu hệ thống. Nếu còn lỗi, copy nguyên khối `Bước lỗi / D1 / Chi tiết` trên giao diện để xác định chính xác câu schema cần sửa.
