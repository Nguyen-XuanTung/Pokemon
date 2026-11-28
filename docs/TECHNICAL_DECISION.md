# Quyết định kỹ thuật và kiến trúc LingoWild

## 1. Bối cảnh và phương pháp kiểm chứng

Trước khi viết mã nguồn và qua từng phiên bản trên nhánh `develop/lingowild`, nhóm kỹ thuật kiểm chứng độc lập toàn bộ mã nguồn mở, nguồn ngữ liệu và gói tài nguyên nghệ thuật. Mọi quyết định đều dựa trên việc đọc trực tiếp giấy phép gốc, đo thời gian và ghi hình thực tế trên trình duyệt Chromium, chạy trình biên dịch TypeScript nghiêm ngặt và kiểm tra đầu ra trên Windows x64 (`Node.js v24.14.0`, `npm 11.9.0`) cùng máy chủ Ubuntu của GitHub Actions.

## 2. Bảng kiểm toán mã nguồn mở, dữ liệu và tài nguyên nghệ thuật

| Nguồn khảo sát | Phiên bản hoặc commit | Giấy phép | Phân tích kỹ thuật thực tế | Quyết định |
| --- | --- | --- | --- | --- |
| `devshareacademy/monster-tamer` | `a964bba7` | MIT (tài nguyên pha trộn 14 nguồn rời) | Thiếu `package.json`, không dùng TypeScript, tải Phaser qua CDN nên hỏng khi ngoại tuyến | Không chép mã hay tài nguyên; chỉ tham khảo máy trạng thái lượt đấu |
| `phaserjs/template-vite-ts` | `d1d758a` | MIT | Lệch khóa phiên bản và chứa kịch bản `log.js` gửi yêu cầu về `gryzor.co` | Không chép mẫu; tự dựng cấu hình Vite sạch |
| `Annoraaq/grid-engine` | `v2.55.1` | Apache-2.0 | Đòi `phaser@~4.2.1` và kéo theo `rxjs`, `mnemonist` nặng nề cho di chuyển lưới 4 hướng | Tự xây dựng `MovementCoordinator` thuần TypeScript gọn nhẹ, không thêm dependency |
| `pokeclicker`, `pokerogue`, `Tuxemon` | Các nhánh chính | ISC, AGPL-3.0, GPL-3.0 | Vướng tài sản trí tuệ thương mại hoặc nghĩa vụ copyleft | Không nhập mã hay tài nguyên |
| `wordfreq` và `Tatoeba` | Bản phát hành chính | CC-BY-SA 4.0 / CC-BY 2.0 FR | Kéo theo copyleft và câu ví dụ lệch ngữ cảnh thám hiểm | Tự biên soạn ngữ liệu Anh và Trung nguyên bản theo MIT |
| `sawcordwell/HSK-Vocab` | `bd786242a80ca3af65515712b70493c39d369393` | CC0 1.0 Universal | Danh mục CSV rõ ràng theo chuẩn HSK 2.0 (`HSK 1: 150`, `HSK 2: 150`, `HSK 3: 300`), không vướng bản quyền | Dùng đối chiếu danh sách đầu mục HSK 1 đến HSK 3 (truy xuất `2026-11-28`) |
| `drkameleon/complete-hsk-vocabulary` | `7ac65bf1a6387d35f1ade478906172a19311c7f9` | MIT | Cung cấp Pinyin có dấu thanh và phân cấp HSK 2.0 (tách rõ phần nghĩa gốc từ CC-CEDICT) | Chỉ dùng đối chiếu Pinyin có dấu thanh và cấp HSK 2.0; không sao chép nghĩa CC-CEDICT |
| `Kenney Roguelike/RPG Pack`, `Sharm Tiny 16`, `ArMM1998`, `@ansimuz`, `Admurin`, `Pyromantic` | Lưu tại `assets-src/` | CC0 1.0, CC-BY 3.0, CC-BY 4.0 | Đóng gói xác định thành 8 bảng ảnh pixel trong `public/assets/sprites/` | Tiếp tục sử dụng có ghi công đầy đủ trong `CREDITS.md` và gói web |

## 3. Nền tảng kiến trúc v1.1 đến v1.2.0 được bảo toàn

