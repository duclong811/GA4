# Real Mobile Traffic Simulator (Giờ Việt Nam & Chuẩn GA4)

Công cụ mô phỏng người dùng thật cầm điện thoại truy cập trang web https://www.ai-smartserve.io.vn, tối ưu theo thói quen sinh hoạt và giờ mở cửa quán cafe tại Việt Nam.

## 🕒 Quy tắc vận hành theo Giờ Việt Nam (GMT+7)

1. **Khung giờ đóng cửa (23:00 - 06:30 sáng):**
   - Không có khách nào vào web.
   - Script tự động phát hiện giờ đêm và dừng ngay lập tức để tiết kiệm tài nguyên và tạo biểu đồ tự nhiên.

2. **Tần suất chạy:**
   - Cứ **khoảng 2 tiếng** có 1 đợt khách mới vào quán (15 */2 * * * - chạy 8 đợt trong ngày).

3. **Mục tiêu lưu lượng ~80 khách/ngày:**
   - **Giờ cao điểm (6 đợt):**
     - Buổi sáng: **07:15 & 09:15**
     - Buổi trưa: **11:15 & 13:15**
     - Buổi tối:  **17:15 & 19:15**
     - $\rightarrow$ **10 đến 13 khách** / đợt (trung bình ~11.5 khách x 6 đợt = ~69 khách).
   - **Giờ thấp điểm chiều (1 đợt):**
     - Khung giờ: **15:15**
     - $\rightarrow$ **4 đến 5 khách** (trung bình ~4.5 khách).
   - **Giờ bình thường đêm muộn (1 đợt):**
     - Khung giờ: **21:15** (chuẩn bị đóng cửa)
     - $\rightarrow$ **5 đến 7 khách** (trung bình ~6 khách).
   - $\rightarrow$ **Tổng lưu lượng cả ngày:** **~80 khách / ngày**!

4. **100% Thanh toán Tiền mặt (Cash Checkout):**
   - Khách đặt món chọn trực tiếp nút **Đặt món, trả tiền mặt** (không qua PayOS để tránh lỗi chưa cấu hình cổng thanh toán).
   - Đơn hàng được tạo thành công 100% trong cơ sở dữ liệu và gửi sự kiện purchase doanh thu về GA4.

5. **Tỷ lệ khách:**
   - **30%** Khách cũ quay lại (Returning Users - duy trì Cookie định danh).
   - **70%** Khách mới (New Users - mở trình duyệt sạch).
   - Tỷ lệ thoát (Bounce rate): ~40%.
   - Thời gian tương tác (Engagement Time): trung bình ~1 phút/khách.
