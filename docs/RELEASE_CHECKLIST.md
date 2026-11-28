# Danh mục kiểm tra bàn giao phát hành LingoWild v1.3.0

## 1. Hệ thống nhấp chuột hoặc chạm để tự tìm đường

- [x] Chuyển chính xác tọa độ con trỏ màn hình sang ô bản đồ theo camera, tỷ lệ phóng, thay đổi kích thước cửa sổ và xoay màn hình di động.
- [x] Sử dụng lại thuật toán tìm đường BFS trong `src/domain/navigation.ts` (`planClickToMove`), bước lần lượt qua từng ô và giữ nguyên toàn bộ sự kiện gameplay (gặp sinh vật hoang, thời gian, nhiệm vụ, vật phẩm, đồng hành).
- [x] Hiển thị đường tự tìm đường màu xanh lam và vòng đích tách biệt hoàn toàn với đường dẫn nhiệm vụ màu vàng; hiển thị phản hồi đỏ cam khi ô bị chặn và không đi xuyên nước, cây hay kiến trúc.
- [x] Tương tác thông minh đúng một lần với NPC, rương, biển chỉ đường, lửa trại; bước vào cổng đã mở khóa và giải thích rõ khi bấm vào cổng đang khóa; giữ nguyên xác nhận với các hành động quan trọng.
- [x] Hủy đường cũ khi chọn đích mới, hủy ngay khi bấm phím thủ công, hủy sạch khi vào trận chiến, mở hộp thoại, mở menu, mất focus hoặc chuyển vùng (không tự đi tiếp sau trận chiến).
- [x] Cách ly hoàn toàn click trên HUD, nút bấm, hộp thoại và bản đồ nhỏ; cho phép bật tắt trong Cài đặt.

## 2. Hệ thống di chuyển liên tục mượt mà hợp nhất

- [x] Hợp nhất bàn phím (`WASD`, mũi tên, phím gán lại), phím cảm ứng, tự tìm đường và chế độ chạy vào một bộ điều phối duy nhất (`src/game/movement.ts`), loại bỏ sự phụ thuộc lặp phím hệ điều hành và bộ hẹn giờ cảm ứng độc lập.
- [x] Đo thực tế trước và sau trên trình duyệt thật: đi bộ đạt trung bình `164,9 ms/ô`, chạy giữ `Shift` đạt trung bình `110,1 ms/ô`, `0` khoảng dừng giữa các ô, `0` lần xóa gốc DOM `#ui-overlay` (giảm từ `36` lần của `v1.2.0`), bảo toàn chế độ giảm chuyển động.
- [x] Xử lý đầy đủ `keyup`, `pointerup`, `pointercancel`, `blur`, `visibilitychange`, giới hạn delta khung hình `50 ms`, sửa chuẩn tọa độ tâm camera Phaser 3 và đồng bộ làm mượt camera ở `30`, `60`, `120 Hz`.

## 3. Học đa ngôn ngữ và tiếng Trung chuẩn HSK 2.0

- [x] Mở rộng ngay trên nền trò chơi hiện có mà không nhân đôi bộ điều phối hay giao diện; tách độc lập ngôn ngữ giao diện, ngôn ngữ học (`en`, `zh`, `none`), trình độ riêng (`CEFR A1-B2` và `HSK 1-3`), 5 chế độ hiển thị tiếng Trung, Pinyin trên/dưới và bản dịch tiếng Việt.
- [x] Xác minh dữ liệu HSK 2.0 giản thể bằng kịch bản tái lập `scripts/verify-hsk-data.ts`: đủ `150` HSK 1, `150` HSK 2, `298 + 2` đa âm HSK 3 (`600` mục HSK 1-3 đầy đủ), `73` bổ trợ HSK 4 (ghi rõ không công bố phủ đầy đủ HSK 4), `314` từ ngữ cảnh không gán HSK và `55` tên riêng tách biệt.
- [x] Phủ tiếng Trung đầy đủ cho toàn bộ `192` hội thoại (`98` đoạn có biến thể HSK, độ phủ chạm tra `84,7%`), `30` loài, `42` chiêu, `13` vật phẩm, `12` nhiệm vụ, `5` bản đồ, `16` NPC và toàn bộ nhật ký trận đấu.
- [x] Phiếu tra nghĩa 10 trường theo ngữ cảnh, tách từ lai Trie kết hợp `Intl.Segmenter`, phát âm tiếng Trung nghiêm ngặt `zh-CN` (không rơi sang giọng tiếng Anh), ôn tập lửa trại tiếng Trung tự nguyện 3 dạng, hai sổ từ Anh/Trung độc lập, chuyển đổi trực tiếp không mất tiến trình và di trú tệp lưu `v1.0`/`v1.1`/`v1.2.0` sang lược đồ `v3`.

## 4. Phiên bản hóa, kiểm định, phát hành và kiểm chứng production

- [x] Thống nhất phiên bản `1.3.0` trong `package.json`, `package-lock.json`, `src/game/controller.ts`, `README.md` và tài liệu; không thêm gói phụ thuộc mới; `npm audit --audit-level=low` đạt `0` lỗ hổng.
- [x] Vượt qua `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test:coverage` (`50/50` bài) và toàn bộ bộ kiểm thử trình duyệt Playwright máy tính và di động.
- [x] Ghi hình thực tế 4 video gameplay mới của `v1.3.0` trong `docs/videos/` và kiểm tra trực quan 4 ảnh chụp màn hình mới trong `docs/screenshots/`.
- [ ] Đẩy nhánh `develop/lingowild`, xác nhận CI xanh, tạo và gộp PR vào `main`, phát hành Git tag và GitHub Release `v1.3.0`, xác nhận triển khai GitHub Pages thành công và kiểm chứng trực tiếp trên trang production https://nguyen-xuantung.github.io/Pokemon/.
