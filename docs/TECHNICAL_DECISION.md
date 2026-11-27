# Quyết định kỹ thuật và báo cáo kiểm chứng giai đoạn 0

## 1. Bối cảnh và phương pháp kiểm chứng

Trước khi viết mã nguồn cho LingoWild, nhóm kỹ thuật thực hiện kiểm chứng độc lập toàn bộ ứng viên mã nguồn mở, mẫu khởi tạo, nguồn ngữ liệu và nguồn tài nguyên đồ họa được nêu trong `docs/RESEARCH.md`. Mọi kết luận dưới đây dựa trên việc tải mã nguồn về thư mục tạm ngoài nhánh chính, đọc trực tiếp tệp giấy phép, đối chiếu mã commit, kiểm tra cây thư mục tài nguyên và chạy thử trình biên dịch thực tế trên môi trường Node.js `v24.14.0`, npm `11.9.0`, Windows 10/11 x64.

## 2. Bảng kiểm toán các kho mã nguồn và nguồn dữ liệu

| Nguồn khảo sát | Mã commit hoặc phiên bản kiểm chứng | Giấy phép mã nguồn | Giấy phép tài nguyên và dữ liệu | Kết quả chạy thử và phân tích kỹ thuật | Quyết định |
| --- | --- | --- | --- | --- | --- |
| `devshareacademy/monster-tamer` | `a964bba7ca0ae1aeeb712065a01b09ce3366f395` | MIT | Không có hình ảnh và âm thanh trong kho git; gói nén rời pha trộn 14 nguồn itch.io và SoundCloud, chỉ phông chữ Kenney là CC0 | Không có `package.json`, không dùng TypeScript, tải Phaser `3.60.0` và `webfontloader` qua CDN nên hỏng khi mất mạng; logic bắt sinh vật gọi trực tiếp đối tượng giao diện và hàm ngẫu nhiên không hạt giống; dữ liệu chỉ có 5 loài, 2 chiêu, 2 vật phẩm | Loại bỏ nhập mã và tài nguyên; chỉ tham khảo ý tưởng máy trạng thái hữu hạn cho lượt đấu |
| `phaserjs/template-vite-ts` | `d1d7d58acfcf47f97642bcb8b4967071b85f8db9` | MIT | Ảnh mẫu minh họa của Phaser Studio | Lệnh `npm ci` thất bại ngay lập tức do `package.json` khai báo `phaser@4.0.0` lệch với `phaser@3.88.2` trong `package-lock.json`; tệp `log.js` âm thầm gửi dữ liệu về máy chủ `gryzor.co` mỗi lần chạy `dev` hoặc `build`; `tsconfig.json` tắt kiểm tra khởi tạo thuộc tính | Không chép nguyên bản; tự dựng cấu hình Vite và TypeScript nghiêm ngặt không chứa mã theo dõi |
| `Annoraaq/grid-engine` | `ddb9b61f86d3c656c3b160ea8afc5acea6067705` (`v2.55.1`) | Apache-2.0 | Không kèm tài nguyên game | Mã sạch nhưng bản `2.55.1` yêu cầu `phaser@~4.2.1` và kéo theo `rxjs`, `mnemonist` chỉ để giải quyết di chuyển theo ô lưới 4 hướng | Không cài đặt; tự viết bộ điều khiển lưới thuần TypeScript gọn nhẹ và kiểm thử trực tiếp |
| `pokeclicker/pokeclicker` | `b6b4200d6a7f8d0528727b64155028bf18bba5bf` | ISC | Chứa tên gọi, hình ảnh và dữ liệu thương hiệu Pokémon | Dùng Gulp và KnockoutJS cũ, lối chơi nhấp chuột nhàn rỗi, vi phạm yêu cầu nguyên bản | Loại bỏ hoàn toàn |
| `pagefaultgames/pokerogue` | `8abad7c2c14cbc2fc41f68e808424f2c62fd5479` | AGPL-3.0 | Chứa hình ảnh, âm thanh và thương hiệu Pokémon | Giấy phép copyleft mạnh AGPL-3.0 buộc mở mã toàn bộ phái sinh mạng, đồng thời dính tài sản trí tuệ của bên thứ ba | Loại bỏ hoàn toàn |
| `Tuxemon/Tuxemon` | `4e63c45b436d372daae9f802bb5efa44232fe151` | GPL-3.0 | Pha trộn CC-BY-SA 4.0 và GPL-3.0 từ nhiều tác giả | Viết bằng Python và Pygame; nhập mã hoặc gói tài nguyên sẽ kéo theo nghĩa vụ copyleft GPL-3.0 hoặc CC-BY-SA 4.0 phức tạp | Không nhập mã hay tài nguyên; chỉ tham khảo cách tách dữ liệu loài và kỹ năng ra tệp cấu hình |
| `rspeer/wordfreq` | `912caf64b657478d1dff1138efdc078947d54bb1` | Apache-2.0 | Dữ liệu tần suất theo giấy phép CC-BY-SA 4.0 | Nhúng bảng dữ liệu vào ứng dụng tĩnh phía máy khách sẽ kích hoạt điều khoản chia sẻ tương tự CC-BY-SA 4.0 | Không nhúng dữ liệu vào sản phẩm; tự biên soạn từ vựng gắn ngữ cảnh game |
| `tatoeba.org` | Điều khoản hiện hành trên trang chủ | Nền tảng mã mở | Văn bản mặc định CC-BY 2.0 FR, một phần nhỏ CC0, âm thanh cấp phép riêng từng cá nhân | Câu ví dụ đời sống hiện đại lệch tông bối cảnh thám hiểm sinh vật; trộn lẫn câu cộng đồng chưa biên tập dễ sai ngữ cảnh | Không nhập tự động; tự biên soạn toàn bộ hội thoại và câu ví dụ nguyên bản trong bối cảnh LingoWild |
| `kenney.nl/assets` | Xác minh trực tiếp tệp `License.txt` | Không áp dụng | CC0 1.0 Universal | Cho phép dùng tự do kể cả thương mại, tuy nhiên phông chữ pixel của Kenney thiếu dấu tiếng Việt tổ hợp nên gây lỗi hiển thị khi ghép câu song ngữ | Dùng bảng màu và phong cách pixel tối giản; dùng phông chữ hỗ trợ đầy đủ tiếng Việt kết hợp bộ sinh tài nguyên pixel nội bộ |

