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

  // 1. Khung giờ đóng cửa: 23:00 đêm đến 06:30 sáng
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

// Mô phỏng 1 khách hàng duyệt web
async function simulateSingleUser(browser, userNumber, groupNumber) {
  // Tỷ lệ: 30% Khách cũ, 70% Khách mới
  const isReturning = Math.random() < 0.30;
  const deviceName = MOBILE_DEVICES[Math.floor(Math.random() * MOBILE_DEVICES.length)];
  const deviceConfig = devices[deviceName] || devices['iPhone 14'];

  console.log(`📱 [Nhóm #${groupNumber} - Khách #${userNumber}] Thiết bị: ${deviceName} | Loại: ${isReturning ? 'Khách cũ 🔄' : 'Khách mới 🆕'}`);

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
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // Cuộn lướt xem Menu (3 nhịp chậm rãi)
    for (let scroll = 0; scroll < 3; scroll++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1000 + Math.random() * 1500);
    }

    // Click ngẫu nhiên 1 món trên menu nếu tìm thấy
    const itemCards = await page.$$('button, [role="button"], a[href*="menu"], div[class*="cursor-pointer"]');
    if (itemCards.length > 0) {
      const randomCard = itemCards[Math.floor(Math.random() * Math.min(itemCards.length, 5))];
      try {
        await randomCard.click({ timeout: 2500 });
        await page.waitForTimeout(2500);
      } catch (err) {}
    }

    // Nán lại xem trang 8 - 15 giây để GA4 tính thời gian tương tác (Engagement Time)
    const dwellTime = Math.floor(8000 + Math.random() * 7000);
    await page.waitForTimeout(dwellTime);

    console.log(`✅ [Khách #${userNumber}] Đã xem menu xong!`);
  } catch (error) {
    console.warn(`⚠️ [Khách #${userNumber}] Lỗi: ${error.message}`);
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
    console.log(`🚫 Quán đóng cửa - Không có khách nào truy cập vào thời gian này.`);
    return;
  }

  // 2. Xác định tổng số lượng khách vào theo khung giờ
  let totalUsers = 0;
  if (vnTime.isPeakHour) {
    totalUsers = Math.floor(Math.random() * 5) + 4; // 4 đến 8 khách
    console.log(`🔥 [GIỜ CAO ĐIỂM] Dự kiến có tổng cộng: ${totalUsers} khách ghé quán.`);
  } else {
    totalUsers = Math.floor(Math.random() * 3) + 4; // 4 đến 6 khách
    console.log(`☕ [GIỜ BÌNH THƯỜNG] Dự kiến có tổng cộng: ${totalUsers} khách ghé quán.`);
  }

  // 3. Phân bổ các khách thành từng "Nhóm bạn" (Mỗi nhóm từ 1 đến 3 người)
  const groups = [];
  let remainingUsers = totalUsers;
  while (remainingUsers > 0) {
    const groupSize = Math.min(remainingUsers, Math.floor(Math.random() * 3) + 1); // 1, 2 hoặc 3 người
    groups.push(groupSize);
    remainingUsers -= groupSize;
  }

  console.log(`👥 Khách vào theo ${groups.length} nhóm bàn: [${groups.map((size, idx) => `Bàn #${idx + 1}: ${size} người`).join(' | ')}]`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let currentUserIndex = 1;

  for (let g = 0; g < groups.length; g++) {
    const groupSize = groups[g];
    console.log(`\n🛎️ --- NHÓM BÀN #${g + 1} VÀO QUÁN (${groupSize} người cùng lúc) ---`);

    // Các bạn trong cùng nhóm vào xem menu cùng lúc (lệch nhau 1-3 giây)
    const userPromises = [];
    for (let u = 0; u < groupSize; u++) {
      const userNum = currentUserIndex++;
      const delayMs = u * (1500 + Math.random() * 1500); // lệch nhau 1.5 - 3 giây
      userPromises.push(
        (async () => {
          if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
          await simulateSingleUser(browser, userNum, g + 1);
        })()
      );
    }

    // Chờ tất cả thành viên trong nhóm xem xong
    await Promise.all(userPromises);
    console.log(`🎉 Nhóm bàn #${g + 1} đã duyệt xong menu!`);

    // Giãn cách ngẫu nhiên từ 5 phút đến 10 phút trước khi nhóm tiếp theo ghé quán
    if (g < groups.length - 1) {
      // 5 đến 10 phút = 300 đến 600 giây
      const waitSeconds = Math.floor(300 + Math.random() * 300);
      const waitMinutes = (waitSeconds / 60).toFixed(1);
      console.log(`\n⏸️ Nghỉ giãn cách ${waitMinutes} phút (~${waitSeconds}s) trước khi nhóm bàn tiếp theo ghé quán...`);
      await new Promise(r => setTimeout(r, waitSeconds * 1000));
    }
  }

  await browser.close();
  console.log(`\n🏆 Hoàn thành xuất sắc toàn bộ các nhóm khách trong khung giờ ${vnTime.timeString}!`);
}

main().catch(err => {
  console.error("❌ Lỗi chương trình:", err);
  process.exit(1);
});
