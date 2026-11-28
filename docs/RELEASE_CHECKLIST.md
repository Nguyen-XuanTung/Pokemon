# Danh mục kiểm tra bàn giao phát hành cuối LingoWild

## 1. Khắc phục triệt để các phát hiện kiểm toán kỹ thuật

- [x] Sửa lỗi chuỗi `Promise` trong đường dẫn dự phòng ngoại tuyến của `public/sw.js` bằng hàm `async/await` tường minh; chỉ quản lý bộ nhớ đệm `lingowild-cache-*` và trả lỗi `503` chuẩn cho tài nguyên con thất bại.
- [x] Sinh phiên bản bộ nhớ đệm `CACHE_VERSION` bằng băm `SHA-256` trên đường dẫn sắp xếp xác định và nội dung byte thực tế của toàn bộ tệp đóng gói trong `scripts/inject-sw-manifest.ts`; bổ sung kiểm thử tự động nâng cấp trình phục vụ từ bản A sang bản B và kiểm tra điều hướng ngoại tuyến trên đường dẫn chưa lưu đệm.
- [x] Nâng cấp cấu trúc tệp lưu lên phiên bản `2` kèm bộ chuyển đổi tương thích ngược từ bản 1.0 và 1.1 trong `src/domain/save.ts`, tự động dời nhân vật khỏi ô mới bị chặn sang ô đi bộ an toàn gần nhất.
- [x] Chống mất tiến trình khi mở nhiều thẻ trình duyệt bằng kiểm tra dấu thời gian mới hơn trong `localStorage` và bảo toàn bản sao lưu dự phòng khi gặp lỗi đầy bộ nhớ `QuotaExceededError`.
- [x] Tách bạch hoàn toàn điều kiện đủ hạn thời gian chờ (`isWordDueForReencounter`) khỏi điểm xếp hạng ưu tiên (`computeWordReencounterPriority`) trong `src/domain/learning.ts`; kiểm thử đầy đủ trường hợp nhiều từ đến hạn, từ có điểm dương nhưng chưa đến hạn và từ đã ghi nhớ bậc `3`.
- [x] Mô tả chính xác phạm vi đo độ phủ V8 thực tế (`src/domain/` và `src/game/controller.ts`), không phóng đại thành độ phủ toàn bộ giao diện.
- [x] Kiểm tra lỗ hổng phụ thuộc bằng `npm audit` đạt `0` lỗ hổng; không có mã chết, tệp trùng lặp hay khóa bí mật phía máy khách.

## 2. Đại tu nghệ thuật thế giới, sinh vật, sân đấu và hậu cốt truyện

- [x] Tích hợp các bộ tài nguyên pixel mở đã xác minh giấy phép và ghi công đầy đủ trong `assets-src/` và `CREDITS.md` (`Kenney` CC0, `Sharm` CC-BY, `ArMM1998` CC0, `Luis Zuno` CC0/CC-BY, `Admurin` CC-BY, `Pyromantic` CC0/CC-BY).
- [x] Đại tu cả 5 khu vực `32x24` có bản sắc rõ rệt và va chạm chính xác: làng `Mosslight Camp` có nhà gỗ lớn, đài phun nước động, quầy chợ, ghế dài, chậu hoa; `Whisperwood Glen` nhiều tầng cây, vệt nắng, bóng đổ, đá rêu cổ và thân gỗ rỗng; `Reedwater Fen` có đường ván gỗ, cầu nối đảo sen, sương trôi và không có nhân vật đứng sai trên mặt nước; `Terracotta Ridge` có vách đá đất nung xếp tầng có gờ cát và thác nước `3x3`; `Starfall Sanctuary` có nền đá đen cổ ngữ, cổng vòm `4x4` và tượng hộ vệ.
- [x] Bổ sung bạn đồng hành đi theo sau người chơi trên bản đồ (`companions.png`), biến thể ánh kim hiếm tự nhiên, 4 dấu vết sinh cảnh phát sáng, thông báo ăn mừng tiến hóa, sổ bách khoa hiển thị bóng dáng bí ẩn kèm gợi ý vùng sống và thời điểm xuất hiện, cùng truyện ngắn thực địa sau khi kết bạn.
- [x] Nâng cấp 5 sân đấu pixel theo vùng (`battle-bg.png`), thanh dự báo chiến thuật đầu lượt, gợi ý đổi đồng đội khắc chế, hiển thị trực tiếp tỷ lệ thu phục ước tính và mở khóa 4 trận tái đấu bậc thầy cấp `24-30` sau khi hoàn thành cốt truyện chính.

## 3. Tiếp thu tiếng Anh tự nhiên, giao diện sổ thực địa và di động

- [x] Mở rộng lên 367 mục từ lõi (bổ sung nhóm từ và cụm từ giao tiếp đời thường, 25 mục có nhiều câu ví dụ độc lập) kết hợp từ điển bỏ túi ngoại tuyến hơn 430 mục đạt độ phủ tra từ hội thoại `90,5%`.
- [x] Tách rõ 4 trạng thái trong Sổ Từ Vựng (`Encountered`, `Saved`, `Mastered`, `Due Now`), giữ nguyên nguyên tắc hoàn thành toàn bộ trò chơi không cần làm bất kỳ bài ôn từ nào.
- [x] Nâng cấp màn hình mở đầu có thẻ xem trước 3 bạn đồng hành khởi đầu, hỗ trợ nhấn giữ cụm phím chữ thập trên di động để bước liên tục và hiển thị trọn vẹn khung mục tiêu hai dòng không cắt chữ.

## 4. Bằng chứng kiểm thử, hình ảnh, video thực tế và GitHub Actions

- [x] Vượt qua toàn bộ `npm run validate:data`, `npm run typecheck`, `npm run lint`, `npm run test:coverage` (`26/26` bài kiểm thử, gồm phá đảo tự nhiên cả 3 starter), `npm run build` và `npm run test:e2e`.
- [x] Chụp mới và rà soát trực quan đầy đủ bộ ảnh chụp cả 5 vùng, nhiều sân đấu pixel, giao diện sổ thực địa và di động dọc ngang trong `docs/screenshots/`.
- [x] Quay video gameplay thực tế dài từ 1 đến 3 phút lưu tại `docs/videos/lingowild-gameplay.webm`.
- [x] Đẩy mã lên nhánh `develop/lingowild` (không tự gộp vào `main`) và xác nhận trực tiếp quy trình GitHub Actions chạy xanh trên commit cuối cùng.

## 5. Quy trình xuất bản lên GitHub Pages khi chủ dự án nghiệm thu

1. Mở mục `Settings` rồi chọn `Pages` trên kho GitHub `Nguyen-XuanTung/Pokemon`, tại mục `Build and deployment` đặt `Source` thành `GitHub Actions`.
2. Rà soát và bấm `Merge pull request` đối với pull request từ nhánh `develop/lingowild` sang nhánh `main`.
3. Chờ quy trình `.github/workflows/ci-and-deploy.yml` chạy hoàn tất hai bước `verify-and-build` và `deploy-pages` trên nhánh `main` để xuất bản gói `./dist` lên `https://nguyen-xuantung.github.io/Pokemon/`.
4. Mở trang đã xuất bản để xác nhận tải trang, âm thanh khi tương tác, lưu tiến trình cục bộ và tải lại ngoại tuyến trên đường dẫn `/Pokemon/` hoạt động ổn định.