## 3. Kết quả hai bản dựng thử nghiệm thực tế

Nhóm đã thực hiện hai bản dựng độc lập trong thư mục kiểm thử để đo khả năng biên dịch, dung lượng gói tin và độ tương thích công cụ:

1. Bản dựng thử A (`phaserjs/template-vite-ts` sau khi bỏ qua `log.js`):
   - Lệnh `npm ci --ignore-scripts` báo lỗi `EUSAGE` vì tệp khóa phiên bản trên kho gốc bị lệch (`phaser@3.88.2` so với `phaser@4.0.0` trong `package.json`).
   - Sau khi cài lại bằng `npm install --ignore-scripts`, lệnh `vite build` tạo ra gói `phaser` nặng `1.352,41 kB` và mã khởi tạo `3,14 kB`.
   - Rủi ro lớn: Phaser `4.0` thay đổi tầng dựng hình WebGL, nhiều tài liệu và hành vi bản đồ ô lưới chưa ổn định bằng nhánh `3.x` cuối cùng.

2. Bản dựng thử B (Khởi tạo sạch với `phaser@3.90.0`, `vite@6.3.5`, `typescript@5.8.3` chế độ nghiêm ngặt tối đa):
   - Cài đặt sạch 17 gói phụ thuộc trong 9 giây, không có kịch bản hậu cài đặt đáng ngờ.
   - Kiểm tra kiểu với `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true` đạt 0 lỗi.
   - Đóng gói sản phẩm hoàn tất trong `4,15 giây`, tổng dung lượng sau nén gzip đạt khoảng `340,30 kB`, tách riêng gói thư viện Phaser để tận dụng bộ nhớ đệm trình duyệt.
   - Máy kiểm thử đã có sẵn trình duyệt Chromium của Playwright (`chromium-1255`), cho phép chạy kiểm thử đầu cuối tự động, chụp ảnh màn hình thực tế và thu thập chỉ số khung hình.

## 4. Phản biện độc lập đối với tài liệu nghiên cứu ban đầu

Qua đối chứng thực nghiệm, tài liệu `docs/RESEARCH.md` có định hướng sản phẩm rất tốt ở triết lý đặt trải nghiệm chơi lên trước việc học, nhưng có 5 giả định kỹ thuật cần điều chỉnh triệt để:

1. Đánh giá quá lạc quan về `devshareacademy/monster-tamer`: Tài liệu ban đầu xếp kho này làm ứng viên số một và kỳ vọng có thể tận dụng mã nguồn. Thực tế đây là bài hướng dẫn viết bằng JavaScript thuần, phụ thuộc CDN, rỗng thư mục hình ảnh và âm thanh trong git, trộn lẫn tài nguyên itch.io không rõ quyền tái phân phối trên kho mã công khai và gắn chặt công thức chiến đấu vào đối tượng hiển thị của Phaser. Việc sửa mã này sang TypeScript nghiêm ngặt tốn kém và rủi ro hơn nhiều so với viết tầng nghiệp vụ sạch ngay từ đầu.
2. Bỏ sót mã theo dõi ngầm và lỗi tệp khóa trong `phaserjs/template-vite-ts`: Tài liệu ban đầu đề xuất dùng mẫu chính thức của Phaser nhưng chưa phát hiện tệp `log.js` tự động kết nối tới `gryzor.co` mỗi lần chạy lệnh, đi ngược trực tiếp nguyên tắc không thu thập dữ liệu mặc định và quy tắc an toàn chuỗi cung ứng trong `AGENTS.md`.
3. Rủi ro giấy phép phái sinh từ `wordfreq` và `Tatoeba`: Cả hai nguồn đều mang điều khoản CC-BY-SA 4.0 hoặc CC-BY 2.0 FR với chất lượng câu không đồng nhất với thế giới giả tưởng. Với quy mô 300 mục từ và 150 đoạn hội thoại, phương án biên soạn nguyên bản 100% gắn liền với sinh thái, nhiệm vụ, chiêu thức và vật phẩm của LingoWild vừa sạch hoàn toàn về bản quyền, vừa giúp người chơi nhớ từ nhờ ngữ cảnh câu chuyện liền mạch.
4. Giới hạn hiển thị tiếng Việt trong khung vẽ pixel: Vẽ hội thoại song ngữ Anh Việt và cửa sổ giải nghĩa từ trực tiếp bằng đối tượng văn bản của Phaser dễ bị nhòe dấu thanh tiếng Việt trên màn hình mật độ điểm ảnh cao, khó bấm chọn từng từ trên điện thoại và không hỗ trợ trình đọc màn hình. Giải pháp tối ưu là kết hợp hai lớp: Phaser `3.90.0` chuyên trách thế giới pixel 2D, chuyển động, hạt thời tiết và sân đấu; lớp giao diện DOM/CSS thuần TypeScript mang phong cách sổ tay thực địa đảm nhận hội thoại bấm tra từ, thực đơn chiến đấu, túi đồ, sổ sinh vật và điều khiển cảm ứng.
5. Ước lượng thời lượng chơi 60 đến 120 phút: Với phạm vi 1 khu trại trung tâm, 4 vùng liên kết, 12 nhiệm vụ và 3 thủ lĩnh vùng mà không dùng thủ thuật kéo dài thời gian bằng cày cấp lặp lại hay câu hỏi chắn đường, người chơi đi thẳng tuyến chính sẽ hoàn thành trong khoảng 25 đến 45 phút, còn người chơi khám phá trọn vẹn 30 loài, đọc sổ thực địa và ôn tập tự nguyện sẽ đạt khoảng 60 đến 90 phút. Tài liệu bàn giao cần công bố đúng thời lượng đo thực tế thay vì giữ con số mục tiêu cứng.

## 5. Kiến trúc lựa chọn và phương án dự phòng

### Lựa chọn chính thức

- Công cụ nền: `phaser@3.90.0` (MIT), `vite@6.3.5` (MIT), `typescript@5.8.3` (Apache-2.0), `vitest` (MIT) cho kiểm thử đơn vị và tích hợp, `@playwright/test` (Apache-2.0) cho kiểm thử trình duyệt thực tế. Mọi phiên bản được khóa chặt trong `package-lock.json`.
- Tách biệt hoàn toàn miền nghiệp vụ (`src/domain/`) khỏi tầng hiển thị (`src/scenes/`, `src/ui/`):
  - `src/domain/rng.ts`: Bộ sinh số giả ngẫu nhiên xác định Mulberry32 có hạt giống để tái lập 100% kết quả chiến đấu, tỷ lệ thu phục và chạm trán trong kiểm thử.
  - `src/domain/types.ts`, `src/domain/battle.ts`, `src/domain/capture.ts`: Hệ thống chiến đấu theo lượt có 6 nguyên tố tự nhiên (Lá Rừng, Suối Nước, Đất Nung, Gió Mây, Tia Chớp, Ánh Sao), trạng thái bất lợi, đổi sinh vật, dùng vật phẩm, rút lui và công thức thu phục theo máu cùng trạng thái mà không bao giờ bật câu đố chắn ngang.
  - `src/domain/world.ts`, `src/domain/quests.ts`, `src/domain/progression.ts`: Quản lý 1 khu trại trung tâm và 4 vùng sinh thái liên kết, chu kỳ ngày đêm, vật cản mở đường theo tiến độ nhiệm vụ, 15 nhân vật phụ, 12 nhiệm vụ có điểm kết thúc rõ ràng và 3 thủ lĩnh vùng.
  - `src/domain/learning.ts`: Bộ tách từ ngữ cảnh, tra nghĩa tiếng Việt tức thời khi chạm vào từ, phát âm qua Web Speech API có chế độ dự phòng văn bản phiên âm khi trình duyệt thiếu giọng đọc, lưu từ tự nguyện, theo dõi mức độ quen thuộc và gợi ý ôn tập nhẹ nhàng bên lửa trại.
  - `src/domain/save.ts`: Lưu trữ trên `localStorage` kèm cơ chế sao lưu dự phòng vào `IndexedDB`, có số hiệu phiên bản cấu trúc, kiểm tra tính toàn vẹn, chống tràn dung lượng, khôi phục bản lưu trước khi gặp dữ liệu hỏng, hỗ trợ xuất và nhập tệp JSON an toàn.
