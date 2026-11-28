# Báo cáo kiểm thử, độ phủ và đo chuyển động LingoWild (v1.3.0)

## 1. Môi trường kiểm thử

- Hệ điều hành máy cục bộ: Windows x64 (`win32`), đối chiếu song song trên máy chủ Ubuntu (`ubuntu-latest`) của GitHub Actions và kiểm chứng trực tiếp trên trang production GitHub Pages.
- Môi trường thực thi: Node.js `v24.14.0`, npm `11.9.0`.
- Công cụ đóng gói, kiểm tra kiểu và bảo mật: Vite `8.4.0`, TypeScript `5.8.3` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`), `npm audit`.
- Khung kiểm thử đơn vị, tích hợp và đo độ phủ: Vitest `5.1.2` kèm `@vitest/coverage-v8@5.1.2`.
- Khung kiểm thử trình duyệt đầu cuối và ghi hình: Playwright `1.65.1` trên Chromium với cấu hình máy tính để bàn (`1280x720`) và điện thoại Pixel 7 ở cả chiều dọc (`412x915`) lẫn chiều ngang (`915x412`).

## 2. Đo thực tế chuyển động trước và sau nâng cấp

Phương pháp đo: chạy trực tiếp bản đóng gói thực tế trên Chromium `1280x720`, lấy mẫu theo `requestAnimationFrame` tọa độ ô lưới, tọa độ hiển thị nội suy và đếm số lần xóa/dựng lại nút con trực tiếp của `#ui-overlay` qua `MutationObserver`.

| Hạng mục đo | Baseline v1.2.0 (commit `234509a`) | Bản v1.3.0 (`test-results/v130-movement-benchmark.json`) | Nhận xét thực tế |
| --- | --- | --- | --- |
| Giữ phím bàn phím `ArrowLeft` liên tục | Di chuyển `1` ô trong `1200 ms` | Di chuyển liên tục `30` ô suốt chuỗi đi bộ, đảo chiều và chạy | Đã loại bỏ hoàn toàn sự phụ thuộc vào sự kiện lặp phím hệ điều hành |
| Nhịp bước đi bộ (`165 ms` mục tiêu) | Không hỗ trợ giữ bàn phím liên tục; giữ cảm ứng `136,9 ms` (`118` đến `150 ms`) với tween `92 ms` gây dừng khựng `~45 ms` mỗi ô | Trung bình `164,9 ms/ô` (`min 149 ms`, `max 168 ms` trên 18 bước liên tiếp) | Khớp chính xác mốc `165 ms`, không còn khoảng dừng giữa các ô |
| Nhịp bước chạy khi giữ `Shift` (`110 ms` mục tiêu) | Chưa có chế độ chạy | Trung bình `110,1 ms/ô` (`min 97 ms`, `max 120 ms` trên 10 bước liên tiếp) | Nhanh hơn rõ rệt so với đi bộ và giữ nguyên tần suất gặp sinh vật theo số ô |
| Số lần xóa gốc DOM `#ui-overlay` khi di chuyển | `36` lần trong 9 bước | `0` lần trong 30 bước | Cập nhật tăng dần HUD và đệm địa hình bản đồ nhỏ loại bỏ hoàn toàn DOM thrashing |
| Số khung hình nội suy vị trí mượt | Tween liên tục bị hủy và khởi tạo lại | `261` khung hình nội suy liên tục | Chuyển động nhân vật, bóng, đồng hành và camera trơn tru |
| Đồng bộ tốc độ khung hình `30 / 60 / 120 Hz` | Không kiểm định | Kiểm chứng bằng `tests/unit/movement-and-click.test.ts` (đạt cùng quãng đường trong 1 giây, sai lệch tối đa 1 ô, biên độ dừng đúng ô nguyên và giới hạn delta `50 ms`) | Không tăng tốc đột biến sau khi trình duyệt bị treo hoặc đổi tab |

