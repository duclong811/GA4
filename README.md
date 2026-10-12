# Real Mobile Traffic Simulator (Playwright Headless Browser)

Công cụ mô phỏng người dùng thật cầm điện thoại (iPhone, Samsung, Pixel) truy cập trang web `https://www.ai-smartserve.io.vn`, tự động chạy theo lịch trên GitHub Actions.

## Cơ chế hoạt động người thật 100%
- **Trình duyệt Chromium thật:** Mở trang web thật, tải mã nguồn HTML/JS, kích hoạt mã `gtag.js` tự nhiên như người dùng mở Safari/Chrome trên điện thoại.
- **Hiển thị ngay trên GA4 Realtime:** Vì là trình duyệt thật tải trang web thật, Google Analytics 4 nhận diện ngay lập tức trên bản đồ và số người hoạt động trong 30 phút.
- **Phân loại Khách cũ vs Khách mới:**
  - 70% Khách quen quay lại (Returning Users): Tự động duy trì cookie `_ga` cố định.
  - 30% Khách mới (New Users): Phiên hoàn toàn mới, sinh sự kiện khách truy cập lần đầu.
- **Hành vi tự nhiên:** Cuộn lướt xem menu, click vào món ăn, lưu lại trang từ 10 - 20 giây.

---

## Cách chạy thủ công để test
1. Vào tab **Actions** trên GitHub Repo `GA4`.
2. Chọn workflow **Scheduled Real Mobile Traffic Simulator (Playwright)**.
3. Bấm nút **Run workflow**.
4. Mở Google Analytics vào mục **Reports $\rightarrow$ Realtime** để xem người dùng xuất hiện trực tiếp trên bản đồ!
