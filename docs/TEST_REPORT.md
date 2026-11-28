# Báo cáo kiểm thử, độ phủ và đánh giá trải nghiệm LingoWild

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
| Kiểm tra quy tắc mã nguồn và tài liệu | `npm run lint` | Đạt: 0 lỗi văn phong trên 9 tệp Markdown và 56 tệp TypeScript, 0 tệp trùng lặp, 0 khóa bí mật hay điểm cuối theo dõi |
| Kiểm tra kiểu tĩnh nghiêm ngặt | `npm run typecheck` | Đạt: 0 lỗi trên toàn bộ mã nguồn, kịch bản và kiểm thử |
| Kiểm thử đơn vị, tích hợp và phá đảo 3 starter | `npm run test:coverage` | Đạt: `6/6` tệp (`35/35` bài kiểm thử), gồm 3 lượt phá đảo tự nhiên độ khó Phiêu lưu cho cả `Mosskit`, `Kindlet`, `Ripplefin` và 9 bài kiểm thử trải nghiệm người mới |
| Đóng gói sản phẩm và băm bộ nhớ đệm | `npm run build` | Đạt: `index.html` (`0,48 kB` gzip), `index.css` (`4,19 kB` gzip), gói ứng dụng và dữ liệu (`177,61 kB` gzip), gói Phaser tách riêng (`318,37 kB` gzip), chèn 14 đường dẫn sắp xếp xác định vào `dist/sw.js` |
| Kiểm thử trình duyệt đầu cuối máy tính và di động | `npm run test:e2e` | Đạt: `11/11` bài kiểm thử hoạt động (7 bài chỉ chạy trên desktop được bỏ qua trên mobile), vượt qua trọn vẹn kịch bản người mới A1, kiểm toán tiếng Việt không lọt chữ, đổi ngôn ngữ và độ khó giữa trận, bỏ qua hướng dẫn, phá đảo từ đầu tới kết thúc, mobile dọc ngang và nâng cấp SW A sang B |

## 3. Báo cáo độ phủ mã nguồn theo đúng phạm vi được đo

Cấu hình `vitest.config.ts` đo độ phủ V8 trực tiếp trên `src/domain/**/*.ts` và `src/game/**/*.ts` (loại trừ tệp định nghĩa kiểu thuần `src/domain/types.ts`). Các tầng giao diện DOM (`src/ui/`), cảnh dựng hình Phaser (`src/scenes/`), âm thanh Web Audio (`src/audio/`) và bảng dữ liệu tĩnh (`src/data/`) không thuộc phép đo V8 này mà được kiểm chứng bằng `npm run validate:data` và bộ kiểm thử trình duyệt Playwright đầu cuối.

Số liệu thực tế trên phạm vi được đo (`src/domain/` và `src/game/controller.ts`):

- Tổng phạm vi được đo: `77,66%` câu lệnh, `80,38%` dòng mã, `72,50%` nhánh điều kiện, `59,79%` hàm.
- Ghi chú trung thực về `src/domain/i18n.ts`: Tệp danh mục bản địa hóa chứa nhiều hàm định dạng chuỗi ngắn dành cho giao diện DOM nên chỉ chạy một phần nhỏ trong Vitest (`17,48%` câu lệnh, `4,16%` hàm), trong khi toàn bộ nhãn giao diện thực tế đều được chạy và kiểm toán trực tiếp trên trình duyệt thật qua `tests/e2e/beginner-experience.spec.ts`.
- Độ phủ chi tiết các mô-đun nghiệp vụ lõi trong `src/domain/` (tổng tầng `src/domain/`: `80,59%` câu lệnh, `83,96%` dòng mã):
  - `src/domain/capture.ts`: `100%` câu lệnh, `100%` nhánh, `100%` hàm, `100%` dòng mã.
  - `src/domain/difficulty.ts`: `100%` câu lệnh, `100%` nhánh, `100%` hàm, `100%` dòng mã.
  - `src/domain/elements.ts`: `100%` câu lệnh, `100%` nhánh, `100%` hàm, `100%` dòng mã.
  - `src/domain/creatures.ts`: `93,54%` câu lệnh, `97,39%` dòng mã, `100%` hàm (gồm đổi chiêu `replaceCreatureMoveSlot` và liệt kê chiêu mở khóa `getUnlockedSpeciesMoves`).
  - `src/domain/battle.ts`: `91,80%` câu lệnh, `93,35%` dòng mã, `84,21%` nhánh, `100%` hàm.
  - `src/domain/quests.ts`: `93,18%` câu lệnh, `93,18%` dòng mã, `100%` hàm.
  - `src/domain/learning.ts`: `88,47%` câu lệnh, `90,97%` dòng mã.
  - `src/domain/navigation.ts`: `88,79%` câu lệnh, `90,28%` dòng mã, `93,33%` hàm (bao phủ tìm đường BFS tránh vật cản, nối nhiều vùng, chặn cổng khóa và bảng Tôi bị lạc).
  - `src/domain/state.ts`: `86,31%` câu lệnh, `89,88%` dòng mã.
  - `src/domain/battleAssist.ts`: `86,53%` câu lệnh, `87,62%` dòng mã, `100%` hàm.
  - `src/domain/save.ts`: `74,00%` câu lệnh, `84,66%` dòng mã, `94,44%` hàm (bao phủ di trú bản lưu v1 và v2 sang định dạng mới, đa thẻ và lỗi đầy bộ nhớ).
  - `src/domain/onboarding.ts`: `81,42%` câu lệnh, `82,08%` dòng mã, `88,88%` hàm.
  - `src/domain/world.ts`: `80,14%` câu lệnh, `82,11%` dòng mã, `93,75%` hàm.
  - `src/domain/rng.ts`: `71,42%` câu lệnh, `73,91%` dòng mã, `100%` hàm.