## 3. Kết quả tổng hợp các cổng kiểm định (v1.3.0)

| Hạng mục kiểm định | Lệnh thực thi | Kết quả thực tế |
| --- | --- | --- |
| Kiểm tra lỗ hổng phụ thuộc | `npm audit --audit-level=low` | Đạt: `0` lỗ hổng bảo mật trên toàn bộ cây phụ thuộc |
| Kiểm định danh mục HSK 2.0 và chính tả Pinyin | `node --experimental-strip-types scripts/verify-hsk-data.ts` | Đạt: `150` HSK 1, `150` HSK 2, `298 + 2` đa âm HSK 3 (đủ `600` mục HSK 1-3), `73` bổ trợ HSK 4, `314` từ ngữ cảnh không gán HSK (`985` tổng), `55` tên riêng tách biệt, 0 lỗi thanh điệu Pinyin |
| Kiểm định toàn vẹn dữ liệu và đường đi | `npm run validate:data` | Đạt: 30 loài, 42 chiêu, 13 vật phẩm, 5 bản đồ `32x24` liên thông, 16 NPC, 12 nhiệm vụ, 367 từ lõi tiếng Anh (độ phủ tra từ `90,5%`), `985` từ điển tiếng Trung (`640` từ riêng biệt xuất hiện trong thoại/mô tả: `HSK1 95`, `HSK2 87`, `HSK3 124`, bổ trợ `HSK4 45`, ngữ cảnh `289`), 192 đoạn thoại đầy đủ Anh/Trung/Việt (`98` đoạn có biến thể HSK, độ phủ tra từ tiếng Trung `84,7%`) |
| Kiểm tra quy tắc mã nguồn và tài liệu | `npm run lint` | Đạt: `0` lỗi văn phong trên toàn bộ tệp Markdown và tệp TypeScript, `0` tệp trùng lặp, `0` khóa bí mật hay điểm cuối theo dõi |
| Kiểm tra kiểu tĩnh nghiêm ngặt | `npm run typecheck` | Đạt: `0` lỗi trên toàn bộ `src/`, `scripts/`, `tests/` |
| Kiểm thử đơn vị và tích hợp kèm độ phủ V8 | `npm run test:coverage` | Đạt: `9/9` tệp (`50/50` bài kiểm thử), gồm 8 bài kiểm thử di chuyển mượt & tự tìm đường, 5 bài kiểm thử bộ xử lý tiếng Trung & di trú `v1.2.0`, 1 hành trình chơi trọn vẹn bằng tiếng Trung và 6 lượt phá đảo tự nhiên cho cả 3 sinh vật khởi đầu |
| Đóng gói sản phẩm và băm bộ nhớ đệm | `npm run build` | Đạt: `index.html` (`0,49 kB` gzip), `index.css` (`4,67 kB` gzip), gói ứng dụng (`323,69 kB` gzip, gồm toàn bộ dữ liệu tiếng Trung ngoại tuyến), gói Phaser (`318,37 kB` gzip), sao chép `LICENSE.txt` và `CREDITS.md` vào `dist/` và chèn 16 đường dẫn sắp xếp xác định vào `dist/sw.js` |
| Kiểm thử trình duyệt đầu cuối máy tính và di động | `npm run test:e2e` | Đạt: `17/17` bài kiểm thử hoạt động (`11` bài chỉ chạy trên máy tính được bỏ qua trên di động) trên Chromium máy tính (`1280x720`) và điện thoại Pixel 7 dọc ngang (`412x915`, `915x412`), bao gồm toàn bộ 4 nhóm kiểm thử mới của `v1.3.0`, bộ kiểm thử người mới `v1.2.0`, nâng cấp service worker và phá đảo cốt truyện |

## 4. Báo cáo độ phủ mã nguồn theo đúng phạm vi được đo

