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

// Cấu hình phiên bàn phục vụ (Store Demo: an toàn, tạo đơn thật 100% trong DB, kích hoạt GA4 purchase thật)
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

// Hàm hỗ trợ nán lại chủ động (Active Dwell): vừa chờ vừa di chuột/cuộn nhẹ
// để Google Analytics 4 nhận diện người dùng ĐANG HOẠT ĐỘNG liên tục (không bị tính là Idle/2s)
async function activeDwell(page, durationMs) {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const stepWait = Math.min(3000 + Math.random() * 2000, durationMs - (Date.now() - start));
    if (stepWait <= 0) break;
    await page.waitForTimeout(stepWait);

    // Tạo tương tác tự nhiên: di chuyển chuột và nhấp cuộn nhẹ
    try {
      await page.mouse.move(120 + Math.random() * 150, 200 + Math.random() * 250);
      const scrollY = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.floor(Math.random() * 100));
      await page.mouse.wheel(0, scrollY);
    } catch {}
  }
}

// Hàm ép GA4 xả bộ đệm thời gian tương tác (Flush User Engagement Time) trước khi đóng trang
async function flushGaEngagement(page) {
  try {
    await page.evaluate(() => {
      // 1. Kích hoạt visibilitychange: hidden để gtag.js lập tức gửi beacon user_engagement (_et)
      try {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      } catch {}
      // 2. Kích hoạt pagehide
      try {
        window.dispatchEvent(new Event('pagehide'));
      } catch {}
    });
    // Chờ 1.5s để mạng gửi xong gói tin beacon về google-analytics.com
    await page.waitForTimeout(1500);
  } catch {}
}

