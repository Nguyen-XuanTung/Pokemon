# Báo cáo kiểm thử thực tế LingoWild 1.0

## 1. Môi trường đo đạc và kiểm thử

- Hệ điều hành: Windows x64 (`win32`).
- Môi trường chạy: Node.js `v24.14.0`, npm `11.9.0`.
- Công cụ đóng gói và kiểm tra kiểu: Vite `6.3.5`, TypeScript `5.8.3` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`).
- Khung kiểm thử đơn vị và tích hợp: Vitest `3.1.4`.
- Khung kiểm thử trình duyệt đầu cuối: Playwright `1.65.1` chạy trên nhân Chromium (`chromium-1255`) với hai cấu hình: máy tính để bàn (`1280x720`) và điện thoại Pixel 7 (`412x915`, cảm ứng).

## 2. Kết quả tổng hợp các cổng kiểm định

| Hạng mục kiểm định | Lệnh thực thi | Kết quả thực tế | Thời gian chạy |
| --- | --- | --- | --- |
| Sinh tài nguyên pixel xác định | `npm run generate:assets` | Đạt: xuất 4 bảng ảnh PNG (`tileset.png`, `characters.png`, `creatures.png`, `items.png`) | `< 0,3 giây` |
| Kiểm định toàn vẹn dữ liệu và liên thông bản đồ | `npm run validate:data` | Đạt: 30 loài (3 khởi đầu), 42 chiêu, 13 vật phẩm, 5 bản đồ kiểm chứng đường đi bằng thuật toán tìm kiếm theo chiều rộng, 16 nhân vật phụ (4 trận thủ lĩnh), 12 nhiệm vụ, 321 mục từ (A1: 58, A2: 76, B1: 103, B2: 84), 174 hội thoại | `< 0,4 giây` |
| Kiểm tra quy tắc mã nguồn và tài liệu | `npm run lint` | Đạt: 0 lỗi văn phong tài liệu, 0 tệp trùng lặp, 0 khóa bí mật hoặc điểm cuối theo dõi | `< 0,3 giây` |
| Kiểm tra kiểu tĩnh nghiêm ngặt | `npm run typecheck` | Đạt: 0 lỗi trên toàn bộ mã nguồn, kịch bản và tệp kiểm thử | `< 1,5 giây` |
| Đóng gói sản phẩm tĩnh | `npm run build` | Đạt: `index.html` (`0,46 kB` gzip), `index.css` (`2,37 kB` gzip), gói nghiệp vụ và dữ liệu (`107,62 kB` gzip), gói thư viện Phaser tách riêng (`339,84 kB` gzip) | `3,68 giây` |
| Kiểm thử đơn vị và tích hợp cốt truyện | `npm test` | Đạt: `4/4` tệp (`13/13` ca kiểm thử), bao gồm mô phỏng hoàn tất 100% tuyến truyện chính và cả 12 nhiệm vụ | `0,64 giây` |
| Kiểm thử trình duyệt đầu cuối | `npm run test:e2e` | Đạt: `5/5` kịch bản thực thi (`3` bỏ qua trùng lặp thiết bị), gồm máy tính, cảm ứng di động Pixel 7, khôi phục bản lưu lỗi, nhập tệp JSON, hoàn thành đoạn kết tại Thánh Địa Sao Rơi, đường dẫn `/Pokemon/`, đổi phím, bấm rương lặp lại và tắt âm thanh | `8,50 giây` |

## 3. Số liệu hiệu năng đo thực tế

Số liệu thu thập tự động từ trình duyệt Chromium chạy bản đóng gói chính thức (`vite preview` tại `http://127.0.0.1:4173`, lưu tại `test-results/benchmark-metrics.json`):

- Thời gian tải trang hoàn tất điều hướng: `262 ms`.
- Thời gian khởi tạo ứng dụng và gắn kết khung vẽ Phaser: `10 ms`.
- Tốc độ khung hình đo trong lúc vận hành bản đồ và chuyển cảnh: `60 FPS` ổn định.
- Số lỗi bảng điều khiển trình duyệt (`console.error` và `pageerror`) trong luồng chuẩn: `0 lỗi`.
- Số yêu cầu mạng thất bại trên tài nguyên trò chơi trong luồng chuẩn và dưới đường dẫn con `/Pokemon/`: `0 lỗi`.

