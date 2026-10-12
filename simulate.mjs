import { chromium, devices } from 'playwright';

const TARGET_URL = (process.env.TARGET_URL || 'https://www.ai-smartserve.io.vn').replace(/\/$/, '');

// Danh sách thiết bị di động thực tế
const MOBILE_DEVICES = [
  'iPhone 14',
  'iPhone 13 Pro',
  'Pixel 7',
  'Galaxy S9+'
];

// Danh sách Client ID cố định cho khách quen (Returning Users)
const RETURNING_CLIENT_IDS = [
  '100100101.1710000001',
  '100100102.1710000002',
  '100100103.1710000003',
  '100100104.1710000004',
  '100100105.1710000005',
  '100100106.1710000006',
  '100100107.1710000007',
  '100100108.1710000008'
];

// Hàm kiểm tra và phân loại khung giờ Việt Nam (UTC+7)
function getVietnamTimeInfo() {
  const vnTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);
  const hour = vnDate.getHours();
  const minute = vnDate.getMinutes();
  const timeInHours = hour + (minute / 60);

  // 1. Khung giờ đóng cửa ban đêm: 23:00 - 06:30 sáng
  const isNightClosed = (timeInHours >= 23.0 || timeInHours < 6.5);

  // 2. Khung giờ cao điểm (Peak Hours):
  // - Sáng: 6:30 - 9:30
  // - Trưa: 11:00 - 13:30
  // - Tối:  17:00 - 20:00
  const isPeakHour =
    (timeInHours >= 6.5 && timeInHours <= 9.5) ||
    (timeInHours >= 11.0 && timeInHours <= 13.5) ||
    (timeInHours >= 17.0 && timeInHours <= 20.0);

  // 3. Khung giờ thấp điểm / Quán vắng (Slow Hours):
  // - Đầu giờ chiều: 14:00 - 16:30
  // - Đêm muộn:      21:30 - 22:30
  const isSlowHour =
    (timeInHours >= 14.0 && timeInHours < 16.5) ||
    (timeInHours >= 21.5 && timeInHours < 22.5);

  return {
    hour,
    minute,
    timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    isNightClosed,
    isPeakHour,
    isSlowHour
  };
}