// Mô phỏng từng khách hàng
async function simulateSingleUser(browser, userNumber, groupNumber, forcePurchase = false) {
  const isReturning = Math.random() < 0.30; // 30% khách cũ, 70% khách mới
  const deviceName = MOBILE_DEVICES[Math.floor(Math.random() * MOBILE_DEVICES.length)];
  const deviceConfig = devices[deviceName] || devices['iPhone 14'];

  // Nếu forcePurchase = true (khách được chọn để chắc chắn tạo doanh thu) thì không được bounce
  const isBouncer = forcePurchase ? false : (Math.random() < 0.40);

  console.log(`📱 [Nhóm #${groupNumber} - Khách #${userNumber}] Thiết bị: ${deviceName} | Loại: ${isReturning ? 'Khách cũ 🔄' : 'Khách mới 🆕'} | Hành vi: ${isBouncer ? 'Thoát nhanh (Bounce ~40%) ⚡' : (forcePurchase ? 'Đặt hàng chắc chắn (Chốt đơn) 🏆' : 'Tương tác sâu (~1p) ⭐')}`);

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

  // Khởi tạo phiên bàn demo hợp lệ trước khi load trang
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
    // TRƯỜNG HỢP 1: 40% KHÁCH THOÁT NHANH (Bounce Rate chuẩn ~40%)
    // =========================================================================
    if (isBouncer) {
      console.log(`🌐 [Khách #${userNumber} - Bouncer] Mở thực đơn: ${TARGET_URL}...`);
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
      
      // Cuộn nhẹ 1 nhịp lướt qua trong 5 - 7 giây
      await page.waitForTimeout(2000);
      await page.mouse.wheel(0, 200);
      const bounceDwellMs = 4000 + Math.random() * 2500; // Tổng ~6-8s (< 10s -> GA4 tính 1 lượt thoát)
      await page.waitForTimeout(bounceDwellMs);

      // Ép GA4 gửi thời gian tương tác thực
      await flushGaEngagement(page);
      console.log(`🚪 [Khách #${userNumber} - Bouncer] Rời trang sau ${((2000 + bounceDwellMs) / 1000).toFixed(1)}s (Tạo Bounce Rate chuẩn)!`);
      return;
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: KHÁCH TƯƠNG TÁC SÂU (~1 PHÚT & TẠO DOANH THU THẬT)
    // =========================================================================
    console.log(`🌐 [Khách #${userNumber} - Engaged] Mở thực đơn: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // 1. Khách lướt xem menu từ từ và tương tác liên tục (khoảng 25 - 35s)
    console.log(`👀 [Khách #${userNumber}] Đang xem xét thực đơn...`);
    await activeDwell(page, 20000 + Math.random() * 8000);

    // 2. Bấm xem chi tiết 1 món hoặc danh mục
    try {
      const itemCards = await page.$$('button, [role="button"], a[href*="product"], div[class*="cursor-pointer"]');
      if (itemCards.length > 0) {
        const randomCard = itemCards[Math.floor(Math.random() * Math.min(itemCards.length, 6))];
        await randomCard.click({ timeout: 2500 });
        console.log(`👉 [Khách #${userNumber}] Đã click xem chi tiết món trên menu!`);
        await activeDwell(page, 4000 + Math.random() * 2000);
      }
    } catch {}

    // 3. Khách thêm món vào giỏ hàng (Khách forcePurchase hoặc 75% khách sâu)
    const viewsCart = forcePurchase || (Math.random() < 0.75);
    if (viewsCart) {
      try {
        const addButtons = await page.$$('button[title*="Thêm"]');
        if (addButtons.length > 0) {
          await addButtons[0].click({ timeout: 3000 });
          console.log(`🛒 [Khách #${userNumber}] Đã bấm nút 'Thêm nhanh vào giỏ' món 1 (Ghi nhận add_to_cart)! `);
          await page.waitForTimeout(1500);

          // 60% thêm món thứ 2 để tăng giá trị đơn hàng
          if (addButtons.length > 1 && (forcePurchase || Math.random() < 0.60)) {
            await addButtons[1].click({ timeout: 3000 });
            console.log(`🛒 [Khách #${userNumber}] Đã bấm thêm món thứ 2 vào giỏ!`);
            await page.waitForTimeout(1500);
          }
        }
      } catch (e) {
        console.log(`⚠️ Không bấm được nút thêm nhanh, tiếp tục điều hướng giỏ hàng...`);
      }

      // Điều hướng vào Giỏ hàng bằng Link trên Header (client-side route)
      console.log(`🛒 [Khách #${userNumber}] Mở Giỏ hàng (/cart)... `);
      try {
        const cartLink = await page.waitForSelector('a[href="/cart"], a[aria-label*="Giỏ"], a[aria-label*="Cart"]', { timeout: 4000 });
        await cartLink.click();
      } catch {
        await page.goto(`${TARGET_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      }

      // Nán lại xem giỏ hàng từ 15 đến 25 giây (có tương tác để GA4 tính giờ liên tục)
      console.log(`👀 [Khách #${userNumber}] Đang kiểm tra giỏ hàng...`);
      await activeDwell(page, 15000 + Math.random() * 8000);

      // 4. Khách bấm nút Đặt Hàng thật (forcePurchase = 100%, hoặc 50% khách giỏ hàng)
      const doesPurchase = forcePurchase || (Math.random() < 0.50);
      if (doesPurchase) {
        try {
          const checkoutBtn = await page.waitForSelector('button:has-text("Đặt món, trả tiền mặt"), button:has-text("tiền mặt"), button:has-text("Xác Nhận Đặt Món"), button:has-text("Đặt món")', { timeout: 8000 });
          const btnText = (await checkoutBtn.innerText()).replace(/\n/g, ' ');
          console.log(`💳 [Khách #${userNumber}] BẤM NÚT ĐẶT HÀNG TIỀN MẶT: "${btnText}"...`);
          
          await checkoutBtn.click();

          // Chờ API tạo đơn thành công và tự động chuyển sang trang /order-success
          await page.waitForURL('**/order-success**', { timeout: 20000 });
          console.log(`🎉 [Khách #${userNumber}] Đã tạo đơn tiền mặt thành công & chuyển tới: ${page.url()}`);
          console.log(`💰 [Khách #${userNumber}] GA4 đã nhận sự kiện 'purchase' với DOANH THU THẬT & TRANSACTION ID!`);

          // Nán lại xem trang xác nhận & mã VietQR PayOS 25 - 35 giây
          await activeDwell(page, 25000 + Math.random() * 8000);
          console.log(`✅ [Khách #${userNumber}] Hoàn tất phiên xem đơn hàng tiền mặt thành công!`);
        } catch (checkoutErr) {
          console.log(`⚠️ [Khách #${userNumber}] Không thể bấm nút đặt hàng: ${checkoutErr.message}`);
        }
      }
    }

    // Ép GA4 xả toàn bộ thời gian tương tác tích lũy (45 - 80 giây) về máy chủ GA4
    await flushGaEngagement(page);
    console.log(`✨ [Khách #${userNumber}] Hoàn tất phiên trải nghiệm trọn vẹn (Đã gửi đủ thời gian tương tác về GA4)!`);
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
  console.log(`📊 Cấu hình: Bounce Rate mục tiêu ~40% | Avg Engagement Time ~1 phút | Chốt đơn tăng doanh thu`);
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

    // Giờ thấp điểm buổi chiều: 4 đến 5 khách (~4.5 khách)
    totalUsers = Math.floor(Math.random() * 2) + 4;
    console.log(`👥 ☕ Quán có ${totalUsers} khách ghé mua vào giờ thấp điểm.`);
  } else if (vnTime.isPeakHour) {
    // KHUNG GIỜ CAO ĐIỂM (6:30 - 9:30, 11:00 - 13:30, 17:00 - 20:00): 6 đợt trong ngày
    // Mỗi đợt 10 đến 13 khách (trung bình ~11.5 khách x 6 đợt = ~69 khách)
    totalUsers = Math.floor(Math.random() * 4) + 10;
    console.log(`🔥 [GIỜ CAO ĐIỂM] Khách đông đúc! Dự kiến đợt này có: ${totalUsers} khách.`);
  } else {
    // KHUNG GIỜ BÌNH THƯỜNG (21:15 tối trước đóng cửa): 1 đợt trong ngày
    // 5 đến 7 khách (trung bình ~6 khách) -> Tổng ngày ~80 khách
    totalUsers = Math.floor(Math.random() * 3) + 5;
    console.log(`✨ [GIỜ BÌNH THƯỜNG] Lượng khách vừa phải. Dự kiến có: ${totalUsers} khách.`);
  }

  // 3. Phân bổ các khách thành từng "Nhóm bàn" (Mỗi nhóm từ 1 đến 3 người)
  const groups = [];
  let remainingUsers = totalUsers;
  while (remainingUsers > 0) {
    const maxGroup = vnTime.isSlowHour ? 3 : 4;
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
  // Đảm bảo ít nhất 1 khách trong đợt chạy chắc chắn hoàn tất đơn hàng (chốt doanh thu)
  let hasPurchasedInRun = false;

  for (let g = 0; g < groups.length; g++) {
    const groupSize = groups[g];
    console.log(`\n👥 --- NHÓM BÀN #${g + 1} VÀO QUÁN (${groupSize} người cùng lúc) ---`);

    const userPromises = [];
    for (let u = 0; u < groupSize; u++) {
      const userNum = currentUserIndex++;
      const delayMs = u * (1500 + Math.random() * 1500);
      
      // Khách đầu tiên của nhóm 1 sẽ chắc chắn đặt hàng để đảm bảo đợt chạy nào cũng ghi nhận doanh thu
      const isLuckyBuyer = !hasPurchasedInRun && (g === 0 && u === 0);
      if (isLuckyBuyer) hasPurchasedInRun = true;

      userPromises.push(
        (async () => {
          if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
          await simulateSingleUser(browser, userNum, g + 1, isLuckyBuyer);
        })()
      );
    }

    await Promise.all(userPromises);
    console.log(`🏁 Nhóm bàn #${g + 1} đã duyệt xong!`);

    // Giãn cách ngẫu nhiên từ 2 đến 4 phút giữa các nhóm (nếu còn nhóm sau)
    if (g < groups.length - 1) {
      const waitSeconds = Math.floor(50 + Math.random() * 30); // 50 - 80 giây (~1 phút)
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
