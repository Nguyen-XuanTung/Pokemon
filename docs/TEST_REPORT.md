# Báo cáo kiểm thử, độ phủ và đánh giá chơi thử LingoWild 1.1

## 1. Môi trường đo đạc và kiểm thử

- Hệ điều hành: Windows x64 (`win32`).
- Môi trường chạy: Node.js `v24.14.0`, npm `11.9.0`.
- Công cụ đóng gói, kiểm tra kiểu và bảo mật: Vite `8.4.0`, TypeScript `5.8.3` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`), `npm audit`.
- Khung kiểm thử đơn vị, tích hợp và độ phủ mã nguồn: Vitest `5.1.2` kèm `@vitest/coverage-v8@5.1.2`.
- Khung kiểm thử trình duyệt đầu cuối: Playwright `1.65.1` trên Chromium với cấu hình máy tính để bàn (`1280x720`) và điện thoại Pixel 7 ở cả chiều dọc (`412x915`) lẫn chiều ngang (`915x412`).

## 2. Kết quả tổng hợp các cổng kiểm định

| Hạng mục kiểm định | Lệnh thực thi | Kết quả thực tế |
| --- | --- | --- |
| Kiểm tra lỗ hổng phụ thuộc | `npm audit` | Đạt: `0` lỗ hổng bảo mật trên toàn bộ cây phụ thuộc |
| Sinh tài nguyên pixel xác định | `npm run generate:assets` | Đạt: xuất 5 bảng ảnh PNG (`tileset.png`, `characters.png`, `creatures.png`, `items.png`, `vfx.png`) từ nguồn mở đã xác minh và hình vẽ nguyên bản |
| Kiểm định toàn vẹn dữ liệu và đường đi | `npm run validate:data` | Đạt: 30 loài, 42 chiêu, 13 vật phẩm, 5 bản đồ cỡ `32x24` kiểm chứng liên thông bằng tìm kiếm theo chiều rộng, 16 nhân vật phụ, 12 nhiệm vụ, 343 mục từ (A1: 59, A2: 87, B1: 112, B2: 85), 179 hội thoại |
| Kiểm tra quy tắc mã nguồn và tài liệu | `npm run lint` | Đạt: 0 lỗi văn phong trên 9 tệp Markdown và 47 tệp TypeScript, 0 tệp trùng lặp, 0 khóa bí mật hay điểm cuối theo dõi |
| Kiểm tra kiểu tĩnh nghiêm ngặt | `npm run typecheck` | Đạt: 0 lỗi trên toàn bộ mã nguồn, kịch bản và kiểm thử |
| Kiểm thử đơn vị, tích hợp và phá đảo 3 starter | `npm run test:coverage` | Đạt: `5/5` tệp (`20/20` ca kiểm thử), gồm kiểm thử tiến trình có dữ liệu mẫu và 3 ca phá đảo tự nhiên 100% thao tác người chơi cho cả `Mosskit`, `Kindlet`, `Ripplefin` |
| Đóng gói sản phẩm và danh mục ngoại tuyến | `npm run build` | Đạt: gói `index.html` (`0,48 kB` gzip), `index.css` (`3,35 kB` gzip), mã ứng dụng và dữ liệu (`127,95 kB` gzip), gói Phaser tách riêng (`318,37 kB` gzip), chèn 11 đường dẫn tiền nạp vào `dist/sw.js` |
| Kiểm thử trình duyệt đầu cuối và phá đảo thật | `npm run test:e2e` | Đạt: đầy đủ kịch bản trên máy tính và di động dọc ngang, ngoại tuyến, an toàn tệp lưu, đường dẫn `/Pokemon/` và một lượt chơi trọn vẹn từ màn hình mở đầu tới đoạn kết hoàn toàn bằng thao tác chuột và phím trên trình duyệt |

## 3. Báo cáo độ phủ mã nguồn thực tế (V8 Coverage)

Kết quả đo trực tiếp bằng `npm run test:coverage` tập trung vào các nhánh nghiệp vụ quan trọng:

- Tổng toàn dự án phần nghiệp vụ, dữ liệu và bộ điều khiển: `82,10%` dòng lệnh, `82,44%` hàm, `74,39%` nhánh điều kiện.
- Tầng miền nghiệp vụ cốt lõi (`src/domain/`): `87,60%` dòng lệnh, `93,44%` hàm, `74,77%` nhánh điều kiện:
  - `src/domain/elements.ts`: `100%` dòng lệnh, `100%` nhánh.
  - `src/domain/capture.ts`: `100%` dòng lệnh, `92,85%` nhánh.
  - `src/domain/creatures.ts`: `97,26%` dòng lệnh, `100%` hàm.
  - `src/domain/quests.ts`: `93,18%` dòng lệnh, `100%` hàm.
  - `src/domain/state.ts`: `89,28%` dòng lệnh, `100%` hàm.
  - `src/domain/learning.ts`: `89,25%` dòng lệnh, `94,44%` hàm (bao phủ tách cụm từ, đa nghĩa, biến thể CEFR, lập lịch gặp lại và tách biệt `exposures` khỏi `mastery`).
  - `src/domain/battle.ts`: `88,61%` dòng lệnh, `100%` hàm.
  - `src/domain/save.ts`: `84,42%` dòng lệnh, `92,30%` hàm (bao phủ kiểm định sâu cấu trúc, khóa ngoại, chống mất bản lưu khi nhập tệp lỗi và ưu tiên `memorySlot`).
  - `src/domain/world.ts`: `82,05%` dòng lệnh, `100%` hàm.
- Bộ điều phối trò chơi (`src/game/controller.ts`): `68,95%` dòng lệnh, các nhánh tương tác DOM và trình duyệt còn lại được kiểm chứng trực tiếp qua bộ Playwright E2E.

## 4. Số liệu hiệu năng và kiểm chứng các yêu cầu P0, P1

Số liệu đo tự động trên bản đóng gói chính thức (`test-results/benchmark-metrics.json`):

- Thời gian tải trang hoàn tất điều hướng: `433 ms`.
- Thời gian khởi tạo ứng dụng và gắn kết khung vẽ Phaser: `17 ms`.
- Tốc độ khung hình đo khi vận hành bản đồ nhiều lớp và hạt môi trường: khoảng `51 đến 60 FPS` tùy tải song song của trình chạy kiểm thử.
- Số lỗi bảng điều khiển (`console.error`, `pageerror`) và yêu cầu tài nguyên thất bại: `0 lỗi`.

Các tình huống nghiệm thu trọng yếu đã xác minh:

1. Phân tách trung thực kiểm thử có dữ liệu mẫu và kiểm thử thao tác thật:
   - `tests/integration/full-story-playthrough.test.ts` được giữ lại và mô tả rõ là bài kiểm thử tiến trình có hỗ trợ dữ liệu mẫu.
   - `tests/integration/three-starters-natural-playthrough.test.ts` đi từ `startNewGame` tới hoàn tất cốt truyện và đủ 12/12 nhiệm vụ cho cả ba sinh vật khởi đầu (`Mosskit`, `Kindlet`, `Ripplefin`) chỉ bằng bước đi hợp lệ, nhặt rương, mua vật phẩm, nghỉ lửa trại và đánh trận thật, tuyệt đối không sửa tay tọa độ, máu, kinh nghiệm, túi đồ, huy hiệu hay cờ nhiệm vụ.
   - `tests/e2e/full-playthrough.spec.ts` thực thi trên trình duyệt Chromium thật từ nút khởi hành mới trên màn hình tiêu đề tới bảng chúc mừng cuối truyện tại Thánh Địa Sao Rơi (khoảng `1762` bước chân, gặp tự nhiên `171` mục từ tiếng Anh, hoàn thành cốt truyện mà không trả lời bất kỳ thẻ ôn từ nào).
2. Độ chính xác khi thu phục và tải lại trang:
   - Cả kiểm thử Vitest lẫn Playwright đều xác nhận sau khi thu phục thành công, tổng số sinh vật sở hữu tăng đúng `+1`, đúng mã loài, đúng cấp độ, chỉ số, danh sách chiêu thức và giữ nguyên hoàn toàn sau khi tải lại từ bộ lưu trữ.
3. Kiểm định sâu tệp lưu và bảo vệ dữ liệu người chơi:
   - `validateGameStateShape` bác bỏ mọi tệp sai biên số học, tọa độ nằm ngoài kích thước bản đồ hoặc nằm trên ô chặn, mã loài/chiêu/vật phẩm/nhiệm vụ/từ vựng không tồn tại, cấu trúc đội hình rỗng hoặc vượt 6 cá thể và trường lồng nhau sai kiểu.
   - Nhập tệp JSON hỏng hoặc sai cấu trúc trả thông báo lỗi rõ ràng mà giữ nguyên 100% bản lưu hợp lệ đang có.
   - Khi `memorySlot` chứa tiến trình mới hơn `localStorage` sau sự cố đầy bộ nhớ, `load()` tự động chọn bản trên bộ nhớ tạm.
4. Trình phục vụ ngoại tuyến `public/sw.js`:
   - Khi nâng phiên bản bộ nhớ đệm, chỉ các kho mang tiền tố `lingowild-cache-` bị dọn dẹp; bộ nhớ đệm của ứng dụng khác cùng miền được giữ nguyên.
   - Khi mất mạng và yêu cầu tệp `.js`, `.css` hoặc `.png` chưa có trong đệm, trình phục vụ trả mã `503` chuẩn thay vì trả nhầm `index.html`.
   - Tải lại trang hoàn toàn ngoại tuyến sau lần mở đầu tiên hoạt động bình thường, giữ nguyên tiến trình đã lưu.

## 5. Các lỗi thực tế phát hiện khi chơi thử và kiểm tra ảnh chụp

1. Lỗi thứ tự điều kiện hội thoại của Học giả Lyra khóa nhiệm vụ cuối (`src/data/npcs.ts`): Khi chơi tự nhiên và thu phục đủ 12 loài trước khi lên Thánh Địa Sao Rơi, điều kiện hoàn thành nhiệm vụ phụ `q12_basin_naturalist` đứng trước điều kiện mở `q10_starlight_inscriptions`, khiến Lyra chỉ khen sổ sinh vật mà không giao nhiệm vụ đọc văn bia sao. Đã đảo ưu tiên kiểm tra nhiệm vụ văn bia lên trước và kiểm chứng đủ 12/12 nhiệm vụ cho cả ba starter.
2. Lỗi hộp thoại ẩn phía sau cửa sổ Quầy Tiếp Tế và Lửa Trại (`src/game/controller.ts`): Mở cửa sổ mua đồ hoặc ôn từ từ lựa chọn hội thoại trước đây chưa xóa trạng thái hộp thoại bên dưới. Đã xóa sạch `activeDialogue` ngay khi chuyển sang cửa sổ chức năng.
3. Lỗi méo tỷ lệ khung vẽ khi xoay ngang điện thoại (`src/main.ts`): Khi đổi khung nhìn từ `412x915` sang `915x412`, CSS co giãn khung chứa nhưng bộ đệm điểm ảnh của Phaser chưa cập nhật kịp gây giãn ngang nhân vật. Đã gắn `ResizeObserver` gọi `scale.resize` đồng bộ 1:1 và bổ sung kiểm tra tỷ lệ khung vẽ trong Playwright.
4. Lỗi vệt kẻ đen ngang trên ô gạch quảng trường và ô cát hẻm núi (`scripts/generate-assets.ts`): Khi rà soát từng ảnh chụp `03-mosslight-camp.png` và `13-terracotta-ridge.png`, nhóm phát hiện hai ô trích từ rìa vách đá của gói Kenney có vệt viền tối ở cạnh đáy tạo thành đường kẻ ngang lặp lại. Đã thay bằng ô đá lát mạch vữa dịu và ô cát gợn gió liền mạch, chụp lại xác nhận sạch hoàn toàn.

## 6. Đánh giá trải nghiệm chơi thử thực tế theo 8 tiêu chí

Giới hạn phương pháp công bố trung thực: Các nhận định dưới đây rút ra từ nhiều lượt tự chơi kiểm chứng của nhóm phát triển kết hợp các lượt chơi tự động bằng thao tác thật 100%, chưa có đợt thử nghiệm độc lập trên nhóm người học tiếng Anh bên ngoài. Vì vậy cảm nhận chủ quan của người mới hoàn toàn, khả năng nhớ từ dài hạn và độ mỏi tay trên nhiều dòng điện thoại vật lý vẫn cần thu thập thêm phản hồi thực địa trước khi mở rộng quy mô.

1. Người chơi có hiểu phải làm gì trong 5 phút đầu không?
   - Có. Ngay sau khi bấm khởi hành, Trưởng đoàn Rowan chào đón, giải thích ngắn gọn bối cảnh thung lũng, trao bạn đồng hành đầu tiên và thanh mục tiêu phía trên chỉ rõ hướng đi qua lối mòn phía tây kèm biển chỉ đường ngay ngã tư trại.
2. 15 phút đầu có đủ hấp dẫn không?
   - Nhịp 15 phút đầu kết hợp mở rương nhà kính, bước dưới tán rừng sồi hai lớp ở Rừng Thầm, chạm trán sinh vật đầu tiên, thử dùng chuông cộng hưởng, đọc manh mối vỏ cây giúp Haru và đấu thử với Kiểm lâm trẻ Elena trước khi gặp Thủ lĩnh Sylvan, không rơi vào cảnh đi bộ trống trải.
3. Có động lực bắt thêm sinh vật không?
   - Có ba động lực gắn trực tiếp với lối chơi: khắc chế hệ rõ rệt trước các thủ lĩnh vùng (ví dụ bắt sinh vật hệ Nước ở Đầm Sậy giúp vượt Thủ lĩnh Kaelen hệ Đá và Lửa ở Đèo Đất Nung nhẹ nhàng hơn hẳn), phân loại độ hiếm và vai trò chiến đấu trong sổ bách khoa, cùng các mốc thưởng từ nhiệm vụ của Tomas, Haru, Sora và Lyra.
4. Các lựa chọn chiến đấu có ý nghĩa không?
   - Có. Ma trận 6 nguyên tố đối xứng (`1,5x` và `0,67x`), nhãn báo hiệu quả ngay trên thẻ chiêu, 4 trạng thái bất lợi (ngủ, độc bào tử, bỏng, tê liệt), quyết định đổi đồng hành đúng hệ hoặc dùng thảo dược giải ngủ trước các đối thủ như `Astraloom` tạo khác biệt rõ rệt so với việc bấm đại một đòn đánh.
5. Độ khó có tăng hợp lý không?
   - Độ khó tăng dần theo bốn vùng từ cấp `2-8` ở Rừng Thầm, `9-13` ở Đầm Sậy, `14-18` ở Đèo Đất Nung lên `19-24` ở Thánh Địa Sao Rơi. Lượng huy hiệu rơi tự nhiên từ trận đấu và rương ẩn đủ mua thuốc hồi cùng chuông cấp cao tại Quầy Tiếp Tế mà không ép cày cấp kéo dài.
6. Tiếng Anh có xuất hiện tự nhiên không?
   - Tiếng Anh nằm trong lời chỉ đường, ghi chép tập tính sinh vật, manh mối nhiệm vụ và mô tả chiêu thức; khi đổi mức A1 đến B2, cấu trúc câu thoại tự điều chỉnh độ phức tạp. Các cụm từ đời thường và từ đa nghĩa hiển thị đúng nghĩa của ngữ cảnh đang đứng, còn những từ người chơi từng tra được nhắc lại tự nhiên ở các điểm ngắm cảnh tiếp theo.
7. Có thể hoàn thành game mà không thực hiện bất kỳ bài ôn tập nào không?
   - Hoàn toàn có thể. Cả bốn lượt phá đảo tự nhiên (3 starter trên Vitest và 1 lượt trình duyệt đầu cuối trên Playwright) đều hoàn tất cốt truyện mà không trả lời bất kỳ câu hỏi ôn từ nào bên lửa trại.
8. Chơi trên mobile có thực sự thuận tiện không?
   - Khung bản đồ đã lấp kín màn hình dọc lẫn ngang không còn khoảng đen thừa, thanh thông tin và thông báo gọn phía trên không che nhân vật, cụm phím chữ thập SVG bốn hướng cùng hai nút hành động lớn ở hai góc dưới cho phép hoàn thành nhiệm vụ hoàn toàn bằng cảm ứng không cần bàn phím cứng.

## 7. Danh mục 13 ảnh chụp màn hình thực tế

Toàn bộ ảnh chụp trong `docs/screenshots/` được trích xuất trực tiếp từ trình duyệt Chromium thật và đã kiểm tra thẩm mỹ từng tấm:

- `docs/screenshots/01-title-screen.png`: Màn hình mở đầu phong cách sổ gỗ thực địa và chọn chế độ ngôn ngữ.
- `docs/screenshots/02-contextual-gloss.png`: Hội thoại với Trưởng đoàn Rowan kèm phiếu giải nghĩa từ, phiên âm và nút đọc câu.
- `docs/screenshots/03-mosslight-camp.png`: Toàn cảnh Trại Đèn Rêu với nhà trại, quảng trường đá liền mạch, cầu gỗ và bờ suối hoa dại.
- `docs/screenshots/04-whisperwood-overworld.png`: Thung Lũng Rừng Thầm với đường mòn uốn lượn tự nối 16 hướng và rừng cây hai lớp.
- `docs/screenshots/05-wild-battle.png`: Sân đấu vùng rừng với sinh vật khung `48x48`, bóng sáng khỏe mạnh, nút nhịp độ trận đấu và chiêu thức tương tác.
- `docs/screenshots/06-field-journal-map.png`: Thẻ Bản đồ la bàn 5 vùng trong Sổ Thực Địa.
- `docs/screenshots/07-field-journal-compendium.png`: Thẻ Bách khoa 30 loài sinh vật kèm phân hạng độ hiếm và vai trò chiến đấu.
- `docs/screenshots/08-campfire-review.png`: Màn hình ôn tập từ vựng tự nguyện bên lửa trại tại Thánh Địa Sao Rơi.
- `docs/screenshots/09-mobile-portrait.png`: Giao diện điện thoại chiều dọc (`412x915`) khít màn hình kèm cụm điều hướng chữ thập trực quan.
- `docs/screenshots/10-mobile-landscape.png`: Giao diện điện thoại chiều ngang (`915x412`) giữ nguyên tỷ lệ điểm ảnh sắc nét không méo hình.
- `docs/screenshots/11-starfall-ending.png`: Màn hình tổng kết hoàn tất cốt truyện trước Bệ Đá Cộng Hưởng Tinh Tú cùng đội hình chiến thắng.
- `docs/screenshots/12-reedwater-fen.png`: Vùng Đầm Sậy Nước Trong với thuyền gỗ, cầu ván, hoa sen và bãi sậy đung đưa.
- `docs/screenshots/13-terracotta-ridge.png`: Vùng Đèo Đất Nung với vách đá đỏ, lều trại và nền cát ấm liền mạch.
