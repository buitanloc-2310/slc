# Trung tâm Học tập Số Sky First Network — V11 Pages Fresh Rebuild

V11 sử dụng installer D1 mới hoàn toàn theo cơ chế **one statement at a time** dành cho Cloudflare Pages Functions. Không còn dùng installer `DB.exec()` của V10.x.

- Public website + SFN account
- Account request / tracking / activation email
- Classes, materials, assignments, exams, support
- Admin Control Center
- D1 metadata + R2 files
- Giới hạn tối đa 10.000 tài khoản SFN
- Cài schema trực tiếp từ website bằng `SETUP_TOKEN`

## Deploy Pages

```text
Framework preset: None
Build command: npm install && npm run check
Build output directory: public
Root directory: SFN-SLC-VIPPRO
```

Sau deploy, kiểm tra `/api/health` và `/api/setup/installer-info` trước khi bấm cài dữ liệu.

Xem `V11-FRESH-REBUILD.md` để biết cơ chế installer mới.

