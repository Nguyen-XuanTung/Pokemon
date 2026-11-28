# Báo cáo kiểm thử, độ phủ và đánh giá trải nghiệm LingoWild (v1.2.0)

## 1. Môi trường kiểm thử

- Hệ điều hành máy cục bộ: Windows x64 (`win32`), đối chiếu song song trên máy chủ Ubuntu (`ubuntu-latest`) của GitHub Actions và kiểm chứng trực tiếp trên trang production GitHub Pages.
- Môi trường thực thi: Node.js `v24.14.0`, npm `11.9.0`.
- Công cụ đóng gói, kiểm tra kiểu và bảo mật: Vite `8.4.0`, TypeScript `5.8.3` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`), `npm audit`.
- Khung kiểm thử đơn vị, tích hợp và đo độ phủ: Vitest `5.1.2` kèm `@vitest/coverage-v8@5.1.2`.
- Khung kiểm thử trình duyệt đầu cuối và ghi hình: Playwright `1.65.1` trên Chromium với cấu hình máy tính để bàn (`1280x720`) và điện thoại Pixel 7 ở cả chiều dọc (`412x915`) lẫn chiều ngang (`915x412`).

## 2. Kết quả tổng hợp các cổng kiểm định (v1.2.0)

| Hạng mục kiểm định | Lệnh thực thi | Kết quả thực tế |
| --- | --- | --- |
| Kiểm tra lỗ hổng phụ thuộc | `npm audit --audit-level=low` | Đạt: `0` lỗ hổng bảo mật trên toàn bộ cây phụ thuộc |
| Sinh 8 bảng ảnh pixel xác định | `npm run generate:assets` | Đạt: xuất `tileset.png`, `structures.png`, `battle-bg.png`, `characters.png`, `creatures.png`, `companions.png`, `items.png`, `vfx.png` |
| Kiểm định toàn vẹn dữ liệu và đường đi | `npm run validate:data` | Đạt: 30 loài, 42 chiêu, 13 vật phẩm, 5 bản đồ `32x24` liên thông, 16 NPC (4 thủ lĩnh, 4 tái đấu), 12 nhiệm vụ, 367 mục từ lõi (25 mục đa ví dụ, A1: 65, A2: 97, B1: 120, B2: 85), 192 hội thoại (độ phủ tra từ `90,5%`) |
| Kiểm tra quy tắc mã nguồn và tài liệu | `npm run lint` | Đạt: 0 lỗi văn phong trên 9 tệp Markdown và 56 tệp TypeScript, 0 tệp trùng lặp, 0 khóa bí mật hay điểm cuối theo dõi |
| Kiểm tra kiểu tĩnh nghiêm ngặt | `npm run typecheck` | Đạt: 0 lỗi trên toàn bộ mã nguồn, kịch bản và kiểm thử |
| Kiểm thử đơn vị, tích hợp và 6 lượt phá đảo 3 starter | `npm run test:coverage` | Đạt: `6/6` tệp (`36/36` bài kiểm thử), gồm 3 lượt phá đảo tự nhiên độ khó Phiêu lưu và 3 lượt phá đảo độ khó Thư giãn (ngưỡng cấp thấp hơn: 8, 12, 17, 21) cho cả `Mosskit`, `Kindlet` và `Ripplefin`, cùng 9 nhóm kiểm thử trải nghiệm người mới |
| Đóng gói sản phẩm, sao chép giấy phép và băm bộ nhớ đệm | `npm run build` | Đạt: `index.html` (`0,48 kB` gzip), `index.css` (`4,37 kB` gzip), gói ứng dụng (`184,36 kB` gzip), gói Phaser tách riêng (`318,37 kB` gzip), sao chép `LICENSE.txt` và `CREDITS.md` vào `dist/` và chèn 16 đường dẫn sắp xếp xác định vào `dist/sw.js` |
| Kiểm thử trình duyệt đầu cuối máy tính và di động | `npm run test:e2e` | Đạt: `12/12` bài kiểm thử hoạt động (8 bài chỉ chạy trên desktop được bỏ qua trên mobile), gồm kịch bản đọc và đi theo mũi tên la bàn trên màn hình, kiểm chứng một khuyến nghị chiến đấu duy nhất mỗi lượt, di trú bản lưu production `v1.1`, truy cập `LICENSE.txt` và `CREDITS.md`, kiểm toán 0 nhãn tiếng Anh lọt, bỏ qua và xem lại hướng dẫn, phá đảo cốt truyện và nâng cấp SW bản A sang B |

## 3. Báo cáo độ phủ mã nguồn theo đúng phạm vi được đo

Cấu hình `vitest.config.ts` đo độ phủ V8 trực tiếp trên `src/domain/**/*.ts` và `src/game/**/*.ts` (loại trừ tệp định nghĩa kiểu thuần `src/domain/types.ts`). Các tầng giao diện DOM (`src/ui/`), cảnh dựng hình Phaser (`src/scenes/`), âm thanh Web Audio (`src/audio/`) và bảng dữ liệu tĩnh (`src/data/`) không thuộc phép đo V8 này mà được kiểm chứng bằng `npm run validate:data` và bộ kiểm thử trình duyệt Playwright đầu cuối.

Số liệu thực tế trên phạm vi được đo (`src/domain/` và `src/game/controller.ts`):

- Tổng phạm vi được đo: `76,44%` câu lệnh, `78,91%` dòng mã, `71,64%` nhánh điều kiện, `60,04%` hàm.
- Ghi chú trung thực về `src/domain/i18n.ts`: Tệp danh mục bản địa hóa chứa các hàm định dạng nhãn cho giao diện DOM nên chỉ thực thi một phần trong Vitest (`13,66%` câu lệnh, `4,06%` hàm), trong khi toàn bộ nhãn giao diện thực tế đều được chạy và kiểm toán trực tiếp trên trình duyệt thật qua `tests/e2e/beginner-experience.spec.ts`.
- Độ phủ các mô-đun nghiệp vụ lõi trong `src/domain/` (tổng tầng `src/domain/`: `78,84%` câu lệnh, `81,81%` dòng mã):
  - `src/domain/capture.ts`: `100%` câu lệnh, `100%` nhánh, `100%` hàm, `100%` dòng mã.
  - `src/domain/difficulty.ts`: `100%` câu lệnh, `100%` nhánh, `100%` hàm, `100%` dòng mã.
  - `src/domain/elements.ts`: `100%` câu lệnh, `100%` nhánh, `100%` hàm, `100%` dòng mã.
  - `src/domain/creatures.ts`: `93,54%` câu lệnh, `97,39%` dòng mã, `100%` hàm.
  - `src/domain/battle.ts`: `91,80%` câu lệnh, `93,35%` dòng mã, `84,21%` nhánh, `100%` hàm.
  - `src/domain/quests.ts`: `93,18%` câu lệnh, `93,18%` dòng mã, `100%` hàm.
  - `src/domain/learning.ts`: `88,47%` câu lệnh, `90,97%` dòng mã.
  - `src/domain/state.ts`: `86,31%` câu lệnh, `89,88%` dòng mã.
  - `src/domain/navigation.ts`: `87,21%` câu lệnh, `87,81%` dòng mã, `93,54%` hàm.
  - `src/domain/battleAssist.ts`: `86,00%` câu lệnh, `86,61%` dòng mã, `100%` hàm.
  - `src/domain/save.ts`: `74,00%` câu lệnh, `84,66%` dòng mã, `94,44%` hàm.
  - `src/domain/world.ts`: `80,14%` câu lệnh, `82,11%` dòng mã, `93,75%` hàm.
  - `src/domain/rng.ts`: `71,42%` câu lệnh, `73,91%` dòng mã, `100%` hàm.
  - `src/domain/onboarding.ts`: `70,73%` câu lệnh, `70,88%` dòng mã, `80,00%` hàm.
- Bộ điều phối trò chơi (`src/game/controller.ts`): `68,83%` câu lệnh, `70,11%` dòng mã, `66,66%` hàm, `64,18%` nhánh điều kiện.

## 4. Các lỗi thật phát hiện và khắc phục trong vòng hoàn thiện v1.2.0

1. Lệch mục tiêu giữa mũi tên và văn bản thanh HUD trong khi nhập môn (`src/domain/navigation.ts`, `src/game/controller.ts`, `src/ui/gameUi.ts`): Phiên bản `7106a70` chỉ ghi đè tọa độ đích mà vẫn hiển thị văn bản nhiệm vụ chính trên thanh HUD và `Tôi bị lạc`. Đã bổ sung trường mục tiêu thống nhất (`activeGoalActionVi/En`, `goalSource`, `arrivedAtTarget`, `unreachableReasonVi/En`) để HUD, mũi tên, số bước, đường sáng, bản đồ nhỏ và `Tôi bị lạc` luôn khớp 100%.
2. Hai khuyến nghị mâu thuẫn nhau trong trận thu phục đầu tiên (`src/domain/onboarding.ts`, `src/domain/battleAssist.ts`, `src/ui/battleView.ts`): Vì `BattleSession` khởi đầu ở `turnCount = 1`, điều kiện bắt 100% bật quá sớm ngay lượt 1 trong khi chiêu tấn công vẫn có nhãn `Khuyên dùng`. Đã tách thành một `PrimaryBattleAction` duy nhất mỗi lượt (`heal`, `capture`, `switch` hoặc `move`), sửa điều kiện bảo đảm sang `enemyHpRatio <= 0.85 || turnCount >= 2` để Lượt 1 chỉ làm nổi bật duy nhất 1 chiêu làm yếu, Lượt 2 chỉ làm nổi bật duy nhất thẻ `Chuông và Túi` và `Chuông Rêu (Bảo đảm 100%)`, kèm cảnh báo `Dễ đánh ngất` khi đánh sinh vật chưa thu phục.
3. Kẹt bước 2 nhập môn khi người mới đi thẳng theo vệt sáng tới Trinh sát Mai (`src/domain/onboarding.ts`): Được phát hiện trực tiếp bởi kịch bản E2E tự đọc mũi tên trên màn hình vì từ điểm xuất phát tới Mai chỉ đúng 2 bước trong khi điều kiện cũ đòi 3 bước. Đã sửa xuống 2 bước và tự qua bước khi đã tương tác với nhân vật.
4. Lỗi tương phản nút xanh rêu `.lw-btn-moss` khi di chuột qua (`src/ui/styles.css`): Được phát hiện khi soi trực tiếp ảnh `23-beginner-capture-recommend.png`, do `.lw-btn:hover:not(:disabled)` đè màu nền kem nhạt lên chữ trắng. Đã bổ sung `.lw-btn-moss:hover:not(:disabled)` giữ nền xanh đậm tương phản cao.
5. Phân phối thông tin giấy phép và ghi công trong gói web (`scripts/inject-sw-manifest.ts`, `src/ui/journalView.ts`, `src/ui/gameUi.ts`): Đã sao chép `LICENSE.txt` và `CREDITS.md` vào `dist/`, đưa vào danh mục lưu đệm ngoại tuyến và bổ sung cửa sổ `Giấy phép và Ghi công` truy cập trực tiếp từ màn hình mở đầu và thẻ Cài đặt.
6. Cân bằng độ khó Thư giãn cho cả 3 sinh vật khởi đầu (`tests/integration/three-starters-natural-playthrough.test.ts`, `src/game/controller.ts`): Đã tự động chơi thử trọn vẹn từ đầu tới kết thúc cho `Mosskit`, `Kindlet` và `Ripplefin` trên chế độ Thư giãn với ngưỡng luyện cấp thấp hơn hẳn (cấp 8, 12, 17, 21) và bổ sung lưới an toàn tặng thêm 2 Chuông Rêu dự phòng khi người mới hết chuông và còn dưới 45 huy hiệu.

## 5. Phân biệt rõ kiểm thử tự động và phản hồi của người chơi thật

- Đã xác minh bằng kiểm thử tự động và kiểm tra trực quan: Toàn bộ kịch bản tự đọc và bước theo chỉ dẫn trên màn hình (không dựa tọa độ cứng), tính thống nhất của dẫn đường và Trợ giúp chiến đấu, bản địa hóa tiếng Việt 0 nhãn lọt, 6 lượt phá đảo tự nhiên cho cả 3 sinh vật khởi đầu ở 2 độ khó, di trú bản lưu production `v1.1`, truy cập tệp giấy phép từ gói web, kiểm tra trực quan 23 ảnh chụp màn hình và video quay thực tế `87,5` giây.
- Chưa thể thay thế bằng kiểm thử tự động (giới hạn trung thực): Chưa tiến hành thử nghiệm định lượng độc lập với nhóm người chơi mới hoàn toàn bên ngoài. Cảm nhận thực tế về nhịp đọc thoại, tốc độ làm quen giao diện di động và mức độ tự nhiên của phần mở đầu vẫn cần phản hồi từ người chơi thật sau khi phát hành.

## 6. Danh mục 23 ảnh chụp màn hình và video hướng dẫn người mới

Video quay trực tiếp trên bản đóng gói chính thức (`87,5` giây, `17,2 MB`, `960x540`):
- `docs/videos/lingowild-gameplay.webm`: Hành trình mở đầu của người mới bằng tiếng Việt từ màn hình mở đầu `v1.2.0`, chọn `Mosskit`, chạm tra và lưu từ, theo đường sáng gặp Trinh sát Mai, sang Rừng Thầm chiến đấu qua Lượt 1 (chỉ gợi ý đánh) tới Lượt 2 (chỉ gợi ý bắt 100%), hồi máu tại lửa trại, mở Sổ Thực Địa, Quản lý chiêu, đổi ngôn ngữ trực tiếp và dùng `Tôi bị lạc` cùng bảng xem nhanh 8 bước.

Bộ 23 ảnh chụp thực tế trong `docs/screenshots/`:
- `01-title-screen.png`: Màn hình mở đầu tiếng Việt `v1.2.0`, 4 nhóm thiết lập độc lập và nút `Giấy phép và Ghi công`.
- `02-contextual-gloss.png`: Hội thoại song ngữ Kiểm lâm Rowan kèm phiếu tra nghĩa từ và nút nghe phát âm.
- `03-mosslight-camp.png`, `04-whisperwood-overworld.png`, `12-reedwater-fen.png`, `13-terracotta-ridge.png`, `16-starfall-sanctuary.png`: Toàn bộ 5 vùng sinh thái pixel.
- `05-wild-battle.png`, `15-terracotta-boss-battle.png`, `17-starfall-final-trial.png`: Các sân đấu pixel theo vùng và trận đấu Thủ lĩnh.
- `06-field-journal-map.png`, `07-field-journal-compendium.png`, `14-field-journal-lexicon.png`: Bản đồ vùng, Bách khoa 30 loài và Sổ Từ Vựng bằng tiếng Việt.
- `08-campfire-review.png`: Ôn từ tự nguyện bên Đài Lửa Ánh Sao.
- `09-mobile-portrait.png`, `10-mobile-landscape.png`, `22-mobile-beginner-hud.png`: Giao diện điện thoại dọc và ngang kèm bản đồ nhỏ góc dưới phải, vệt sáng dẫn đường và phím cảm ứng.
- `11-starfall-ending.png`: Màn hình hoàn tất cốt truyện bằng tiếng Việt.
- `18-beginner-camp-guidance.png`: Trại Đèn Rêu với thanh HUD, mũi tên, vệt sáng và khung nhập môn thống nhất cùng dẫn tới Trinh sát Mai.
- `19-beginner-battle-assist.png`: Lượt 1 trận làm quen chỉ làm nổi bật duy nhất một chiêu khuyên dùng.
- `23-beginner-capture-recommend.png`: Lượt 2 trận làm quen chuyển sang làm nổi bật duy nhất thẻ `Chuông và Túi` cùng nút `Chuông Rêu x9 | Bảo đảm 100%`.
- `20-beginner-quests-wayfinding.png`: Thẻ Nhiệm vụ cấu trúc 5 trường và nút `Dẫn đường`.
- `21-lost-helper-modal.png`: Cửa sổ `Trợ giúp định hướng` kèm `Xem nhanh 8 bước cho người mới` và `Bật lại gợi ý từng bước`.