- Bộ điều phối trò chơi (`src/game/controller.ts`): `68,59%` câu lệnh, `69,84%` dòng mã, `64,44%` hàm, `64,25%` nhánh điều kiện.

## 4. Kết quả kiểm thử chuyên sâu cho trải nghiệm người mới

1. Kiểm thử đơn vị và tích hợp (`tests/unit/beginner-experience.test.ts` - 9/9 đạt):
   - Bản địa hóa và tách chế độ ngôn ngữ: Khóa dữ liệu `UI_STRINGS.vi` và `UI_STRINGS.en` khớp đối xứng 100%, dịch đúng toàn bộ danh xưng nhân vật (`Kiểm lâm Rowan`, `Thủ lĩnh Sylvan`), biển chỉ đường và từ loại.
   - Ba chế độ độ khó cân bằng: Xác minh máu tối đa đối thủ giữ nguyên ở cả ba chế độ (không bơm máu vô nghĩa), sát thương địch tăng dần đúng tỷ lệ (`relaxed` < `adventure` <= `challenge`), tỷ lệ thu phục giảm dần (`relaxed` > `adventure` > `challenge`), chế độ Thư giãn tự hồi nhẹ sau trận và đổi độ khó giữa phiên không ảnh hưởng từ vựng hay tiến trình.
   - Tìm đường BFS và mục tiêu nhiệm vụ: Xác minh mọi ô trên đường BFS đều đi bộ hợp lệ không xuyên tường hay nước, nối cổng mở giữa các vùng, chặn hoàn toàn cổng khóa khi chưa hạ Thủ lĩnh Sylvan và báo rõ điều kiện mở khóa, đủ tọa độ mục tiêu thật cho cả 12/12 nhiệm vụ, không lộ rương bí mật và hiển thị đúng dấu `!` hoặc `?` trên nhân vật.
   - Hướng dẫn 10 bước, bắt chắc chắn 100%, Trợ giúp chiến đấu, đổi chiêu và di trú bản lưu cũ: Xác minh bắt thành công 100% ở lần hướng dẫn đầu tiên, bỏ qua bước tra từ tùy chọn không chặn tiến trình, bỏ qua toàn bộ hướng dẫn giữ nguyên toàn bộ vật phẩm và huy hiệu, Trợ giúp chiến đấu gợi ý đổi đồng đội khắc hệ và báo máu thấp, cảnh báo sẵn sàng trước Thủ lĩnh, đổi chiêu trong đội hình, thua trận không trừ huy hiệu và di trú sạch bản lưu cũ phiên bản 2.
