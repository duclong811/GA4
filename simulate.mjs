import { chromium, devices } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'https://www.ai-smartserve.io.vn';

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

// Hàm kiểm tra khung giờ Việt Nam (UTC+7)
function getVietnamTimeInfo() {
  const vnTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);
  const hour = vnDate.getHours();
  const minute = vnDate.getMinutes();
  const timeInHours = hour + (minute / 60);

  // 1. Khung giờ đóng cửa: từ 23:00 đêm đến 06:30 sáng
  const isNightClosed = (timeInHours >= 23.0 || timeInHours < 6.5);

  // 2. Các khung giờ cao điểm trong ngày:
  // - Sáng: 6:30 - 9:30
  // - Trưa: 11:00 - 13:30
  // - Tối:  17:00 - 20:00
  const isPeakHour =
    (timeInHours >= 6.5 && timeInHours <= 9.5) ||
    (timeInHours >= 11.0 && timeInHours <= 13.5) ||
    (timeInHours >= 17.0 && timeInHours <= 20.0);

  return {
    hour,
    minute,
    timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    isNightClosed,
    isPeakHour
  };
}

async function simulateSingleUser(browser, userIndex, totalUsers) {
  // Tỷ lệ theo yêu cầu: 30% Khách cũ, 70% Khách mới
  const isReturning = Math.random() < 0.30;
  const deviceName = MOBILE_DEVICES[Math.floor(Math.random() * MOBILE_DEVICES.length)];
  const deviceConfig = devices[deviceName] || devices['iPhone 14'];

  console.log(`\n📱 [Khách #${userIndex + 1}/${totalUsers}] Thiết bị: ${deviceName} | Loại: ${isReturning ? 'Khách cũ (30%) 🔄' : 'Khách mới (70%) 🆕'}`);

  const context = await browser.newContext({
    ...deviceConfig,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });

  // Nếu là khách quen: Gắn cookie _ga cố định để GA4 nhận diện là Returning User
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
    console.log(`🌐 Đang mở trang web: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Đợi 4 giây cho gtag.js gửi sự kiện xem trang
    await page.waitForTimeout(4000);
    console.log(`👀 Đã tải trang thành công: "${await page.title()}"`);

    // Cuộn lướt xem Menu (3 nhịp chậm rãi như người thật)
    for (let scroll = 0; scroll < 3; scroll++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1500 + Math.random() * 1000);
    }

    // Bấm xem chi tiết 1 món trên menu nếu tìm thấy nút hoặc thẻ món
    const itemCards = await page.$$('button, [role="button"], a[href*="menu"], div[class*="cursor-pointer"]');
    if (itemCards.length > 0) {
      const randomCard = itemCards[Math.floor(Math.random() * Math.min(itemCards.length, 5))];
      try {
        await randomCard.click({ timeout: 2500 });
        console.log(`👉 Đã click xem 1 món trên menu!`);
        await page.waitForTimeout(3000);
      } catch (err) {
        // Bỏ qua nếu không click được
      }
    }

    // Nán lại xem trang 8 - 15 giây để GA4 tính thời gian tương tác (Engagement Time)
    const dwellTime = Math.floor(8000 + Math.random() * 7000);
    console.log(`⏳ Khách đang dừng chân xem menu (${(dwellTime / 1000).toFixed(1)}s)...`);
    await page.waitForTimeout(dwellTime);

    console.log(`✅ Khách #${userIndex + 1} hoàn tất phiên mua sắm/xem menu!`);
  } catch (error) {
    console.warn(`⚠️ Lỗi khi duyệt web: ${error.message}`);
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
    console.log(`🌙 Hiện tại đang trong khung giờ nghỉ ngơi (23:00 - 06:30 sáng giờ VN).`);
    console.log(`🚫 Quán tạm đóng cửa - Không có khách nào truy cập vào thời gian này.`);
    console.log(`💤 Dừng tiến trình để tiết kiệm tài nguyên.`);
    return;
  }

  // 2. Xác định số lượng khách vào theo khung giờ
  let totalUsers = 0;
  if (vnTime.isPeakHour) {
    // Giờ cao điểm (6:30-9:30, 11:00-13:30, 17:00-20:00): 4 đến 8 khách
    totalUsers = Math.floor(Math.random() * 5) + 4; // 4, 5, 6, 7, 8
    console.log(`🔥 [GIỜ CAO ĐIỂM] Khung giờ khách đông, đợt này sẽ có: ${totalUsers} khách vào quán.`);
  } else {
    // Giờ thường (các khung giờ còn lại): 4 đến 6 khách
    totalUsers = Math.floor(Math.random() * 3) + 4; // 4, 5, 6
    console.log(`☕ [GIỜ BÌNH THƯỜNG] Đợt này sẽ có: ${totalUsers} khách vào quán.`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  for (let i = 0; i < totalUsers; i++) {
    await simulateSingleUser(browser, i, totalUsers);

    // Khoảng cách giữa các khách: khoảng ~5 phút (từ 4.5 đến 5.5 phút)
    if (i < totalUsers - 1) {
      // 4.5 - 5.5 phút = 270 - 330 giây
      const waitSeconds = Math.floor(270 + Math.random() * 60);
      const waitMinutes = (waitSeconds / 60).toFixed(1);
      console.log(`\n⏸️ Nghỉ giãn cách ${waitMinutes} phút (~${waitSeconds}s) trước khi khách tiếp theo ghé quán...`);
      await new Promise(r => setTimeout(r, waitSeconds * 1000));
    }
  }

  await browser.close();
  console.log(`\n🎉 Hoàn thành xuất sắc đợt khách trong khung giờ ${vnTime.timeString}!`);
}

main().catch(err => {
  console.error("❌ Lỗi chương trình:", err);
  process.exit(1);
});
