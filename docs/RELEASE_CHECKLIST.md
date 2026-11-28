# Danh mục kiểm tra bàn giao phát hành LingoWild v1.2.0

## 1. Hoàn thiện trải nghiệm người mới và thống nhất toàn diện

- [x] Thống nhất 100% mục tiêu dẫn đường giữa thanh HUD, mũi tên la bàn, số bước, vệt sáng mặt đất, bản đồ nhỏ và cửa sổ `Tôi bị lạc`; ưu tiên hướng dẫn khi đang nhập môn và chuyển về nhiệm vụ đang theo dõi sau khi hoàn thành hoặc bỏ qua.
- [x] Hiển thị rõ nhãn `Đã tới nơi` và làm sáng nút tương tác khi tới điểm đến; không chỉ đường xuyên vật cản, không qua cổng khóa, không dẫn tới mục tiêu đã xong và giải thích rõ khi không tìm được đường.
- [x] Chuẩn hóa Trợ giúp chiến đấu chỉ có đúng một khuyến nghị chính mỗi lượt (`heal`, `capture`, `switch` hoặc `move`), cảnh báo `Dễ đánh ngất` với sinh vật chưa thu phục, nhắc chuẩn bị cấp độ, hệ khắc chế và bình hồi máu trước Thủ lĩnh, có lưới an toàn cấp Chuông Rêu dự phòng ở chế độ Thư giãn.
- [x] Hoàn thiện 10 bước nhập môn rõ việc cần làm, nơi cần đi và nút cần bấm; sửa ngưỡng bước `move_around` thành 2 bước khớp đường đi tới Trinh sát Mai; bổ sung `Xem nhanh 8 bước cho người mới` và `Bật lại gợi ý từng bước` trong `Tôi bị lạc`.
- [x] Kiểm toán toàn bộ giao diện tiếng Việt (`vi` và `vi_only`), dịch sạch cả thông báo lỗi hệ thống từ `save.ts`, giữ độc lập ngôn ngữ giao diện, nội dung, mức tiếng Anh và độ khó, không mất tiến trình khi chuyển đổi.
- [x] Kiểm chứng cân bằng thực tế độ khó Thư giãn bằng lượt chơi tự nhiên trọn vẹn cho cả 3 sinh vật khởi đầu (`Mosskit`, `Kindlet`, `Ripplefin`) song song với 3 lượt độ khó Phiêu lưu.

## 2. Phiên bản hóa, giấy phép gói web và an toàn kỹ thuật

- [x] Thống nhất số phiên bản ngữ nghĩa `1.2.0` trong `package.json`, `package-lock.json`, `README.md`, `src/game/controller.ts`, giao diện màn hình mở đầu và Git tag `v1.2.0`.
- [x] Phân phối thông tin giấy phép và ghi công tài nguyên cùng bản đóng gói web (`dist/LICENSE.txt`, `dist/CREDITS.md`, lưu đệm ngoại tuyến trong `dist/sw.js` và cửa sổ `Giấy phép và Ghi công` ngay trong ứng dụng).
- [x] Kiểm tra tương thích ngược với bản lưu production `v1.1` đang chạy trên GitHub Pages, chống ghi đè đa thẻ và bảo toàn bản dự phòng khi bộ nhớ đầy.
- [x] Không thêm gói phụ thuộc mới, không có tệp trùng lặp, `npm audit --audit-level=low` đạt `0` lỗ hổng và `npm run lint` đạt `0` lỗi.

## 3. Cổng kiểm định, triển khai production và nghiệm thu thực tế

- [x] Vượt qua toàn bộ `npm ci --ignore-scripts`, `npm audit --audit-level=low`, `npm run validate:data`, `npm run lint`, `npm run typecheck`, `npm run test:coverage` (`36/36` bài), `npm run build` và `npm run test:e2e` (`12/12` bài hoạt động, gồm kịch bản đọc chỉ dẫn trực tiếp trên màn hình).
- [x] Cập nhật và kiểm tra trực quan đủ 23 ảnh chụp màn hình trong `docs/screenshots/` và video hướng dẫn mở đầu `docs/videos/lingowild-gameplay.webm`.
- [x] Đẩy lên `develop/lingowild`, xác nhận GitHub Actions xanh cho cả `push` và `pull_request` trên PR #2.
- [ ] Gộp PR #2 vào `main` bằng merge commit thông thường, xác nhận `verify-and-build` và `deploy-pages` trên `main` thành công, tạo Git tag `v1.2.0` và GitHub Release `v1.2.0`.
- [ ] Kiểm chứng trực tiếp trang production https://nguyen-xuantung.github.io/Pokemon/ trên trình duyệt thật (cả phiên sạch và phiên nâng cấp từ bản lưu `v1.1` cũ, desktop, mobile, ngoại tuyến và truy cập giấy phép).
