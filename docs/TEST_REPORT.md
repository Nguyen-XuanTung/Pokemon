# Báo cáo kiểm thử, độ phủ và đánh giá chơi thử LingoWild

## 1. Môi trường kiểm thử

- Hệ điều hành máy cục bộ: Windows x64 (`win32`), đối chiếu song song trên máy chủ Ubuntu (`ubuntu-latest`) của GitHub Actions.
- Môi trường thực thi: Node.js `v24.14.0`, npm `11.9.0`.
- Công cụ đóng gói, kiểm tra kiểu và bảo mật: Vite `8.4.0`, TypeScript `5.8.3` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`), `npm audit`.
- Khung kiểm thử đơn vị, tích hợp và đo độ phủ: Vitest `5.1.2` kèm `@vitest/coverage-v8@5.1.2`.
- Khung kiểm thử trình duyệt đầu cuối và ghi hình: Playwright `1.65.1` trên Chromium với cấu hình máy tính để bàn (`1280x720`) và điện thoại Pixel 7 ở cả chiều dọc (`412x915`) lẫn chiều ngang (`915x412`).

## 2. Kết quả tổng hợp các cổng kiểm định

| Hạng mục kiểm định | Lệnh thực thi | Kết quả thực tế |
| --- | --- | --- |
| Kiểm tra lỗ hổng phụ thuộc | `npm audit --audit-level=low` | Đạt: `0` lỗ hổng bảo mật trên toàn bộ cây phụ thuộc |
| Sinh 8 bảng ảnh pixel xác định | `npm run generate:assets` | Đạt: xuất `tileset.png`, `structures.png`, `battle-bg.png`, `characters.png`, `creatures.png`, `companions.png`, `items.png`, `vfx.png` |
| Kiểm định toàn vẹn dữ liệu và đường đi | `npm run validate:data` | Đạt: 30 loài, 42 chiêu, 13 vật phẩm, 5 bản đồ `32x24` kiểm chứng liên thông, 16 nhân vật phụ (4 thủ lĩnh, 4 tái đấu), 12 nhiệm vụ, 367 mục từ lõi (25 mục đa ví dụ, A1: 65, A2: 97, B1: 120, B2: 85), 192 hội thoại (độ phủ tra từ `90,5%`) |
| Kiểm tra quy tắc mã nguồn và tài liệu | `npm run lint` | Đạt: 0 lỗi văn phong trên 9 tệp Markdown và 49 tệp TypeScript, 0 tệp trùng lặp, 0 khóa bí mật hay điểm cuối theo dõi |
| Kiểm tra kiểu tĩnh nghiêm ngặt | `npm run typecheck` | Đạt: 0 lỗi trên toàn bộ mã nguồn, kịch bản và kiểm thử |
| Kiểm thử đơn vị, tích hợp và phá đảo 3 starter | `npm run test:coverage` | Đạt: `5/5` tệp (`26/26` bài kiểm thử), bao gồm kiểm thử tiến trình có dữ liệu mẫu và 3 lượt phá đảo tự nhiên 100% thao tác người chơi cho cả `Mosskit`, `Kindlet` và `Ripplefin` |
| Đóng gói sản phẩm và băm bộ nhớ đệm | `npm run build` | Đạt: `index.html` (`0,48 kB` gzip), `index.css` (`3,60 kB` gzip), gói ứng dụng và dữ liệu (`151,51 kB` gzip), gói Phaser tách riêng (`318,37 kB` gzip), chèn 14 đường dẫn sắp xếp xác định vào `dist/sw.js` với mã băm nội dung `SHA-256` |
| Kiểm thử trình duyệt đầu cuối và phá đảo thật | `npm run test:e2e` | Đạt: vượt qua toàn bộ các bài kiểm thử trên máy tính và di động dọc ngang, nhấn giữ phím chữ thập để đi bộ, nâng cấp trình phục vụ ngoại tuyến từ bản A sang bản B, đường dẫn `/Pokemon/` và lượt chơi trọn vẹn từ màn hình mở đầu tới đoạn kết |

## 3. Báo cáo độ phủ mã nguồn theo đúng phạm vi được đo

Cấu hình `vitest.config.ts` đo độ phủ V8 trực tiếp trên hai thư mục nghiệp vụ và điều phối cốt lõi là `src/domain/**/*.ts` và `src/game/**/*.ts` (loại trừ tệp định nghĩa kiểu thuần `src/domain/types.ts`). Các tầng giao diện DOM (`src/ui/`), cảnh dựng hình Phaser (`src/scenes/`), âm thanh Web Audio (`src/audio/`) và bảng dữ liệu tĩnh (`src/data/`) không nằm trong phép đo V8 này mà được kiểm chứng bằng `npm run validate:data` và bộ kiểm thử trình duyệt Playwright đầu cuối.

Số liệu thực tế trên phạm vi được đo (`src/domain/` và `src/game/controller.ts`):

- Tổng phạm vi được đo: `79,34%` câu lệnh, `83,22%` dòng mã, `82,69%` hàm, `73,77%` nhánh điều kiện.
- Tầng miền nghiệp vụ thuần (`src/domain/`): `83,48%` câu lệnh, `88,59%` dòng mã, `92,48%` hàm, `76,61%` nhánh điều kiện:
  - `src/domain/elements.ts`: `100%` câu lệnh, `100%` dòng mã, `100%` nhánh.
  - `src/domain/capture.ts`: `95,45%` câu lệnh, `100%` dòng mã, `91,66%` nhánh.
  - `src/domain/creatures.ts`: `94,73%` câu lệnh, `97,26%` dòng mã, `100%` hàm.
  - `src/domain/quests.ts`: `93,18%` câu lệnh, `93,18%` dòng mã, `100%` hàm.
  - `src/domain/battle.ts`: `90,33%` câu lệnh, `92,17%` dòng mã, `83,56%` nhánh, `100%` hàm.
  - `src/domain/learning.ts`: `88,47%` câu lệnh, `90,97%` dòng mã (bao phủ phân tách điều kiện đủ hạn `isWordDueForReencounter` với điểm ưu tiên `computeWordReencounterPriority`, tra từ bỏ túi ngoại tuyến và xoay vòng câu ví dụ độc lập).
  - `src/domain/state.ts`: `86,17%` câu lệnh, `89,77%` dòng mã.
  - `src/domain/save.ts`: `74,02%` câu lệnh, `84,75%` dòng mã, `94,44%` hàm (bao phủ chuyển đổi bản lưu phiên bản `1` sang `2`, dời tọa độ khỏi ô mới bị chặn, chống ghi đè đa thẻ và bảo toàn bản sao lưu khi đầy bộ nhớ).
  - `src/domain/world.ts`: `80,14%` câu lệnh, `82,11%` dòng mã, `93,75%` hàm.
  - `src/domain/rng.ts`: `71,42%` câu lệnh, `73,91%` dòng mã, `100%` hàm.
- Bộ điều phối trò chơi (`src/game/controller.ts`): `68,92%` câu lệnh, `70,50%` dòng mã, `65,33%` hàm, `63,47%` nhánh điều kiện.

## 4. Số liệu hiệu năng và xác minh các phát hiện kiểm toán

Số liệu đo tự động trên bản đóng gói chính thức (`test-results/benchmark-metrics.json`):

- Thời gian tải trang hoàn tất điều hướng: `440 ms`.
- Thời gian khởi tạo ứng dụng và gắn kết khung vẽ Phaser: `22 ms`.
- Tốc độ khung hình ghi nhận trên Chromium không giao diện khi chạy song song hai tiến trình kiểm thử: `43 FPS` (trên cửa sổ trình duyệt tương tác đơn lẻ đạt ổn định từ `55` đến `60 FPS`).
- Số lỗi bảng điều khiển (`console.error`, `pageerror`) và yêu cầu tài nguyên thất bại: `0` lỗi.

Kết quả xác minh trực tiếp các hạng mục kiểm toán:

1. Sửa chuỗi `Promise` dự phòng ngoại tuyến và nâng cấp bộ nhớ đệm từ bản A sang bản B:
   - Bài kiểm thử trong `tests/e2e/lingowild.spec.ts` dựng máy chủ tĩnh thực tế phục vụ bản A (`v3-upgrade-a`), xác nhận trình phục vụ kích hoạt, sau đó đổi mã nguồn trình phục vụ sang bản B (`v3-upgrade-b`), gọi `reg.update()` và xác nhận kho đệm bản A bị xóa sạch chỉ còn kho đệm bản B.
   - Ngay sau đó bài kiểm thử ngắt mạng và điều hướng tới đường dẫn chưa từng lưu đệm `/unlisted-offline-route`, xác nhận hàm bất đồng bộ `matchOfflineDocumentFallback` chờ `cache.match(req)` trả `undefined` rồi phân giải chính xác về `./index.html` thay vì dừng ở đối tượng `Promise` rỗng.
2. Di trú bản lưu cũ và bảo vệ dữ liệu đa thẻ trình duyệt:
   - `tests/unit/save-and-learning.test.ts` nạp một bản lưu phiên bản `1` có nhân vật đứng ngay tại ô `(8, 14)` nay đã đặt đài phun nước đá ở `Mosslight Camp`; hệ thống nâng lên phiên bản `2`, giữ nguyên toàn bộ đội hình, túi đồ, từ vựng và tự động dời nhân vật sang ô đi bộ an toàn kế cận.
   - Kiểm chứng tình huống thẻ thứ hai ghi bản lưu có dấu thời gian mới hơn vào `localStorage`: thẻ thứ nhất phát hiện xung đột qua `hasMultiTabConflict`, không ghi đè làm mất tiến trình mới và cho phép đồng bộ qua `syncFromNewerStorage`. Khi giả lập lỗi `QuotaExceededError`, bản sao lưu dự phòng không bị xóa mất.
3. Bộ lập lịch gặp lại từ phân biệt điều kiện đủ hạn với điểm ưu tiên:
   - Kiểm thử đơn vị xác nhận từ vừa mới tra cứu dù có điểm ưu tiên cao vẫn trả `isWordDueForReencounter === false` cho đến khi người chơi bước qua đủ ngưỡng thời gian chờ tối thiểu; khi nhiều từ cùng đến hạn thì xếp hạng theo điểm ưu tiên; từ đã thành thạo bậc `3` có khoảng cách chờ dài nhất (`110` bước) nên không chiếm chỗ của từ mới lưu.

## 5. Các lỗi thực tế phát hiện và sửa chữa khi rà soát hình ảnh và chạy thử

1. Lỗi tọa độ cắt ô vách đá và ván cầu đầm lầy trong `scripts/generate-assets.ts`: Khi mở kiểm tra trực tiếp `docs/screenshots/12-reedwater-fen.png` và `docs/screenshots/13-terracotta-ridge.png`, nhóm phát hiện ô vách đá cắt nhầm vùng trong suốt khiến vách núi hiện nền tối, còn ô đường đầm lầy cắt nhầm chân đá thay vì gỗ. Đã thay bằng ô vách đá sa thạch phân tầng có gờ cát nắng và ô ván gỗ đóng đinh kín khung từ bộ Sharm CC-BY, đồng thời bổ sung ô đá lát phủ rêu cho `Whisperwood Glen` và chụp lại xác nhận.
2. Lỗi vị trí hiển thị bạn đồng hành sau khi cả đội kiệt sức về trại (`src/game/controller.ts`, `src/scenes/WorldScene.ts`): Khi hồi sức khẩn cấp từ vùng khác về `Mosslight Camp`, biến `followerPos` còn giữ tọa độ vùng cũ trong bước đầu tiên. Đã đặt lại `followerPos` ngay sau lưng điểm hồi sinh và giới hạn khoảng cách hiển thị tối đa hai ô.
3. Lỗi giữ nguyên thẻ phụ của trận trước khi bước vào trận mới (`src/ui/gameUi.ts`): Sau khi mở thẻ rút lui ở trận hoang dã, bước vào trận thủ lĩnh kế tiếp vẫn mở sẵn thẻ rút lui thay vì thẻ chiêu thức. Đã bổ sung kiểm tra chuyển trạng thái vào trận để luôn mở mặc định thẻ `Moves`.

## 6. Đánh giá trải nghiệm chơi thử thực tế và giới hạn trung thực

Giới hạn công bố trung thực: Toàn bộ đánh giá dưới đây dựa trên các lượt tự chơi kiểm chứng của nhóm phát triển, video ghi hình thực tế và các kịch bản tự động thao tác thật 100% trên trình duyệt, chưa có đợt khảo sát độc lập với người học tiếng Anh bên ngoài. Chất lượng giọng đọc Web Speech API phụ thuộc vào gói giọng nói cài sẵn của từng hệ điều hành.

1. Khả năng định hướng 5 phút đầu và sức hút 15 phút đầu: Ngôi làng `Mosslight Camp` có kiến trúc rõ ràng dẫn lối tự nhiên từ quảng trường đài phun nước qua biển chỉ đường sang tán rừng `Whisperwood Glen`; bạn đồng hành bước theo sau ngay từ phút đầu tạo gắn kết trực quan rõ rệt.
2. Động lực sưu tập và chiều sâu hậu cốt truyện: Bóng dáng bí ẩn kèm gợi ý vùng sống và buổi xuất hiện trong Sổ Bách Khoa, 4 dấu vết sinh cảnh phát sáng, biến thể ánh kim tự nhiên, truyện ngắn thực địa của từng loài và 4 trận tái đấu bậc thầy cấp `24-30` giữ nhịp khám phá sau khi hoàn tất cốt truyện chính.
3. Tiếp thu tiếng Anh tự nhiên không cưỡng ép: Độ phủ chạm tra từ đạt `90,5%` trên toàn bộ hội thoại nhờ kết hợp 367 mục từ lõi và từ điển gốc từ bỏ túi ngoại tuyến; câu ví dụ trong phiếu từ độc lập với câu thoại đang đọc; cả 4 lượt phá đảo tự nhiên đều hoàn thành cốt truyện mà không cần mở bất kỳ bài ôn tập nào.
4. Trải nghiệm di động: Nhấn giữ cụm phím chữ thập giúp đi xuyên bản đồ thoải mái không mỏi ngón tay gõ lẻ từng nhịp, thanh mục tiêu hai dòng hiển thị trọn vẹn ở cả chiều dọc lẫn chiều ngang.

## 7. Danh mục 17 ảnh chụp màn hình và video gameplay thực tế

Video ghi hình thực tế dài `151` giây (`30,1 MB`, độ phân giải `960x540` khung tỷ lệ `16:9` xuất trực tiếp từ phiên chơi Chromium thật):

- `docs/videos/lingowild-gameplay.webm`: Quay liên tục từ màn hình mở đầu, chọn `Mosskit`, chạm tra từ lõi và từ bỏ túi, dạo quanh làng `Mosslight Camp` cùng bạn đồng hành đi theo sau, mua vật phẩm tại quầy chợ, đọc điểm ngắm cảnh có lồng ghép lại từ vừa lưu, vào `Whisperwood Glen` khảo sát dấu vết sinh cảnh, đánh trận và thu phục sinh vật hoang dã trên sân đấu rừng, xem thử lửa trại và duyệt qua các thẻ của Sổ Thực Địa.

Bộ 17 ảnh chụp thực tế trong `docs/screenshots/` đã được kiểm tra trực quan từng tấm:

- `docs/screenshots/01-title-screen.png`: Màn hình mở đầu kèm thẻ xem trước 3 sinh vật khởi đầu và tùy chọn chế độ hỗ trợ tiếng Anh.
- `docs/screenshots/02-contextual-gloss.png`: Hội thoại với Trưởng đoàn Rowan kèm phiếu giải nghĩa từ theo ngữ cảnh, câu ví dụ độc lập và nút nghe phát âm.
- `docs/screenshots/03-mosslight-camp.png`: Làng kiểm lâm Trại Đèn Rêu với nhà gỗ lớn, quầy chợ mái kẻ, đài phun nước đá, hàng rào gỗ và `Mosskit` đi theo sau nhân vật.
- `docs/screenshots/04-whisperwood-overworld.png`: Thung Lũng Rừng Thầm với nhiều tầng tán cây, vệt nắng xiên, thân cây đổ rỗng và nền đá lát phủ rêu.
- `docs/screenshots/05-wild-battle.png`: Sân đấu rừng pixel kèm thanh dự báo tốc độ đầu lượt, tỷ lệ chuông cộng hưởng trực tiếp (`~31%`) và thẻ chiêu thức.
- `docs/screenshots/06-field-journal-map.png`: Thẻ Bản đồ 5 vùng sinh thái kèm trạng thái dấu vết sinh cảnh trong Sổ Thực Địa.
- `docs/screenshots/07-field-journal-compendium.png`: Thẻ Bách khoa 30 loài hiển thị loài đã kết bạn kèm nút đọc truyện thực địa và bóng dáng bí ẩn kèm gợi ý vùng sống cho loài chưa gặp.
- `docs/screenshots/08-campfire-review.png`: Cửa sổ ôn từ tự nguyện bên Đài Lửa Ánh Sao với nhãn báo từ đến hạn gặp lại.
- `docs/screenshots/09-mobile-portrait.png`: Giao diện điện thoại chiều dọc (`412x915`) hiển thị trọn vẹn mục tiêu hai dòng, bạn đồng hành đi theo sau và cụm phím chữ thập.
- `docs/screenshots/10-mobile-landscape.png`: Giao diện điện thoại chiều ngang (`915x412`) giữ nguyên tỷ lệ điểm ảnh sắc nét khi đang nhấn giữ di chuyển.
- `docs/screenshots/11-starfall-ending.png`: Màn hình hoàn tất cốt truyện tại Thánh Địa Sao Rơi và mở khóa mục tiêu hậu cốt truyện.
- `docs/screenshots/12-reedwater-fen.png`: Đầm Sậy Nước Trong với hệ thống đường ván gỗ, cầu nối đảo sen, thuyền neo và dải sương mờ.
- `docs/screenshots/13-terracotta-ridge.png`: Đèo Đất Nung với vách đá đỏ phân tầng có gờ cát nắng, tảng đá thực địa và đài cộng hưởng.
- `docs/screenshots/14-field-journal-lexicon.png`: Sổ Từ Vựng tách rõ 4 bộ lọc trạng thái (`Encountered`, `Saved`, `Mastered`, `Due Now`).
- `docs/screenshots/15-terracotta-boss-battle.png`: Trận đấu Thủ lĩnh Kaelen trên sân đấu hẻm núi hoàng hôn với `Lotusbell` và nhãn khắc chế `1.5x Effective`.
- `docs/screenshots/16-starfall-sanctuary.png`: Toàn cảnh Thánh Địa Sao Rơi ban đêm với nền đá đen cổ ngữ, 4 tượng hộ vệ, cổng vòm `4x4`, dấu chân linh lộc phát sáng và Bệ Tinh Tú.
- `docs/screenshots/17-starfall-final-trial.png`: Bài khảo nghiệm cuối cùng với Trưởng lão Astraea trên sân đấu đài quan sát sao đêm.