// Mô phỏng luồng khách hàng mua sắm hoàn chỉnh (Funnel: Menu -> Cart -> Order Success)
async function simulateSingleUser(browser, userNumber, groupNumber) {
  // Tỷ lệ: 30% Khách cũ, 70% Khách mới
  const isReturning = Math.random() < 0.30;
  const deviceName = MOBILE_DEVICES[Math.floor(Math.random() * MOBILE_DEVICES.length)];
  const deviceConfig = devices[deviceName] || devices['iPhone 14'];

  console.log(`📱 [Nhóm #${groupNumber} - Khách #${userNumber}] Thiết bị: ${deviceName} | Loại: ${isReturning ? 'Khách cũ (30%) 🔄' : 'Khách mới (70%) 🆕'}`);

  const contextOptions = {
    ...deviceConfig,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  };

  if (process.env.VN_PROXY) {
    contextOptions.proxy = { server: process.env.VN_PROXY };
  }

  const context = await browser.newContext(contextOptions);

  // Nếu là khách quen: Gắn cookie _ga cố định
  if (isReturning) {
    const clientId = RETURNING_CLIENT_IDS[Math.floor(Math.random() * RETURNING_CLIENT_IDS.length)];
    const urlObj = new URL(TARGET_URL);
    await context.addCookies([
      {
        name: '_ga',
        value: `GA1.1.${clientId}`,
        domain: urlObj.hostname,
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      }
    ]);
  }

  const page = await context.newPage();

  try {
    // ==========================================
    // BƯỚC 1: Vào trang Menu xem món
    // ==========================================
    console.log(`🌐 [Khách #${userNumber}] Mở thực đơn: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // Cuộn lướt Menu từ từ 3 nhịp
    for (let scroll = 0; scroll < 3; scroll++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1000 + Math.random() * 1500);
    }

    // Bấm xem chi tiết 1 món
    const itemCards = await page.$$('button, [role="button"], a[href*="menu"], div[class*="cursor-pointer"]');
    if (itemCards.length > 0) {
      const randomCard = itemCards[Math.floor(Math.random() * Math.min(itemCards.length, 5))];
      try {
        await randomCard.click({ timeout: 2500 });
        console.log(`👉 [Khách #${userNumber}] Đã click xem chi tiết 1 món trên menu!`);
        await page.waitForTimeout(2500);
      } catch (err) {}
    }

    // Nán lại xem trang (Dwell time)
    await page.waitForTimeout(4000 + Math.random() * 3000);

    // ==========================================
    // BƯỚC 2: Vào giỏ hàng (/cart)
    // 70% khách sẽ mở giỏ hàng (Giúp giảm tỷ lệ thoát, ghi nhận trang /cart)
    // ==========================================
    const viewsCart = Math.random() < 0.70;
    if (viewsCart) {
      console.log(`🛒 [Khách #${userNumber}] Chuyển sang xem Giỏ hàng (/cart)...`);
      await page.goto(`${TARGET_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3500 + Math.random() * 2500); // Lướt xem giỏ hàng 3-6s

      // ==========================================
      // BƯỚC 3: Hoàn tất đặt hàng (/order-success)
      // 40% trong số người vào giỏ sẽ tiến hành đặt hàng thành công
      // ==========================================
      const doesPurchase = Math.random() < 0.40;
      if (doesPurchase) {
        // Sinh mã đơn hàng chuẩn: OD-yymmdd-xxxx
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `OD-${yy}${mm}${dd}-${randomNum}`;
        const orderId = Math.floor(Math.random() * 80) + 1;

        const successUrl = `${TARGET_URL}/order-success?code=${orderCode}&orderId=${orderId}`;
        console.log(`💳 [Khách #${userNumber}] Đặt món thành công! Chuyển tới: /order-success (Mã đơn: ${orderCode})...`);

        await page.goto(successUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        // Nán lại xem trang thanh toán/QR 6 - 10 giây
        await page.waitForTimeout(6000 + Math.random() * 4000);
        console.log(`✅ [Khách #${userNumber}] Hoàn tất đặt đơn hàng ${orderCode}!`);
      }
    }

    console.log(`🏁 [Khách #${userNumber}] Hoàn tất toàn bộ phiên trải nghiệm!`);
  } catch (error) {
    console.warn(`⚠️ [Khách #${userNumber}] Lỗi duyệt web: ${error.message}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const vnTime = getVietnamTimeInfo();

  console.log(`====================================================`);
  console.log(`🕒 Giờ hiện tại tại Việt Nam: ${vnTime.timeString} (GMT+7)`);
  console.log(`🎯 Mục tiêu: ${TARGET_URL}`);
  console.log(`====================================================`);

  // 1. Kiểm tra khung giờ đóng cửa (23:00 - 06:30)
  if (vnTime.isNightClosed) {
    console.log(`🌙 Khung giờ nghỉ ngơi (23:00 - 06:30 sáng giờ VN). Quán đóng cửa!`);
    return;
  }

  let totalUsers = 0;

  // 2. Xác định số lượng khách theo loại khung giờ
  if (vnTime.isSlowHour) {
    console.log(`🍃 [KHUNG GIỜ THẤP ĐIỂM / QUÁN VẮNG] Đang trong khung giờ làm việc/sắp đóng cửa.`);

    // 40% TỶ LỆ QUÁN VẮNG HOÀN TOÀN (0 KHÁCH)
    const isCompletelyEmpty = Math.random() < 0.40;
    if (isCompletelyEmpty) {
      console.log(`📉 [XÁC SUẤT 40%] Đợt này quán vắng khách hoàn toàn: 0 người ghé thăm.`);
      console.log(`💤 Dừng tiến trình mô phỏng để tạo khoảng lặng tự nhiên trên biểu đồ.`);
      return;
    }

    // 60% còn lại: chỉ có lác đác 1 đến 2 khách lẻ
    totalUsers = Math.floor(Math.random() * 2) + 1; // 1 hoặc 2 khách
    console.log(`🚶‍♂️ [XÁC SUẤT 60%] Quán chỉ có lác đác ${totalUsers} khách lẻ ghé mua.`);
  } else if (vnTime.isPeakHour) {
    // KHUNG GIỜ CAO ĐIỂM (6:30 - 9:30, 11:00 - 13:30, 17:00 - 20:00)
    totalUsers = Math.floor(Math.random() * 5) + 4; // 4 đến 8 khách
    console.log(`🔥 [GIỜ CAO ĐIỂM] Khách đông đúc! Dự kiến đợt này có: ${totalUsers} khách.`);
  } else {
    // KHUNG GIỜ BÌNH THƯỜNG
    totalUsers = Math.floor(Math.random() * 3) + 3; // 3 đến 5 khách
    console.log(`☕ [GIỜ BÌNH THƯỜNG] Lượng khách vừa phải. Dự kiến có: ${totalUsers} khách.`);
  }

  // 3. Phân bổ các khách thành từng "Nhóm bạn" (Mỗi nhóm từ 1 đến 3 người)
  const groups = [];
  let remainingUsers = totalUsers;
  while (remainingUsers > 0) {
    const maxGroup = vnTime.isSlowHour ? 1 : 3;
    const groupSize = Math.min(remainingUsers, Math.floor(Math.random() * maxGroup) + 1);
    groups.push(groupSize);
    remainingUsers -= groupSize;
  }

  console.log(`👥 Phân bổ thành ${groups.length} nhóm bàn: [${groups.map((size, idx) => `Bàn #${idx + 1}: ${size} người`).join(' | ')}]`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let currentUserIndex = 1;

  for (let g = 0; g < groups.length; g++) {
    const groupSize = groups[g];
    console.log(`\n🛎️ --- NHÓM BÀN #${g + 1} VÀO QUÁN (${groupSize} người cùng lúc) ---`);

    const userPromises = [];
    for (let u = 0; u < groupSize; u++) {
      const userNum = currentUserIndex++;
      const delayMs = u * (1500 + Math.random() * 1500);
      userPromises.push(
        (async () => {
          if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
          await simulateSingleUser(browser, userNum, g + 1);
        })()
      );
    }

    await Promise.all(userPromises);
    console.log(`🎉 Nhóm bàn #${g + 1} đã duyệt xong!`);

    // Giãn cách ngẫu nhiên từ 5 đến 10 phút giữa các nhóm
    if (g < groups.length - 1) {
      const waitSeconds = Math.floor(300 + Math.random() * 300); // 5 - 10 phút
      const waitMinutes = (waitSeconds / 60).toFixed(1);
      console.log(`\n⏸️ Nghỉ giãn cách ${waitMinutes} phút (~${waitSeconds}s) trước khi nhóm tiếp theo ghé quán...`);
      await new Promise(r => setTimeout(r, waitSeconds * 1000));
    }
  }

  await browser.close();
  console.log(`\n🏆 Hoàn thành xuất sắc đợt khách trong khung giờ ${vnTime.timeString}!`);
}

main().catch(err => {
  console.error("❌ Lỗi chương trình:", err);
  process.exit(1);
});