2. Kiểm thử trình duyệt đầu cuối (`tests/e2e/beginner-experience.spec.ts` - 4/4 bài hoạt động đạt trên Desktop và Mobile):
   - Mô phỏng người mới trình độ tiếng Anh A1 hoàn thành hành trình mở đầu chỉ bằng thông tin trên màn hình (không chỉnh trạng thái ngầm): Bắt đầu với cấu hình mặc định tiếng Việt + song ngữ + Thư giãn, chọn `Mosskit`, đi theo đường sáng và nút gợi ý tương tác gặp Trinh sát Mai, theo cổng Tây sang Rừng Thầm, đánh theo nhãn `Khuyên dùng` của Trợ giúp chiến đấu, thấy ước lượng `100%` và bắt thành công ngay lượt ném Chuông Rêu đầu tiên, hồi phục bên lửa trại, bấm bỏ qua bước tra từ tùy chọn, mở Sổ Thực Địa xem chi tiết nhiệm vụ có cấu trúc, bấm `Dẫn đường` đổi mục tiêu theo dõi, mở bảng `Quản lý chiêu` trong Đội hình và mở cửa sổ `Tôi bị lạc`.
   - Kiểm toán không lọt nhãn giao diện tiếng Anh: Duyệt toàn bộ màn hình mở đầu, thanh HUD, hộp thoại và cả 7 thẻ Sổ Thực Địa ở chế độ giao diện `vi` kết hợp nội dung `vi_only`, xác nhận 0 nhãn tiếng Anh bị lọt (`Field Journal`, `Basin Map`, `New Expedition`, `Observe & Flee`, `Ranger Rowan`, `Warden Sylvan` đều bằng 0).
   - Chuyển đổi trực tiếp giữa phiên chơi: Đổi liên tục `vi`/`en`, cả 4 chế độ nội dung, cả 3 độ khó và cả 3 mức dẫn đường (`Đầy đủ` hiện cả mũi tên và bản đồ nhỏ, `Tối giản` chỉ hiện mũi tên, `Tắt` ẩn cả hai) mà không mất sinh vật hay tiến trình.
   - Bỏ qua hướng dẫn và di động: Kiểm tra bỏ qua hướng dẫn từ màn hình mở đầu vẫn giữ trọn 9 Chuông Rêu (6 ban đầu + 3 thưởng nhiệm vụ 1), 4 Sương Thảo Dược, 2 Lá Thanh Tâm và 230 Huy hiệu trên cả máy tính lẫn điện thoại.

## 5. Số liệu hiệu năng và các lỗi thật phát hiện trong quá trình kiểm thử

Số liệu đo tự động trên bản đóng gói chính thức (`test-results/benchmark-metrics.json`):
- Thời gian tải trang hoàn tất điều hướng: `336 ms`.
- Thời gian khởi tạo ứng dụng và gắn kết khung vẽ Phaser: `8 ms`.
- Tốc độ khung hình ghi nhận trên Chromium không giao diện: `60 FPS`.
- Số lỗi bảng điều khiển (`console.error`, `pageerror`) và yêu cầu tài nguyên thất bại: `0` lỗi.

Các lỗi thực tế được phát hiện nhờ chính bộ kiểm thử mới và kiểm tra trực quan ảnh chụp, đã sửa dứt điểm trước khi bàn giao:
1. Hai mã vật thể dẫn đường bị lệch tên trong `src/domain/navigation.ts` (`fen_lantern_post` thay vì `fen_beacon_post` ở Đầm Sậy và `ridge_kiln_tablet` thay vì `ridge_kiln_ruin` ở Đèo Đất Nung): Được phát hiện ngay khi viết unit test kiểm tra mục tiêu dẫn đường của đủ 12 nhiệm vụ và đã sửa đồng bộ với `src/data/maps.ts`.
2. Lọt tên tiếng Anh `Warden Sylvan` trong trường `Cần tìm:` của thẻ nhiệm vụ tiếng Việt: Được phát hiện khi soi trực tiếp ảnh chụp Sổ Thực Địa và đã chuẩn hóa qua `localizeSpeakerName`.
3. Xếp chồng thanh thông báo và bản đồ nhỏ trên màn hình điện thoại dọc (`412x915`): Khi kiểm tra ảnh chụp `09-mobile-portrait.png`, thông báo chuyển vùng bị đẩy xuống dưới `25%` chiều cao màn hình và bản đồ nhỏ chạm cạnh phải thanh hướng dẫn nhập môn. Đã đảo thứ tự hiển thị thông báo lên trên và đặt bản đồ nhỏ gọn phía trên cụm nút cảm ứng góc dưới phải trên màn hình `<= 600px`, chụp lại ảnh xác nhận hoàn toàn thông thoáng.
4. Điều kiện bảo đảm thu phục đầu tiên (`src/domain/onboarding.ts`): Khi người chơi mới chỉ đánh 1 lượt đầu mà đối phương còn trên `85%` máu, điều kiện cũ yêu cầu 2 lượt nên chưa khớp gợi ý trên màn hình. Đã điều chỉnh sang `enemyHpRatio <= 0.85 || turnCount >= 1` để người mới luôn nhận 100% đúng như hướng dẫn.

## 6. Phân biệt rõ kiểm thử tự động và kiểm thử với người chơi thật

