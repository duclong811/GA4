# Real Mobile Traffic Simulator (Giờ Việt Nam & Giờ Cao Điểm)

Công cụ mô phỏng người dùng thật cầm điện thoại truy cập trang web `https://www.ai-smartserve.io.vn`, tối ưu theo thói quen sinh hoạt và giờ mở cửa quán cafe tại Việt Nam.

## 🕒 Quy tắc vận hành theo Giờ Việt Nam (GMT+7)

1. **Khung giờ đóng cửa (23:00 – 06:30 sáng):**
   - Không có khách nào vào web.
   - Script tự động phát hiện giờ đêm và dừng ngay lập tức để tiết kiệm tài nguyên.

2. **Tần suất chạy:**
   - Cứ **khoảng 2 tiếng** có 1 đợt khách mới vào quán (`0 */2 * * *`).

3. **Phân loại giờ cao điểm & số lượng khách:**
   - **Giờ cao điểm:**
     - Buổi sáng: **06:30 – 09:30**
     - Buổi trưa: **11:00 – 13:30**
     - Buổi tối: **17:00 – 20:00**
     - $\rightarrow$ Số lượng khách đông hơn: từ **4 đến 8 khách** / đợt.
   - **Giờ bình thường:**
     - Các khung giờ còn lại trong ngày (09:30 - 11:00, 13:30 - 17:00, 20:00 - 23:00).
     - $\rightarrow$ Số lượng khách: từ **4 đến 6 khách** / đợt.

4. **Tỷ lệ khách:**
   - **30%** Khách cũ quay lại (Returning Users - duy trì Cookie định danh).
   - **70%** Khách mới (New Users - mở trình duyệt sạch).

5. **Giãn cách tự nhiên giữa các khách:**
   - Mỗi khách vào cách nhau **khoảng 5 phút** (dao động 4.5 – 5.5 phút), tạo biểu đồ lưu lượng rải đều cực kỳ tự nhiên.
