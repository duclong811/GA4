# GA4 Traffic Simulator (C# .NET 8 LTS)

Công cụ mô phỏng lưu lượng người dùng (Traffic & E-commerce Events) cho Google Analytics 4, chạy tự động theo lịch thông qua GitHub Actions.

## Tính năng
- **Mô phỏng Người dùng mới vs Người dùng cũ:**
  - 70% Khách quen quay lại (Returning Users) sử dụng pool `client_id` cố định.
  - 30% Khách mới (New Users) kèm sự kiện `first_visit`.
- **Phễu E-commerce đầy đủ:**
  - `session_start`
  - `page_view` (Menu/Trang chủ)
  - `view_item` (Xem món)
  - `add_to_cart` (Xác suất 60%)
  - `purchase` (Xác suất 40% của giỏ hàng)
- **Tự động chạy định kỳ:** Chạy mỗi 3 tiếng qua GitHub Actions cron job hoặc chạy thủ công qua nút `Run workflow`.

---

## Hướng dẫn đẩy lên GitHub Repository riêng

Mở PowerShell tại thư mục này (`Desktop/GaTrafficSimulator`) và chạy các lệnh:

```bash
git init
git add .
git commit -m "feat: initial GA4 traffic simulator in C# .NET 8"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo-moi>.git
git push -u origin main
```

---

## Cấu hình Secret trên GitHub

1. Truy cập repo của bạn trên GitHub $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
2. Bấm **New repository secret** và thêm 2 secret:
   - `GA_MEASUREMENT_ID`: Ví dụ `G-XXXXXXXXXX`
   - `GA_API_SECRET`: Tạo trong GA4 (**Admin** $\rightarrow$ **Data Streams** $\rightarrow$ chọn Stream $\rightarrow$ **Measurement Protocol API secrets**).

---

## Kiểm tra hoạt động
1. Vào tab **Actions** trên GitHub.
2. Chọn **Scheduled GA4 Traffic Simulator (C#)** $\rightarrow$ Bấm **Run workflow** để chạy thử.
3. Mở [Google Analytics](https://analytics.google.com/) $\rightarrow$ **Reports** $\rightarrow$ **Realtime** để xem các sự kiện được bắn về trực tiếp.
