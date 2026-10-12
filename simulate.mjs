import { chromium, devices } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'https://www.ai-smartserve.io.vn';

// Danh sách thiết bị di động thực tế để mô phỏng đa dạng
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
  '100100106.1710000006'
];

async function simulateSingleUser(browser, userIndex) {
  // 70% Khách quen (Returning User), 30% Khách mới (New User)
  const isReturning = Math.random() < 0.70;
  const deviceName = MOBILE_DEVICES[Math.floor(Math.random() * MOBILE_DEVICES.length)];
  const deviceConfig = devices[deviceName] || devices['iPhone 14'];

  console.log(`\n📱 [Khách #${userIndex + 1}] Thiết bị: ${deviceName} | Loại: ${isReturning ? 'Khách cũ quay lại 🔄' : 'Khách mới 🆕'}`);

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
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Đợi 4 giây cho Google Analytics (gtag.js) tải và bắn sự kiện xem trang đầu tiên
    await page.waitForTimeout(4000);
    console.log(`👀 Đã tải trang thành công, tiêu đề: "${await page.title()}"`);

    // Cuộn trang xuống từ từ mô phỏng hành vi người thật lướt xem menu
    for (let scroll = 0; scroll < 3; scroll++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1500 + Math.random() * 1000);
    }

    // Thử tìm các món ăn hoặc nút bấm trên menu để tương tác
    const itemCards = await page.$$('button, [role="button"], a[href*="menu"], div[class*="cursor-pointer"]');
    if (itemCards.length > 0) {
      // Chọn ngẫu nhiên 1 phần tử có thể bấm được
      const randomCard = itemCards[Math.floor(Math.random() * Math.min(itemCards.length, 5))];
      try {
        await randomCard.click({ timeout: 2000 });
        console.log(`👉 Đã bấm xem 1 món trên menu!`);
        await page.waitForTimeout(3000);
      } catch (clickErr) {
        // Bỏ qua nếu không click được
      }
    }

    // Ở lại trang thêm 5-10 giây để GA4 tính là thời gian tương tác tích cực (engagement time)
    const dwellTime = Math.floor(5000 + Math.random() * 5000);
    console.log(`⏳ Đang duyệt web (thời gian lưu lại: ${(dwellTime / 1000).toFixed(1)}s)...`);
    await page.waitForTimeout(dwellTime);

    console.log(`✅ Khách #${userIndex + 1} hoàn tất phiên truy cập!`);
  } catch (error) {
    console.warn(`⚠️ Lỗi trong phiên duyệt web: ${error.message}`);
  } finally {
    await context.close();
  }
}

async function main() {
  console.log(`====================================================`);
  console.log(`🚀 Bắt đầu mô phỏng khách hàng dùng điện thoại truy cập web`);
  console.log(`Mục tiêu: ${TARGET_URL}`);
  console.log(`====================================================`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const totalUsers = Math.floor(Math.random() * 3) + 3; // 3 đến 5 khách
  console.log(`Sẽ có ${totalUsers} khách hàng lần lượt truy cập...`);

  for (let i = 0; i < totalUsers; i++) {
    await simulateSingleUser(browser, i);
    // Giãn cách 2 đến 4 giây giữa các khách
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
  }

  await browser.close();
  console.log(`\n🎉 Hoàn thành phiên mô phỏng traffic người thật!`);
}

main().catch(err => {
  console.error("❌ Lỗi chương trình:", err);
  process.exit(1);
});
