# Danh mục kiểm tra bàn giao LingoWild

## 1. Hoàn thiện trải nghiệm người mới và tiếng Việt đầy đủ

- [x] Tách độc lập Ngôn ngữ giao diện (`Tiếng Việt`, `Tiếng Anh`), Ngôn ngữ hội thoại và nội dung (`Tiếng Việt hoàn toàn`, `Song ngữ Anh Việt`, `Tiếng Anh có trợ giúp tra cứu`, `Đắm chìm trong tiếng Anh`) và Độ khó chiến đấu (`Thư giãn`, `Phiêu lưu`, `Thử thách`), mặc định sẵn tiếng Việt + song ngữ + Thư giãn cho người mới và cho phép đổi trực tiếp giữa phiên không mất dữ liệu.
- [x] Kiểm toán tự động toàn bộ màn hình mở đầu, thanh HUD, hộp thoại, trận đấu và 7 thẻ Sổ Thực Địa ở chế độ tiếng Việt xác nhận 0 nhãn giao diện tiếng Anh bị lọt.
- [x] Triển khai hệ thống dẫn đường BFS ba mức (`Đầy đủ`, `Tối giản`, `Tắt`) tránh mọi vật cản, nối nhiều vùng qua cổng đã mở khóa, hiển thị mũi tên la bàn, vệt sáng mặt đất, bản đồ nhỏ, dấu `!` và `?` trên nhân vật, gợi ý tương tác gần, nút `Dẫn đường` theo nhiệm vụ và nút `Tôi bị lạc`. Không lộ rương bí mật và chỉ báo yêu cầu khi gặp cổng khóa.
- [x] Chuẩn hóa cả 12 thẻ nhiệm vụ hiển thị đủ việc cần làm, cần tìm ai, khu vực, tiến độ, yêu cầu chưa đạt và gợi ý chuẩn bị.
- [x] Xây dựng hướng dẫn nhập môn 10 bước tự nhiên (5 đến 10 phút), bảo đảm thu phục 100% ở lần bắt hướng dẫn đầu tiên, cho phép bỏ qua bước tra từ tiếng Anh hoặc bỏ qua toàn bộ hướng dẫn bất kỳ lúc nào mà không mất vật phẩm hay tiến trình.
- [x] Triển khai 3 chế độ độ khó cân bằng không bơm máu vô nghĩa và Trợ giúp chiến đấu bật tắt linh hoạt (gợi ý chiêu khuyên dùng, giải thích khắc chế, cảnh báo máu thấp, gợi ý đổi đồng đội, tỷ lệ bắt trực tiếp, cảnh báo trước Thủ lĩnh, thông báo học chiêu và Quản lý chiêu trong thẻ Đội hình, hồi sức miễn phí tại lửa trại khi thua).

## 2. An toàn kỹ thuật, di trú bản lưu và vận hành ngoại tuyến

- [x] Sửa đường dẫn dự phòng ngoại tuyến trong `public/sw.js` dùng `async/await` tường minh, chỉ quản lý bộ nhớ đệm `lingowild-cache-*`, trả mã `503` chuẩn cho tài nguyên con thất bại và kiểm thử nâng cấp thực tế từ bản A sang bản B.
- [x] Di trú tương thích ngược an toàn cho các bản lưu phiên bản `1` và `2`, bảo vệ chống ghi đè đa thẻ trình duyệt (`hasMultiTabConflict`) và giữ nguyên bản sao lưu dự phòng khi bộ nhớ đầy.
- [x] Tách bạch điều kiện đủ hạn thời gian chờ (`isWordDueForReencounter`) khỏi điểm ưu tiên (`computeWordReencounterPriority`) trong `src/domain/learning.ts`.
- [x] Không thêm gói phụ thuộc mới, không tạo thành phần hay CSS trùng lặp, `npm audit --audit-level=low` đạt `0` lỗ hổng và `npm run lint` đạt `0` lỗi.

## 3. Bằng chứng kiểm thử, hình ảnh, video và tích hợp liên tục

- [x] Vượt qua `npm run validate:data`, `npm run typecheck`, `npm run lint`, `npm run test:coverage` (`35/35` bài kiểm thử, gồm phá đảo 3 starter độ khó Phiêu lưu và 9 bài kiểm thử trải nghiệm người mới), `npm run build` và `npm run test:e2e` (`11/11` bài hoạt động trên desktop và mobile).
- [x] Cập nhật và kiểm tra trực quan đủ 22 ảnh chụp màn hình trong `docs/screenshots/` cùng video hướng dẫn người mới dài `88,6` giây tại `docs/videos/lingowild-gameplay.webm`.
- [x] Công bố rõ phạm vi đo độ phủ V8 (`src/domain/` và `src/game/controller.ts`) và phân biệt rõ kiểm thử tự động với kiểm thử trên người chơi thật bên ngoài.
- [x] Đẩy mã lên nhánh `develop/lingowild`, cập nhật pull request #1 (không tự gộp vào `main`) và xác nhận quy trình GitHub Actions chạy xanh trên commit cuối cùng.

## 4. Quy trình xuất bản lên GitHub Pages sau khi chủ dự án nghiệm thu

1. Mở mục `Settings` rồi chọn `Pages` trên kho GitHub `Nguyen-XuanTung/Pokemon`, đặt `Source` trong `Build and deployment` thành `GitHub Actions`.
2. Kiểm tra pull request #1 từ `develop/lingowild` sang `main`, xác nhận bước `verify-and-build` xanh và bấm `Merge pull request`.
3. Chờ quy trình `.github/workflows/ci-and-deploy.yml` tự động xuất bản gói `./dist` lên `https://nguyen-xuantung.github.io/Pokemon/`.
4. Mở trang đã xuất bản trên máy tính và điện thoại để kiểm tra trải nghiệm người mới tiếng Việt và khả năng tải lại ngoại tuyến trên đường dẫn `/Pokemon/`.