## 4. Chi tiết các tình huống biên đã kiểm chứng

1. Cân bằng hệ tương khắc và xác suất thu phục:
   - Ma trận 6 nguyên tố đạt cân bằng đối xứng tuyệt đối (mỗi nguyên tố khắc chế đúng 2 nguyên tố ở mức `1,5x` và chịu kháng `0,67x` trước 2 nguyên tố đó, không có cặp khắc chế chồng chéo hai chiều).
   - Xác suất kết bạn tăng đơn điệu khi máu đối phương giảm, khi đối phương ở trạng thái ngủ hoặc tê liệt và khi dùng chuông cấp cao hơn. Chặn hoàn toàn việc dùng chuông lên sinh vật đã có chủ mà không làm mất chuông của người chơi.
2. Lưu trữ bền vững, dữ liệu hỏng và tràn dung lượng:
   - Khi tệp lưu chính `lingowild_save_v1` bị ghi đè bằng chuỗi JSON hỏng hoặc sai mã kiểm tra FNV-1a, trình tải tự động khôi phục từ bản sao lưu `lingowild_save_v1_backup` mà không làm văng ứng dụng.
   - Khi giả lập lỗi đầy bộ nhớ `QuotaExceededError`, hệ thống tự động dọn khe phụ hoặc giữ phiên chơi an toàn trên bộ nhớ RAM kèm cảnh báo xuất tệp JSON.
   - Tệp nhập quá giới hạn `256 kB` hoặc sai phiên bản cấu trúc bị từ chối an toàn trước khi ghi đè dữ liệu cũ.
3. Tương tác lặp lại, đổi phím, di động và mất âm thanh:
   - Bấm phím tương tác liên tiếp 10 lần vào cùng một rương tiếp tế chỉ cộng thưởng đúng 1 lần duy nhất (`+40` Huy hiệu và `3` Sương Thảo Dược).
   - Khi trình duyệt không có `AudioContext` và không có `speechSynthesis`, trò chơi vẫn vận hành bình thường và hộp giải nghĩa từ tự động hiện dòng hướng dẫn phiên âm dự phòng.
   - Tính năng đổi phím trong mục cài đặt hoạt động tức thì trên trình duyệt. Giao diện cảm ứng tự động bật trên khung hình Pixel 7 không che khuất thanh thông tin trên cùng.
4. Hoàn thành trọn vẹn cốt truyện không cần làm bài kiểm tra:
   - Cả kiểm thử tích hợp lẫn trình duyệt thực tế đều xác nhận người chơi đi từ Trại Đèn Rêu qua đủ 4 vùng, vượt 3 Thủ lĩnh vùng cùng Trưởng lão Astraea, kích hoạt Bệ Đá Tinh Tú và hoàn thành 12/12 nhiệm vụ mà không bị buộc trả lời bất kỳ câu đố từ vựng nào.

## 5. Các lỗi thực tế phát hiện trong quá trình phát triển và đã khắc phục

1. Lỗi đường dẫn ảnh cắt khung trên thư mục con GitHub Pages: Ban đầu tệp CSS trỏ cứng `/assets/sprites/creatures.png` khiến trang đặt dưới `/Pokemon/` có nguy cơ tìm sai gốc máy chủ. Đã chuyển sang biến CSS khởi tạo theo `new URL('./assets/...', window.location.href)` và xác minh bằng kiểm thử định tuyến `/Pokemon/index.html`.
2. Lỗi khoảng hở dấu tiếng Việt trên phông chữ có chân: Khi kiểm tra ảnh chụp màn hình đầu tiên, phông `Georgia` trên Chromium Windows làm lệch nhẹ dấu tổ hợp trong chữ `Thầm` và `chầm`. Đã chuyển sang họ phông hệ thống không chân hỗ trợ tiếng Việt đầy đủ, kiểm tra lại qua ảnh chụp mới không còn lỗi hiển thị.
3. Lỗi hủy nhầm đối tượng nhân vật khi đổi bản đồ trong Phaser: Lệnh `mapContainer.removeAll(true)` ban đầu vô tình hủy luôn `playerSprite` nằm bên trong nhóm, phát sinh lỗi `Cannot read properties of undefined (reading 'sys')` khi tải lại trang. Đã tách `playerSprite` ra tầng hiển thị độc lập trên cảnh chơi và xác nhận 0 lỗi bảng điều khiển.
4. Tinh chỉnh độ khó vùng đầu tiên: Qua chạy thử thực tế, sinh vật khởi đầu cấp 5 khi vừa bước vào Rừng Thầm gặp đối thủ hoang dã cấp 6 đến 7 dễ bị kiệt sức nếu người chơi giành 2 lượt đầu để quan sát và thử chuông. Đã nâng cấp khởi đầu lên 6 và điều chỉnh cấp sinh vật vùng đầu về 2 đến 5 để nhịp làm quen mượt mà hơn.