- Trình phục vụ ngoại tuyến `public/sw.js` dùng `async/await` tường minh cho chuỗi dự phòng điều hướng ngoại tuyến, quản lý riêng kho đệm `lingowild-cache-` và băm `SHA-256` trên toàn bộ danh sách 16 tài nguyên sắp xếp xác định trong `scripts/inject-sw-manifest.ts` (kèm `LICENSE.txt` và `CREDITS.md`).
- Hệ thống dẫn đường 3 mức (`src/domain/navigation.ts`), hướng dẫn nhập môn 10 bước (`src/domain/onboarding.ts`) và Trợ giúp chiến đấu một khuyến nghị chính mỗi lượt (`src/domain/battleAssist.ts`) được giữ nguyên vẹn và hoạt động thống nhất với mọi nâng cấp mới.
- Nghệ thuật 5 vùng sinh thái nhiều lớp kiến trúc (`structures.png`), 30 loài sinh vật 2 nhịp thở, 30 đồng hành đi theo sau, 5 sân đấu pixel (`battle-bg.png`) và bảng lệnh chiến đấu hai cột (`src/ui/battleView.ts`) được bảo toàn đầy đủ.

## 4. Các quyết định kiến trúc trọng tâm trong v1.3.0

### 4.1. Hợp nhất điều phối di chuyển mượt (`src/game/movement.ts`) và đo trước/sau

Kiểm toán thực tế bản `v1.2.0` bằng kịch bản đo trực tiếp trên trình duyệt Chromium (`1280x720`) chỉ ra ba nguyên nhân gây khựng:
1. Bàn phím chỉ xử lý sự kiện `keydown` rời rạc mà không theo dõi trạng thái phím đang giữ (`keyup`, `blur`, `visibilitychange`), khiến thao tác giữ phím lệ thuộc độ trễ lặp của hệ điều hành (khi giữ `ArrowLeft` `1200 ms` không lặp tổng hợp chỉ đi đúng `1` ô).
2. Cụm phím cảm ứng chạy một vòng hẹn giờ `135 ms` độc lập trong `gameUi.ts`, trong khi `WorldScene.ts` chạy tween `92 ms` rồi hủy tween cũ mỗi khi bước mới đến, tạo khoảng đứng yên khoảng `45 ms` giữa mỗi ô (`136,9 ms` trung bình, dao động `118` đến `150 ms`).
3. Mỗi bước đi gọi `overlayEl.replaceChildren()` xóa và dựng lại toàn bộ cây DOM giao diện cùng bản đồ nhỏ (`36` lần xóa gốc DOM chỉ trong 9 bước).

Giải pháp trong `v1.3.0`:
- Xây dựng một `MovementCoordinator` duy nhất trong `src/game/movement.ts` xử lý toàn bộ nguồn nhập: phím mũi tên, `WASD`, phím gán lại, phím cảm ứng, tự tìm đường và tốc độ đi bộ (`165 ms/ô`) hoặc chạy (`110 ms/ô`, giữ `Shift` hoặc chọn trong Cài đặt). Chặn vượt khung thời gian khi trình duyệt treo hoặc chuyển tab bằng `MAX_FRAME_DELTA_MS = 50`, dùng bộ đệm đổi hướng đúng `1` khe (không tích lũy hàng đợi vô hạn) và xóa trạng thái phím an toàn trên `keyup`, `pointerup`, `pointercancel`, `blur`, `visibilitychange`, mở menu, hộp thoại và vào trận.
- Tách tọa độ ô lưới nghiệp vụ (`state.playerPos`) khỏi tọa độ hiển thị nội suy (`visualX`, `visualY`) và giữ nguyên toàn bộ kiểm tra va chạm, RNG, tỉ lệ gặp sinh vật hoang theo số bước ô lưới (tốc độ chạy không làm sai lệch tần suất gặp theo quãng đường) và bản lưu. Đồng hành nội suy khóa nhịp theo đúng đường đi thực tế của người chơi, không xuyên tường. Chế độ giảm chuyển động (`reducedMotion`) vẫn nhảy gọn từng ô không lướt.
- Sửa chuẩn phép đặt `cam.scrollX` / `cam.scrollY` theo tâm viewport Phaser 3 (`camCenterX - cam.width * 0.5`, `camCenterY - cam.height * 0.5`) kết hợp làm mượt mũ độc lập tốc độ khung hình (`1 - Math.exp(-15 * dtSec)`) và làm tròn theo bước `1 / zoom` màn hình, loại bỏ rung giật ở biên bản đồ và đảm bảo hành vi đồng nhất tại `30`, `60` và `120 Hz`.
- Tối ưu hiển thị theo đúng điểm nghẽn đã đo: `GameUiRenderer` cập nhật tăng dần từng nút HUD khi ở bản đồ ngoài (giảm xóa gốc DOM từ `36` xuống `0`), đệm địa hình tĩnh của bản đồ nhỏ vào canvas riêng theo từng vùng, và `WorldScene` tách chữ ký cập nhật vệt dẫn đường nhiệm vụ khỏi vòng vẽ đường tự tìm đường.

### 4.2. Hệ thống nhấp chuột hoặc chạm để tự tìm đường (`src/domain/navigation.ts`, `src/scenes/WorldScene.ts`)