Cấu hình `vitest.config.ts` đo độ phủ V8 trực tiếp trên `src/domain/**/*.ts` và `src/game/**/*.ts` (loại trừ tệp định nghĩa kiểu thuần `src/domain/types.ts`). Các tầng giao diện DOM (`src/ui/`), cảnh dựng hình Phaser (`src/scenes/`), âm thanh (`src/audio/`) và bảng dữ liệu tĩnh (`src/data/`) được kiểm chứng bởi `npm run validate:data`, `scripts/verify-hsk-data.ts` và bộ kiểm thử trình duyệt Playwright đầu cuối.

Số liệu thực tế trên phạm vi được đo (`src/domain/` và `src/game/`):

- Tổng phạm vi được đo: `77,51%` câu lệnh, `79,54%` dòng mã, `71,27%` nhánh điều kiện, `65,33%` hàm (tăng so với `76,44%` câu lệnh và `78,91%` dòng mã ở `v1.2.0`).
- Tầng nghiệp vụ lõi (`src/domain/`: `80,21%` câu lệnh, `82,80%` dòng mã):
  - `src/domain/capture.ts`, `src/domain/difficulty.ts`, `src/domain/elements.ts`: `100%` câu lệnh, nhánh, hàm, dòng mã.
  - `src/domain/creatures.ts`: `93,54%` câu lệnh, `97,39%` dòng mã, `100%` hàm.
  - `src/domain/battle.ts`: `92,23%` câu lệnh, `93,72%` dòng mã, `100%` hàm.
  - `src/domain/quests.ts`: `93,18%` câu lệnh, `93,18%` dòng mã, `100%` hàm.
  - `src/domain/chinese.ts` (mới): `91,90%` câu lệnh, `92,80%` dòng mã, `97,22%` hàm.
  - `src/domain/learning.ts`: `88,47%` câu lệnh, `90,97%` dòng mã.
  - `src/domain/state.ts`: `86,31%` câu lệnh, `89,88%` dòng mã.
  - `src/domain/navigation.ts`: `86,41%` câu lệnh, `86,63%` dòng mã, `94,44%` hàm.
  - `src/domain/battleAssist.ts`: `86,00%` câu lệnh, `86,61%` dòng mã, `100%` hàm.
  - `src/domain/save.ts`: `74,21%` câu lệnh, `83,85%` dòng mã, `94,73%` hàm.
  - `src/domain/world.ts`: `80,88%` câu lệnh, `82,92%` dòng mã, `93,75%` hàm.
  - `src/domain/rng.ts`: `71,42%` câu lệnh, `73,91%` dòng mã, `100%` hàm.
  - `src/domain/onboarding.ts`: `70,73%` câu lệnh, `70,88%` dòng mã, `80,00%` hàm.
  - `src/domain/i18n.ts`: `13,36%` câu lệnh trong Vitest vì chứa nhãn định dạng dành riêng cho giao diện DOM (được kiểm toán trực tiếp trên trình duyệt thật qua Playwright).
- Tầng điều phối trò chơi (`src/game/`: `71,58%` câu lệnh, `72,75%` dòng mã):
  - `src/game/movement.ts` (mới): `78,75%` câu lệnh, `78,85%` dòng mã, `93,10%` hàm.
  - `src/game/controller.ts`: `68,87%` câu lệnh, `70,34%` dòng mã, `68,80%` hàm.

## 5. Các lỗi thật phát hiện và khắc phục trong vòng phát triển v1.3.0

