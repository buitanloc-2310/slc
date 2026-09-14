# Kiểm tra SETUP_TOKEN trên Pages

Sau khi deploy, mở `/api/health`. Trường `environment.setup_token_configured` phải là `true`; `d1_bound` và `r2_bound` cũng nên là `true`. API không bao giờ hiển thị giá trị SETUP_TOKEN.

Nếu vừa thêm hoặc đổi Secret trong Cloudflare Pages, tạo/redeploy một Production deployment mới trước khi thử lại.

Mã lỗi:
- `SETUP_TOKEN_NOT_CONFIGURED`: deployment không nhận secret.
- `SETUP_TOKEN_MISMATCH`: secret có tồn tại nhưng mã nhập không khớp.
- `D1_NOT_BOUND`: Pages Function chưa có binding DB.