- Tận dụng lại toàn bộ quy tắc va chạm và thuật toán tìm đường BFS hiện có trong `src/domain/navigation.ts` bằng hàm thuần `planClickToMove`, trả về kế hoạch rõ ràng: `walk` (ô trống), `interact` (đi tới ô liền kề hợp lệ gần nhất và quay mặt về NPC, rương, biển chỉ đường, lửa trại), `portal` (đi tới cổng đã mở khóa), `portal_locked` (từ chối và mở thoại giải thích điều kiện còn thiếu) hoặc `blocked` (nước, cây, vách đá, kiến trúc).
- Trong `WorldScene.ts`, chỉ nhận sự kiện `pointerdown` trực tiếp trên `this.game.canvas` (loại trừ hoàn toàn click vào HUD, nút bấm, hộp thoại, bản đồ nhỏ), đổi tọa độ con trỏ qua `cameras.main.getWorldPoint(pointer.x, pointer.y)` để chính xác sau mọi thay đổi zoom, resize hoặc xoay màn hình.
- Vẽ đường tự tìm đường bằng chấm tròn màu xanh lam cùng vòng đích và dấu chéo đỏ cam khi bị chặn, tách biệt trực quan với vệt dẫn đường nhiệm vụ màu vàng. Tự tính lại đường nếu gặp vật cản phát sinh, hủy ngay khi người chơi bấm phím thủ công hoặc vào trận chiến, mở hộp thoại, chuyển vùng.

### 4.3. Kiến trúc học đa ngôn ngữ và hệ thống tiếng Trung HSK 2.0 (`src/domain/chinese.ts`, `src/data/zh-*.ts`)

- Không sao chép trò chơi hay bộ điều phối: bổ sung trường cấu hình tách bạch trong `GameSettings` (`learningLanguage: 'en' | 'zh' | 'none'`, `hskLevel: 'HSK1' | 'HSK2' | 'HSK3'`, `zhStudyMode`, `showPinyin`, `pinyinPosition`, `showZhTranslation`, `clickToMove`, `movementSpeed`) và sổ từ tiếng Trung riêng `state.lexiconZh`, giữ nguyên hoàn toàn `state.lexicon` cho tiếng Anh để hỗ trợ mở rộng thêm ngôn ngữ khác sau này mà không tạo lớp trừu tượng thừa.
- Chuẩn hóa dữ liệu HSK 2.0 (Hanban 2012) tách rõ 4 tệp gọn (`zh-lexicon-hsk1.ts`, `zh-lexicon-hsk2.ts`, `zh-lexicon-hsk3.ts`, `zh-lexicon-extra.ts`) cùng danh mục tên riêng `CHINESE_PROPER_NOUNS` (`55` mục) để tránh trộn cấp HSK hoặc gắn nhãn sai cho tên nhân vật, địa danh, sinh vật.
- Bộ tách từ tiếng Trung lai (`segmentChineseText` trong `src/domain/chinese.ts`) dùng cây tiền tố Trie khớp dài nhất xuôi trên tên riêng và toàn bộ từ điển, kết hợp `Intl.Segmenter('zh-CN', { granularity: 'word' })` khi có sẵn trên trình duyệt và dự phòng thuần TypeScript cho môi trường thiếu `Intl.Segmenter`. Xử lý đa âm, đa nghĩa theo thẻ ngữ cảnh và mẫu cụm từ (ví dụ phân biệt `还 hái` và `还 huán`, `长 cháng` và `长 zhǎng`, `了 le` và `了解 liǎojiě`, `看 kàn`, `走 zǒu`, `回 huí`).
- Hiển thị Pinyin trên/dưới chữ Hán bằng `inline-flex` theo từng từ trong `src/ui/uiHelpers.ts` thay vì thẻ `<ruby>` dễ vỡ dòng trên trình duyệt di động.
- Âm thanh `src/audio/soundEngine.ts` lọc nghiêm ngặt giọng nói `zh-CN` / `zh-Hans` / `zh` từ bộ nhớ đệm danh sách giọng (`voiceschanged`), tuyệt đối không gọi `speechSynthesis.speak` bằng giọng tiếng Anh khi thiếu giọng tiếng Trung.
- Di trú tệp lưu `SAVE_SCHEMA_VERSION = 3` trong `src/domain/save.ts`: chuyển đổi sạch mọi bản lưu phiên bản `1` và `2` (`v1.0`, `v1.1`, `v1.2.0`), suy diễn đúng `learningLanguage` từ `contentLanguage` cũ (`vi_only` thành `none`, còn lại giữ `en`), đặt mặc định `hskLevel: 'HSK2'`, `clickToMove: true`, `movementSpeed: 'walk'` và giữ nguyên toàn bộ đội hình, huy hiệu, nhiệm vụ, cờ tiến trình và sổ từ cũ.