## 6. Ảnh chụp màn hình thực tế

Toàn bộ ảnh chụp dưới đây được trích xuất tự động từ trình duyệt Chromium thật khi chạy `npm run test:e2e`:

- `docs/screenshots/01-title-screen.png`: Màn hình khởi đầu và chọn chế độ hỗ trợ ngôn ngữ.
- `docs/screenshots/02-contextual-gloss.png`: Hội thoại với Trưởng đoàn Rowan kèm hộp tra nghĩa từ `valley`, phiên âm và nút lưu từ.
- `docs/screenshots/03-whisperwood-overworld.png`: Khám phá Thung Lũng Rừng Thầm với thanh mục tiêu nhiệm vụ và lửa trại.
- `docs/screenshots/04-wild-battle.png`: Giao diện chiến đấu theo lượt tập trung vào sinh vật và mô tả chiêu thức tương tác.
- `docs/screenshots/05-field-journal.png`: Sổ Thực Địa mở thẻ Bách khoa sinh vật với hình vẽ pixel từng loài.
- `docs/screenshots/06-campfire-review.png`: Hoạt động ôn từ vựng tự nguyện bên lửa trại.
- `docs/screenshots/07-starfall-finale.png`: Khoảnh khắc kích hoạt Bệ Đá Cộng Hưởng Tinh Tú hoàn tất cốt truyện chính.
- `docs/screenshots/08-mobile-touch.png`: Giao diện dọc trên điện thoại kèm cụm phím cảm ứng.

## 7. Giới hạn hiện tại công bố trung thực

- Thời lượng chơi thực tế: Người chơi đi thẳng tuyến nhiệm vụ chính sẽ hoàn thành trong khoảng 25 đến 45 phút; người chơi đọc kỹ toàn bộ 174 đoạn hội thoại, mở hết rương ẩn, thu phục và tiến hóa trọn 30 loài kết hợp ôn từ bên lửa trại sẽ đạt khoảng 60 đến 90 phút. Nhóm không kéo dài thời lượng giả tạo bằng cách bắt cày cấp nặng.
- Âm thanh và giọng đọc: Nhạc nền và hiệu ứng được tổng hợp trực tiếp bằng Web Audio API theo phong cách điện tử tối giản để đảm bảo dung lượng nhẹ và sạch bản quyền 100%, không phải bản thu giao hưởng. Tính năng phát âm từ tiếng Anh phụ thuộc vào gói giọng đọc có sẵn của trình duyệt người dùng (khi thiếu giọng đọc sẽ hiển thị phiên âm chữ).
- Phạm vi tính năng: Trò chơi là bản chơi đơn ngoại tuyến trên trình duyệt, không có chế độ nhiều người chơi qua mạng, không đồng bộ đám mây giữa nhiều máy tự động (người chơi chuyển máy qua tính năng xuất và nhập tệp `.json`).
- Hiệu quả giáo dục: Cơ chế tiếp xúc từ vựng lặp lại theo ngữ cảnh và tra nghĩa tức thời được thiết kế dựa trên nguyên lý hỗ trợ đọc hiểu, chưa tiến hành nghiên cứu đối chứng lâm sàng trên nhóm người học thực tế.
