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

// Cấu hình phiên bàn phục vụ (Sử dụng Store Demo để tạo đơn thật an toàn, không ảnh hưởng quán thật)
const DEMO_TABLE_SESSION = {
  storeId: 2,
  tableId: 11,
  tableNumber: 'D01',
  storeName: 'AI-SMARTSERVE Demo',
  tableToken: '9d1527d80b1a45259cfd28300d7303a8',
};

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
    (timeInHours >= 14.0 && timeInHours <= 16.5) ||
    (timeInHours >= 21.5 && timeInHours <= 22.5);

  return {
    hour,
    minute,
    timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    isNightClosed,
    isPeakHour,
    isSlowHour
  };
}

// Mô phỏng từng khách hàng:
// - 40% Khách thoát nhanh (Bounce Rate ~40%): vào xem 5-7s rồi rời đi
// - 60% Khách tương tác sâu: nán lại 35-45s trên Menu, 20-30s Giỏ hàng, bấm nút Đặt hàng thật
// => Đảm bảo thời gian tương tác trung bình toàn trang đạt ~60s (1 phút) và GA4 đo được doanh thu thật!
async function simulateSingleUser(browser, userNumber, groupNumber) {
  const isReturning = Math.random() < 0.30; // 30% khách cũ, 70% khách mới
  const deviceName = MOBILE_DEVICES[Math.floor(Math.random() * MOBILE_DEVICES.length)];
  const deviceConfig = devices[deviceName] || devices['iPhone 14'];

  // Quyết định hành vi: 40% Thoát nhanh (Bounce) vs 60% Tương tác sâu (Engaged)
  const isBouncer = Math.random() < 0.40;

  console.log(`📱 [Nhóm #${groupNumber} - Khách #${userNumber}] Thiết bị: ${deviceName} | Loại: ${isReturning ? 'Khách cũ 🔄' : 'Khách mới 🆕'} | Hành vi: ${isBouncer ? 'Thoát nhanh (Bounce ~40%) ⚡' : 'Tương tác sâu (~1p) ⭐'}`);

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

  // Khởi tạo phiên bàn hợp lệ trước khi load trang để hệ thống nhận diện bàn phục vụ
  await context.addInitScript((session) => {
    localStorage.setItem('guestSession', JSON.stringify({
      guestId: 'guest_' + Math.random().toString(36).substring(2, 10),
      storeId: session.storeId,
      tableId: session.tableId,
      tableNumber: session.tableNumber,
      storeName: session.storeName,
      tableToken: session.tableToken,
      timestamp: new Date().toISOString()
    }));
  }, DEMO_TABLE_SESSION);

  const page = await context.newPage();

  try {
    // =========================================================================
    // TRƯỜNG HỢP 1: 40% KHÁCH THOÁT NHANH (Tạo tỷ lệ thoát tự nhiên ~40%)
    // Khách chỉ vào xem lướt 5 - 8 giây, không bấm giỏ hàng, đóng tab
    // =========================================================================
    if (isBouncer) {
      console.log(`🌐 [Khách #${userNumber} - Bouncer] Mở xem thực đơn: ${TARGET_URL}...`);
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
      
      // Cuộn nhẹ 1 nhịp lướt qua
      await page.waitForTimeout(2000 + Math.random() * 1000);
      await page.mouse.wheel(0, 200);
      
      // Nán lại dưới 10 giây (GA4 chuẩn tính là 1 lượt thoát nếu dưới 10s và 1 trang)
      const bounceDwellMs = 5000 + Math.random() * 2500; // 5 - 7.5s
      await page.waitForTimeout(bounceDwellMs);
      console.log(`🚪 [Khách #${userNumber} - Bouncer] Rời trang sau ${(bounceDwellMs / 1000).toFixed(1)}s (Tạo chỉ số Bounce Rate chuẩn)!`);
      return;
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: 60% KHÁCH TƯƠNG TÁC SÂU (Average Engagement Time ~ 1 phút)
    // =========================================================================
    console.log(`🌐 [Khách #${userNumber} - Engaged] Mở thực đơn: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // 1. Khách lướt xem menu từ từ 4 nhịp (khoảng 15 - 20s)
    for (let scroll = 0; scroll < 4; scroll++) {
      await page.mouse.wheel(0, 350);
      await page.waitForTimeout(2500 + Math.random() * 2000);
    }

    // 2. Bấm xem chi tiết 1 món hoặc danh mục
    const itemCards = await page.$$('button, [role="button"], a[href*="product"], div[class*="cursor-pointer"]');
    if (itemCards.length > 0) {
      const randomCard = itemCards[Math.floor(Math.random() * Math.min(itemCards.length, 6))];
      try {
        await randomCard.click({ timeout: 2500 });
        console.log(`👉 [Khách #${userNumber}] Đã click xem chi tiết món trên menu!`);
        await page.waitForTimeout(3000 + Math.random() * 2000);
      } catch (err) {}
    }

    // Nán lại thêm trên trang Menu (Tổng thời gian trên Menu: 35 - 45s)
    await page.waitForTimeout(5000 + Math.random() * 3000);

    // 3. Khách thêm món vào giỏ hàng và mở giỏ hàng (70% khách tương tác sâu)
    const viewsCart = Math.random() < 0.70;
    if (viewsCart) {
      // Tìm nút "Thêm nhanh vào giỏ"
      try {
        const addButtons = await page.$$('button[title*="Thêm"]');
        if (addButtons.length > 0) {
          // Bấm thêm 1 món (hoặc 50% khả năng thêm món thứ 2)
          await addButtons[0].click({ timeout: 3000 });
          console.log(`🛒 [Khách #${userNumber}] Đã bấm nút 'Thêm nhanh vào giỏ' món 1 (Ghi nhận add_to_cart)! `);
          await page.waitForTimeout(1500 + Math.random() * 1000);

          if (addButtons.length > 1 && Math.random() < 0.50) {
            await addButtons[1].click({ timeout: 3000 });
            console.log(`🛒 [Khách #${userNumber}] Đã bấm thêm món thứ 2 vào giỏ!`);
            await page.waitForTimeout(1500);
          }
        }
      } catch (e) {
        console.log(`⚠️ Không bấm được nút thêm nhanh, tiếp tục điều hướng giỏ hàng...`);
      }

      // Điều hướng vào Giỏ hàng bằng click link Header (Client-side routing giữ giỏ hàng trong bộ nhớ)
      console.log(`🛒 [Khách #${userNumber}] Mở Giỏ hàng (/cart)... `);
      try {
        const cartLink = await page.waitForSelector('a[href="/cart"], a[aria-label*="Giỏ"], a[aria-label*="Cart"]', { timeout: 4000 });
        await cartLink.click();
      } catch {
        await page.goto(`${TARGET_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      }

      // Nán lại xem giỏ hàng từ 15 đến 25 giây
      const cartDwellMs = 15000 + Math.random() * 10000;
      await page.waitForTimeout(cartDwellMs);
      console.log(`👀 [Khách #${userNumber}] Đã xem xét giỏ hàng trong ${(cartDwellMs / 1000).toFixed(1)}s`);

      // 4. Khách bấm nút Đặt Hàng thật (40% trong số người vào giỏ hàng)
      const doesPurchase = Math.random() < 0.40;
      if (doesPurchase) {
        try {
          const checkoutBtn = await page.waitForSelector('button:has-text("Xác Nhận Đặt Món"), button:has-text("Đặt món"), button:has-text("Thanh toán")', { timeout: 5000 });
          const btnText = (await checkoutBtn.innerText()).replace(/\n/g, ' ');
          console.log(`💳 [Khách #${userNumber}] BẤM NÚT ĐẶT HÀNG: "${btnText}"...`);
          
          await checkoutBtn.click();

          // Chờ API tạo đơn thành công và tự động chuyển sang trang /order-success
          await page.waitForURL('**/order-success**', { timeout: 20000 });
          console.log(`🎉 [Khách #${userNumber}] Hệ thống đã tạo đơn & chuyển tới: ${page.url()}`);
          console.log(`📊 [Khách #${userNumber}] GA4 đã bắt trọn sự kiện 'purchase' với ĐẦY ĐỦ DOANH THU & SẢN PHẨM!`);

          // Nán lại xem trang xác nhận & mã VietQR PayOS 25 - 35 giây
          const successDwellMs = 25000 + Math.random() * 10000;
          await page.waitForTimeout(successDwellMs);
          console.log(`✅ [Khách #${userNumber}] Hoàn tất phiên xem đơn hàng & QR sau ${(successDwellMs / 1000).toFixed(1)}s!`);
        } catch (checkoutErr) {
          console.log(`⚠️ [Khách #${userNumber}] Không thể bấm nút đặt hàng: ${checkoutErr.message}`);
        }
      }
    }

    console.log(`✨ [Khách #${userNumber}] Hoàn tất phiên trải nghiệm trọn vẹn!`);
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
  console.log(`📊 Cấu hình: Bounce Rate mục tiêu ~40% | Avg Engagement Time ~1 phút`);
  console.log(`====================================================`);

  // 1. Kiểm tra khung giờ đóng cửa (23:00 - 06:30)
  if (vnTime.isNightClosed) {
    console.log(`🌙 Khung giờ nghỉ ngơi (23:00 - 06:30 sáng giờ VN). Quán đóng cửa!`);
    return;
  }

  let totalUsers = 0;

  // 2. Xác định số lượng khách theo loại khung giờ
  if (vnTime.isSlowHour) {
    console.log(`☕ [KHUNG GIỜ THẤP ĐIỂM / QUÁN VẮNG] Đang trong khung giờ làm việc/sắp đóng cửa.`);

    // 40% TỶ LỆ QUÁN VẮNG HOÀN TOÀN (0 KHÁCH)
    const isCompletelyEmpty = Math.random() < 0.40;
    if (isCompletelyEmpty) {
      console.log(`🎲 [XÁC SUẤT 40%] Đợt này quán vắng khách hoàn toàn: 0 người ghé thăm.`);
      console.log(`💤 Dừng tiến trình mô phỏng để tạo khoảng lặng tự nhiên trên biểu đồ.`);
      return;
    }

    // 60% còn lại: chỉ có lác đác 1 đến 2 khách lẻ
    totalUsers = Math.floor(Math.random() * 2) + 1; // 1 hoặc 2 khách
    console.log(`👥 ☕ [XÁC SUẤT 60%] Quán chỉ có lác đác ${totalUsers} khách lẻ ghé mua.`);
  } else if (vnTime.isPeakHour) {
    // KHUNG GIỜ CAO ĐIỂM (6:30 - 9:30, 11:00 - 13:30, 17:00 - 20:00)
    totalUsers = Math.floor(Math.random() * 5) + 4; // 4 đến 8 khách
    console.log(`🔥 [GIỜ CAO ĐIỂM] Khách đông đúc! Dự kiến đợt này có: ${totalUsers} khách.`);
  } else {
    // KHUNG GIỜ BÌNH THƯỜNG
    totalUsers = Math.floor(Math.random() * 3) + 3; // 3 đến 5 khách
    console.log(`✨ [GIỜ BÌNH THƯỜNG] Lượng khách vừa phải. Dự kiến có: ${totalUsers} khách.`);
  }

  // 3. Phân bổ các khách thành từng "Nhóm bàn" (Mỗi nhóm từ 1 đến 3 người)
  const groups = [];
  let remainingUsers = totalUsers;
  while (remainingUsers > 0) {
    const maxGroup = vnTime.isSlowHour ? 1 : 3;
    const groupSize = Math.min(remainingUsers, Math.floor(Math.random() * maxGroup) + 1);
    groups.push(groupSize);
    remainingUsers -= groupSize;
  }

  console.log(`📋 Phân bổ thành ${groups.length} nhóm bàn: [${groups.map((size, idx) => `Bàn #${idx + 1}: ${size} người`).join(' | ')}]`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let currentUserIndex = 1;

  for (let g = 0; g < groups.length; g++) {
    const groupSize = groups[g];
    console.log(`\n👥 --- NHÓM BÀN #${g + 1} VÀO QUÁN (${groupSize} người cùng lúc) ---`);

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
    console.log(`🏁 Nhóm bàn #${g + 1} đã duyệt xong!`);

    // Giãn cách ngẫu nhiên từ 3 đến 6 phút giữa các nhóm (nếu còn nhóm sau)
    if (g < groups.length - 1) {
      const waitSeconds = Math.floor(180 + Math.random() * 180); // 3 - 6 phút
      const waitMinutes = (waitSeconds / 60).toFixed(1);
      console.log(`\n⏳ Nghỉ giãn cách ${waitMinutes} phút (~${waitSeconds}s) trước khi nhóm tiếp theo ghé quán...`);
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