1. Lỗi lệch công thức đặt `cam.scrollX` / `cam.scrollY` khi phóng to trong `src/scenes/WorldScene.ts`: Khi thay thế `startFollow` bằng làm mượt camera thủ công, phép trừ ban đầu dùng `halfW` (`displayWidth / 2`) thay vì `cam.width * 0.5` theo hệ tọa độ tâm của Phaser 3, khiến camera bị ép lệch về biên phải và biên dưới bản đồ (che 3 cột bên trái khi nhấn vào cổng tây `(0, 12)` và đẩy mục tiêu lên dưới thanh HUD trên di động ngang). Đã sửa về `camCenterX - cam.width * 0.5` và `camCenterY - cam.height * 0.5`, vượt qua hoàn hảo cả bài kiểm thử cổng tây máy tính lẫn chạm bản đồ xoay ngang Pixel 7.
2. Lỗi kiểm định dữ liệu tiếng Trung (`scripts/verify-hsk-data.ts`): Phát hiện và sửa ngay 3 câu ví dụ thiếu từ đầu mục (`生病`, `疼`, `洗澡`), 12 dòng thiếu cột cấp độ trong `zh-lexicon-extra.ts`, 9 từ bị gắn nhầm nhãn `HSK4` sang không gán nhãn HSK, 5 mục trùng lặp và bổ sung cụm chào hỏi thông dụng (`你好`, `您好`, `早上好`, `晚上好`) cùng nhóm từ thiên nhiên đời thường để nâng độ phủ chạm tra từ tiếng Trung từ `70,5%` lên `84,7%`.
3. Xung đột giữa bộ kiểm thử chạm bước đơn `v1.2.0` và cơ chế nội suy bước `165 ms`: Cập nhật trợ giúp chờ hoàn tất bước (`waitUntilTileSettled`) trong `tests/e2e/beginner-experience.spec.ts` và `tests/e2e/lingowild.spec.ts` để phản ánh đúng nhịp đi mượt thực tế mà không bỏ qua bất kỳ bước kiểm tra nào.

## 6. Danh mục video gameplay và ảnh chụp màn hình mới của v1.3.0

4 video quay trực tiếp bằng Playwright trên bản đóng gói chính thức (`960x540`, định dạng WebM):
- `docs/videos/v130-click-to-move.webm` (`19,5` giây, `4,7 MB`): Tự tìm đường quanh vật cản, từ chối ô nước, tương tác biển chỉ đường, gặp Trinh sát Mai và qua cổng tây sang Thung Lũng Rừng Thầm.
- `docs/videos/v130-smooth-movement.webm` (`13,1` giây, `3,1 MB`): Giữ phím đi bộ liên tục, đổi hướng tức thì không khựng, giữ `Shift` chạy mượt và dừng đúng ô khi thả phím.
- `docs/videos/v130-chinese-hsk2.webm` (`17,2` giây, `3,3 MB`): Hội thoại `HSK 2`, bật tắt Pinyin, phiếu tra nghĩa 10 trường `欢迎`, thẻ tên riêng `苔灯营地`, nghe phát âm, lưu sổ từ và ôn tập tiếng Trung bên lửa trại.
- `docs/videos/v130-language-switch.webm` (`17,8` giây, `3,6 MB`): Chuyển đổi trực tiếp giữa tiếng Trung và tiếng Anh trong Cài đặt mà không mất đội hình, huy hiệu hay dữ liệu của cả hai sổ từ vựng.

4 ảnh chụp màn hình mới bổ sung vào bộ 27 ảnh trong `docs/screenshots/`:
- `24-v130-click-to-move-path.png`: Đường tự tìm đường màu xanh lam cùng vòng đích tách biệt với đường dẫn nhiệm vụ màu vàng.
- `25-v130-chinese-hsk2-dialogue.png`: Hộp thoại tiếng Trung `HSK 2` với Pinyin căn chỉnh gọn phía trên chữ Hán, nghĩa tiếng Việt và nút bật tắt nhanh.
- `26-v130-chinese-gloss-popup.png`: Phiếu tra nghĩa tiếng Trung đầy đủ ngữ cảnh cho từ `欢迎` (`HSK2`).
- `27-v130-multilingual-settings.png`: Màn hình Cài đặt đa ngôn ngữ, vị trí Pinyin, tự tìm đường và tốc độ di chuyển.