- Tài nguyên đồ họa và âm thanh nguyên bản:
  - Xây dựng trình sinh bảng hình ảnh pixel xác định (`scripts/generate-assets.ts`) xuất ra các tệp PNG thật trong `public/assets/sprites/` theo đúng bảng màu rừng rêu, đất nung, kem giấy và nước suối. Toàn bộ 30 loài sinh vật (gồm 3 loài khởi đầu và các nhánh tiến hóa), nhân vật chính, 15 nhân vật phụ, biểu tượng vật phẩm và bộ ô bản đồ 4 vùng đều là tài nguyên nguyên bản do dự án tự tạo, không phụ thuộc bên thứ ba.
  - Hệ thống âm thanh tổng hợp bằng Web Audio API nhiều kênh (nhạc nền riêng theo từng vùng, trận đấu thường, trận đấu thủ lĩnh, lửa trại và hiệu ứng âm thanh tương tác), tách riêng thanh trượt nhạc nền và hiệu ứng, tự động chuyển sang chế độ im lặng an toàn nếu thiết bị tắt âm thanh.
- Triển khai tĩnh: Cấu hình đường dẫn tương đối `./` (hoặc `/Pokemon/` tương thích tự động trên GitHub Pages và máy chủ tĩnh nội bộ), kèm trình quản lý bộ nhớ đệm ngoại tuyến an toàn.

### Phương án dự phòng

- Nếu môi trường trình duyệt kiểm thử hoặc thiết bị người dùng không khởi tạo được ngữ cảnh WebGL, Phaser ở chế độ `Phaser.AUTO` kết hợp cấu hình dự phòng `Phaser.CANVAS` sẽ tự động chuyển về Canvas 2D mà không làm gián đoạn trò chơi.
- Nếu bộ nhớ trình duyệt bị khóa hoặc đầy (`QuotaExceededError`), tầng lưu trữ giữ nguyên phiên chơi trong bộ nhớ RAM, cảnh báo nhẹ trên giao diện và cho phép người chơi tải tệp lưu `.json` về máy.
- Nếu trình duyệt không hỗ trợ `speechSynthesis` hoặc không có giọng tiếng Anh ngoại tuyến, nút nghe tự động hiển thị phiên âm dễ đọc cùng giải thích ngữ cảnh mà không phát sinh lỗi bảng điều khiển.

## 6. Kiểm tra công cụ mở rộng và quy trình kiểm định dữ liệu

- Qua rà soát các kỹ năng sẵn có trong môi trường làm việc và kho tiện ích, không có gói mở rộng chuyên biệt nào cho Phaser 2D cần cài thêm; các gói trên chợ tiện ích như Unity hay Meshy thiên về 3D và phụ thuộc dịch vụ ngoài nên không phù hợp. Toàn bộ quy trình được thực hiện trực tiếp bằng bộ công cụ chuẩn đã kiểm chứng.
- Quy trình kiểm định dữ liệu tự động (`scripts/validate-data.ts`) sẽ chạy trước mỗi lần đóng gói để đảm bảo:
  - Đủ và đúng cấu trúc tối thiểu 30 loài sinh vật nguyên bản, 3 loài khởi đầu, 40 chiêu thức, 15 nhân vật phụ, 12 nhiệm vụ, 3 thủ lĩnh vùng, 1 khu trung tâm và 4 vùng liên kết.
  - Tối thiểu 300 mục từ tiếng Anh đã biên tập nghĩa tiếng Việt, từ loại, phiên âm, cấp độ tham chiếu A1 đến B2 và câu ví dụ gắn với thế giới trò chơi; tối thiểu 150 đoạn hội thoại và ghi chép thực địa có ngữ cảnh.
  - Mọi liên kết mã loài, chiêu thức, vật phẩm, bản đồ, cửa chuyển vùng, nhân vật và điều kiện nhiệm vụ đều hợp lệ 100%, không có tham chiếu mồ côi và không trùng lặp nội dung giả tạo.
