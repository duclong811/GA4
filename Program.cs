using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

// 1. Đọc cấu hình từ biến môi trường
string? measurementId = Environment.GetEnvironmentVariable("GA_MEASUREMENT_ID");
string? apiSecret = Environment.GetEnvironmentVariable("GA_API_SECRET");

if (string.IsNullOrWhiteSpace(measurementId) || string.IsNullOrWhiteSpace(apiSecret))
{
    Console.WriteLine("❌ Lỗi: Thiếu biến môi trường GA_MEASUREMENT_ID hoặc GA_API_SECRET.");
    return;
}

using var httpClient = new HttpClient();
string endpoint = $"https://www.google-analytics.com/mp/collect?measurement_id={measurementId}&api_secret={apiSecret}";

// 2. Danh sách Client ID cố định đại diện cho Returning Users
string[] returningUserPool = [
    "100100101.1710000001",
    "100100102.1710000002",
    "100100103.1710000003",
    "100100104.1710000004",
    "100100105.1710000005",
    "100100106.1710000006",
    "100100107.1710000007",
    "100100108.1710000008"
];

// 3. Danh mục sản phẩm mẫu quán Cafe
var menuItems = new[]
{
    new { Id = "1", Name = "Ca phe Muoi Dac San", Price = 35000, Category = "Coffee" },
    new { Id = "2", Name = "Tra Sua Oolong Nuong", Price = 45000, Category = "MilkTea" },
    new { Id = "3", Name = "Bac Xiu Sai Gon", Price = 32000, Category = "Coffee" },
    new { Id = "4", Name = "Tra Dao Cam Sa", Price = 42000, Category = "FruitTea" },
    new { Id = "5", Name = "Croissant Bo Toi", Price = 38000, Category = "Bakery" }
};

var random = new Random();
int usersToSimulate = random.Next(3, 8);

Console.WriteLine($"=================================================");
Console.WriteLine($"🚀 Bắt đầu mô phỏng {usersToSimulate} phiên truy cập vào GA4...");
Console.WriteLine($"Measurement ID: {measurementId}");
Console.WriteLine($"=================================================\n");

for (int i = 0; i < usersToSimulate; i++)
{
    bool isReturning = random.NextDouble() < 0.70;

    string clientId = isReturning
        ? returningUserPool[random.Next(returningUserPool.Length)]
        : $"{random.Next(100000000, 999999999)}.{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

    long sessionId = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    long engagementMsec = random.Next(15000, 45000);
    var events = new List<object>();

    // 1. Vào xem trang Menu (page_view)
    events.Add(new
    {
        name = "page_view",
        @params = new
        {
            page_title = "AI-SMARTSERVE | Handcrafted Menu",
            page_location = "https://web-gamma-topaz-43.vercel.app/menu",
            session_id = sessionId,
            engagement_time_msec = engagementMsec,
            debug_mode = 1
        }
    });

    // 2. Tương tác tích cực (user_engagement)
    events.Add(new
    {
        name = "user_engagement",
        @params = new
        {
            session_id = sessionId,
            engagement_time_msec = engagementMsec,
            debug_mode = 1
        }
    });

    // 3. Xem chi tiết 1 món ăn (view_item)
    var selectedItem = menuItems[random.Next(menuItems.Length)];
    events.Add(new
    {
        name = "view_item",
        @params = new
        {
            currency = "VND",
            value = selectedItem.Price,
            session_id = sessionId,
            engagement_time_msec = 5000,
            debug_mode = 1,
            items = new[]
            {
                new {
                    item_id = selectedItem.Id,
                    item_name = selectedItem.Name,
                    item_category = selectedItem.Category,
                    price = selectedItem.Price,
                    quantity = 1
                }
            }
        }
    });

    // 4. Xác suất 60% thêm món vào giỏ hàng (add_to_cart)
    if (random.NextDouble() < 0.60)
    {
        events.Add(new
        {
            name = "add_to_cart",
            @params = new
            {
                currency = "VND",
                value = selectedItem.Price,
                session_id = sessionId,
                engagement_time_msec = 5000,
                debug_mode = 1,
                items = new[]
                {
                    new {
                        item_id = selectedItem.Id,
                        item_name = selectedItem.Name,
                        price = selectedItem.Price,
                        quantity = 1
                    }
                }
            }
        });

        // 5. Xác suất 40% đặt hàng (purchase)
        if (random.NextDouble() < 0.40)
        {
            string orderCode = $"ORD-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % 1000000:D6}";
            events.Add(new
            {
                name = "purchase",
                @params = new
                {
                    transaction_id = orderCode,
                    currency = "VND",
                    value = selectedItem.Price,
                    session_id = sessionId,
                    debug_mode = 1,
                    items = new[]
                    {
                        new {
                            item_id = selectedItem.Id,
                            item_name = selectedItem.Name,
                            price = selectedItem.Price,
                            quantity = 1
                        }
                    }
                }
            });
        }
    }

    var payload = new
    {
        client_id = clientId,
        events = events
    };

    string jsonPayload = JsonSerializer.Serialize(payload);
    using var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

    try
    {
        var response = await httpClient.PostAsync(endpoint, content);
        string userTypeLabel = isReturning ? "[Returning User 🔄]" : "[New User 🆕      ]";

        if (response.IsSuccessStatusCode)
        {
            Console.WriteLine($"✅ {userTypeLabel} Client: {clientId} | Gửi {events.Count} events thành công.");
        }
        else
        {
            Console.WriteLine($"⚠️ {userTypeLabel} Gửi thất bại HTTP Status: {response.StatusCode}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Ngoại lệ khi gửi: {ex.Message}");
    }

    await Task.Delay(random.Next(1000, 2000));
}

Console.WriteLine("\n🎉 Đã hoàn thành đợt mô phỏng traffic!");
