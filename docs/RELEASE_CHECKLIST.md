# Danh mục kiểm tra bàn giao LingoWild 1.1

## 1. Kiến trúc, phụ thuộc và an toàn chuỗi cung ứng

- [x] Giữ nguyên kiến trúc cốt lõi hợp lệ trên nhánh `develop/lingowild`, không tạo giao diện thứ hai và không sinh tệp trùng lặp kiểu `v2`.
- [x] Kiểm tra lỗ hổng bảo mật bằng `npm audit` đạt 0 lỗ hổng sau khi nâng cấp `vite@8.4.0`, `vitest@5.1.2` và `@vitest/coverage-v8@5.1.2` kèm khóa chặt `package-lock.json`.
- [x] Tách gọn trách nhiệm giao diện thành `src/ui/gameUi.ts`, `src/ui/battleView.ts`, `src/ui/journalView.ts` và `src/ui/uiHelpers.ts`; giữ tầng nghiệp vụ thuần trong `src/domain/` độc lập khỏi Phaser và DOM.
- [x] Không chứa khóa bí mật, mã theo dõi ngầm hay dữ liệu cá nhân trong mã máy khách.

## 2. Tài nguyên mở, thế giới 5 vùng và chiến đấu sinh vật

- [x] Xác minh giấy phép và ghi công đầy đủ cho hai bộ pixel mã mở Kenney `Roguelike/RPG Pack` (CC0 1.0) và Sharm `Tiny 16: Basic` (CC-BY 3.0 / 4.0) trong `assets-src/` và `CREDITS.md`.
- [x] Nâng cấp toàn bộ 5 bản đồ lên kích thước `32x24` với đường mòn tự nối 16 hướng, bờ nước tự động 16 hướng, cây cổ thụ hai lớp có tán che trên nhân vật, kiến trúc trại, cầu gỗ, thuyền, điểm ngắm cảnh, rương ẩn và kiểm định đường đi bằng thuật toán tìm kiếm theo chiều rộng.
- [x] Nâng cấp toàn bộ 30 loài sinh vật lên khung hình `48x48` hai nhịp thở có đổ bóng, phân loại độ hiếm và vai trò chiến đấu; dựng 5 sân đấu theo vùng kèm đòn bay nguyên tố, số sát thương nổi, hoạt ảnh thu phục thành công và thất bại cùng tùy chọn tốc độ trận đấu.

## 3. Cơ chế tiếng Anh thích ứng và triết lý đặt trò chơi lên trước

- [x] Đủ 343 mục từ và cụm từ Anh Việt đã kiểm định nghĩa, từ loại, phiên âm và ví dụ; hỗ trợ cụm nhiều từ và giải nghĩa từ đa nghĩa theo ngữ cảnh câu.
- [x] Đủ 179 đoạn hội thoại có biến thể câu theo trình độ từ A1 đến B2 và hỗ trợ phát âm cả câu hội thoại qua Web Speech API kèm thông báo phiên âm dự phòng.
- [x] Tách bạch hoàn toàn số lần nhìn thấy từ thụ động với mức độ ghi nhớ chủ động; vận hành bộ lập lịch gặp lại từ theo thời gian và lịch sử tra cứu tại các điểm ngắm cảnh cùng lửa trại.
- [x] Đảm bảo người chơi hoàn thành trọn vẹn cốt truyện từ đầu đến cuối mà không cần mở bất kỳ lượt ôn tập từ vựng nào.

## 4. Giao diện, di động, lưu trữ, ngoại tuyến và kiểm thử nghiệm thu

- [x] Hoàn thiện phong cách sổ gỗ và giấy thực địa trên màn hình mở đầu, thanh trạng thái gọn, hội thoại, túi đồ, đội hình, sổ từ, bản đồ la bàn 5 vùng và màn hình tổng kết cuối truyện.
- [x] Trên di động dọc (`412x915`) và ngang (`915x412`), loại bỏ khoảng trống chết phía trên bản đồ, thông báo nhỏ gọn không che khu vực chơi, cụm điều khiển chữ thập trực quan hoàn thành nhiệm vụ không cần bàn phím.
- [x] Kiểm định sâu cấu trúc tệp lưu, giới hạn số, tọa độ bản đồ và toàn bộ khóa ngoại; chặn tệp nhập lỗi làm mất bản lưu hợp lệ; ưu tiên bản lưu bộ nhớ tạm khi có dữ liệu mới hơn `localStorage`.
- [x] Giới hạn `public/sw.js` chỉ quản lý bộ nhớ đệm mang tiền tố `lingowild-cache-`, không bao giờ trả `index.html` thay cho tệp mã nguồn, định kiểu hoặc hình ảnh thất bại; cấu hình chạy đủ kiểm thử đơn vị, tích hợp, độ phủ và Playwright E2E trên quy trình tích hợp liên tục.
- [x] Giữ nguyên kiểm thử tích hợp có dữ liệu mẫu với tên mô tả trung thực, đồng thời bổ sung kiểm thử phá đảo tự nhiên 100% thao tác người chơi cho cả 3 sinh vật khởi đầu và kịch bản trình duyệt đầu cuối từ màn hình mở đầu tới đoạn kết.