- Những gì đã được xác minh thực tế bằng kiểm thử tự động và tự chơi của nhóm phát triển: Toàn bộ tính đúng đắn kỹ thuật của tìm đường BFS, bản địa hóa tiếng Việt 100% nhãn giao diện, cân bằng toán học của 3 chế độ độ khó, 3 lượt phá đảo tự nhiên ở độ khó Phiêu lưu, lượt phá đảo toàn bộ trên trình duyệt Chromium, kịch bản mô phỏng người mới A1 đi theo đúng thông tin trên màn hình, kiểm tra trực quan đủ 22 ảnh chụp và video quay thực tế `88,6` giây.
- Những gì chưa thể thay thế bởi kiểm thử tự động (giới hạn trung thực): Chưa có đợt chơi thử độc lập với người chơi thật bên ngoài nhóm phát triển (đặc biệt là người mới lần đầu chơi game nhập vai trên điện thoại và máy tính). Nhịp đọc thoại tự nhiên, cảm nhận độ dài phần mở đầu và mức độ dễ hiểu của lời giải thích chiêu thức cần được xác nhận thêm khi chủ dự án hoặc người chơi thực tế trải nghiệm trực tiếp.

## 7. Danh mục 22 ảnh chụp màn hình và video hướng dẫn người mới

Video quay trực tiếp trên bản đóng gói chính thức (`88,6` giây, `17,3 MB`, `960x540`):
- `docs/videos/lingowild-gameplay.webm`: Quay trọn vẹn hành trình người mới tiếng Việt từ màn hình mở đầu, chọn `Mosskit`, chạm tra từ và lưu từ, theo đường sáng và bản đồ nhỏ gặp Trinh sát Mai, sang Rừng Thầm chiến đấu với Trợ giúp chiến đấu và thu phục chắc chắn 100% sinh vật đầu tiên, hồi phục tại lửa trại, mở Sổ Thực Địa xem nhiệm vụ và Quản lý chiêu, đổi ngôn ngữ trực tiếp và dùng cửa sổ Tôi bị lạc.

Bộ 22 ảnh chụp thực tế trong `docs/screenshots/`:
- `01-title-screen.png`: Màn hình mở đầu tiếng Việt kèm 4 nhóm thiết lập độc lập và tùy chọn bỏ qua hướng dẫn.
- `02-contextual-gloss.png`: Hội thoại song ngữ Kiểm lâm Rowan kèm phiếu tra nghĩa từ và nút nghe phát âm.
- `03-mosslight-camp.png`: Làng Trại Đèn Rêu với bạn đồng hành đi theo sau, mũi tên định hướng và bản đồ nhỏ.
- `04-whisperwood-overworld.png`: Thung Lũng Rừng Thầm nhiều tầng tán cây, vệt nắng và đá lát rêu.
- `05-wild-battle.png`: Trận đấu hoang dã tiếng Việt với Trợ giúp chiến đấu và tỷ lệ thu phục trực tiếp.
- `06-field-journal-map.png`, `07-field-journal-compendium.png`, `14-field-journal-lexicon.png`: Các thẻ Bản đồ, Bách khoa 30 loài và Sổ Từ Vựng 4 bộ lọc bằng tiếng Việt.
- `08-campfire-review.png`: Ôn từ tự nguyện bên Đài Lửa Ánh Sao.
- `09-mobile-portrait.png`, `10-mobile-landscape.png`, `22-mobile-beginner-hud.png`: Giao diện điện thoại dọc và ngang kèm bản đồ nhỏ, vệt sáng dẫn đường và phím cảm ứng.
- `11-starfall-ending.png`: Màn hình hoàn tất cốt truyện bằng tiếng Việt tại Thánh Địa Sao Rơi.
- `12-reedwater-fen.png`, `13-terracotta-ridge.png`, `15-terracotta-boss-battle.png`, `16-starfall-sanctuary.png`, `17-starfall-final-trial.png`: Toàn bộ 5 vùng sinh thái và các trận đấu Thủ lĩnh.
- `18-beginner-camp-guidance.png`: Trại Đèn Rêu với hướng dẫn nhập môn bước 2, vệt sáng vàng dẫn tới Trinh sát Mai, dấu `!` nhiệm vụ và bản đồ nhỏ.
- `19-beginner-battle-assist.png`: Trận chiến đầu tiên hiển thị rõ thanh Trợ giúp chiến thuật, nhãn chiêu `Khuyên dùng` và ước lượng `~100%` trên thẻ Chuông và Túi.
- `20-beginner-quests-wayfinding.png`: Thẻ Nhiệm vụ cấu trúc rõ 5 trường thông tin và nút `Dẫn đường`.
- `21-lost-helper-modal.png`: Cửa sổ `Trợ giúp định hướng` từ nút `Tôi bị lạc`.
