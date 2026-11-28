# Quyết định kỹ thuật và kiến trúc LingoWild

## 1. Bối cảnh và phương pháp kiểm chứng

Trước khi viết mã nguồn và xuyên suốt các đợt nâng cấp chất lượng trên nhánh `develop/lingowild`, nhóm kỹ thuật kiểm chứng độc lập toàn bộ ứng viên mã nguồn mở, nguồn ngữ liệu và gói tài nguyên nghệ thuật. Mọi quyết định dựa trên việc đọc trực tiếp tệp giấy phép gốc, kiểm tra tương thích bản quyền phân phối lại, chạy trình biên dịch nghiêm ngặt và kiểm tra từng tấm ảnh chụp đầu ra trên môi trường Node.js `v24.14.0`, npm `11.9.0`, Windows x64 và Ubuntu trên GitHub Actions.

## 2. Bảng kiểm toán mã nguồn mở, dữ liệu và tài nguyên nghệ thuật

| Nguồn khảo sát | Phiên bản hoặc tệp gốc | Giấy phép | Phân tích kỹ thuật thực tế | Quyết định |
| --- | --- | --- | --- | --- |
| `devshareacademy/monster-tamer` | `a964bba7` | Mã MIT; tài nguyên pha trộn 14 nguồn rời | Thiếu `package.json`, không dùng TypeScript, tải Phaser qua CDN nên hỏng khi ngoại tuyến | Không chép mã hay tài nguyên; chỉ tham khảo máy trạng thái lượt đấu |
| `phaserjs/template-vite-ts` | `d1d7d58a` | MIT | Lệch khóa phiên bản và chứa kịch bản `log.js` gửi yêu cầu về `gryzor.co` khi đóng gói | Không chép mẫu; tự dựng cấu hình Vite sạch theo dõi |
| `Annoraaq/grid-engine` | `v2.55.1` | Apache-2.0 | Đòi `phaser@~4.2.1` và kéo theo `rxjs`, `mnemonist` quá nặng cho di chuyển lưới bốn hướng | Tự viết bộ điều khiển ô lưới thuần TypeScript gọn nhẹ |
| `pokeclicker`, `pokerogue`, `Tuxemon` | Các nhánh chính | ISC, AGPL-3.0, GPL-3.0 | Vướng tài sản trí tuệ thương mại hoặc nghĩa vụ copyleft GPL/CC-BY-SA | Không nhập mã hay tài nguyên |
| `wordfreq` và `Tatoeba` | Bản phát hành chính | CC-BY-SA 4.0 / CC-BY 2.0 FR | Kéo theo copyleft đối với ngữ liệu và câu ví dụ lệch bối cảnh thám hiểm | Tự biên soạn 367 mục từ lõi, từ điển gốc từ hơn 430 mục và 192 đoạn thoại |
| `Kenney Roguelike/RPG Pack` | `License.txt` | CC0 1.0 Universal | Địa hình cỏ, bờ nước, cầu gỗ, thuyền và tán cây đồng bộ lưới `16x16` | Sử dụng trong `tileset.png` |
| `Sharm Tiny 16: Basic` | `ATTRIBUTION.txt` | CC-BY 3.0 / 4.0 | Nhân vật bốn hướng, rương gỗ, bậc đá, đá lát rêu và vách đá phân tầng rất sắc nét | Sử dụng có ghi công trong `characters.png` và `tileset.png` |
| `ArMM1998 Zelda-like Tilesets` | `LICENSE.txt` | CC0 1.0 Universal | Nhà gỗ lớn, quầy chợ mái bạt, đài phun nước động, cổng đá cổ, tượng hộ vệ và thác nước có chiều sâu | Đóng gói thành bảng kiến trúc đa ô `structures.png` |
| `Luis Zuno (@ansimuz)`, `Admurin`, `Pyromantic` | `ATTRIBUTION.txt` | CC0 1.0, CC-BY 3.0, CC-BY 4.0 | Các lớp núi xa, rừng sương, đầm lầy, bến gỗ và mây hoàng hôn vẽ tay chất lượng cao | Phối lớp thành 5 sân đấu vùng pixel trong `battle-bg.png` |

## 3. Các quyết định kiến trúc hoàn thiện bản phát hành cuối

Trên nền tảng kỹ thuật của mốc `9f3f47c`, bản phát hành cuối giải quyết triệt để các phát hiện kiểm toán còn lại và nâng tầm nghệ thuật thế giới, chiều sâu sưu tập, chiến thuật và tiếp thu tiếng Anh mà không mở rộng kiến trúc thừa:

1. Sửa lỗi trình phục vụ ngoại tuyến và định danh phiên bản theo nội dung tệp:
   - Trong `public/sw.js`, biểu thức `cache.match(req) || cache.match('./index.html')` trước đây trả về một đối tượng `Promise` luôn mang giá trị đúng về mặt logic ngay cả khi kết quả phân giải là `undefined`, khiến đường dẫn dự phòng không bao giờ chạy. Nhóm tách hàm bất đồng bộ `matchOfflineDocumentFallback` dùng `await` tường minh để kiểm tra tuần tự yêu cầu gốc rồi mới lùi về `./index.html`.
   - Trong `scripts/inject-sw-manifest.ts`, danh sách tệp tiền nạp được sắp xếp theo thứ tự từ điển xác định và băm `SHA-256` trên cả đường dẫn chuẩn hóa lẫn toàn bộ chuỗi byte nội dung của từng tệp để sinh `CACHE_VERSION`. Bất kỳ thay đổi nào trên mã nguồn, CSS hay bảng ảnh pixel đều tạo phiên bản bộ nhớ đệm mới và dọn sạch bản cũ khi kích hoạt, được kiểm chứng bằng bài kiểm thử nâng cấp từ bản A sang bản B trên trình duyệt thật.
2. Di trú an toàn tệp lưu cũ và chống xung đột đa thẻ trình duyệt:
   - `src/domain/save.ts` nâng `SAVE_SCHEMA_VERSION` lên `2` và bổ sung bước `migrateAndNormalizeSaveState` chuyển đổi mượt mà các bản lưu phiên bản `1` (từ bản 1.0 và 1.1). Khi tọa độ cũ của người chơi rơi vào ô nay đã đặt đài phun nước, nhà gỗ hoặc vách đá mới, thuật toán tìm kiếm xoắn ốc quanh vị trí cũ tự động dời nhân vật sang ô đi bộ an toàn gần nhất thay vì từ chối tệp lưu.
   - Bổ sung kiểm tra dấu thời gian `hasMultiTabConflict` và `syncFromNewerStorage` trước khi ghi đè để ngăn thẻ trình duyệt cũ xóa mất tiến trình mới hơn ở thẻ khác, đồng thời khôi phục bản sao lưu dự phòng nguyên vẹn nếu trình duyệt ném ngoại lệ đầy bộ nhớ `QuotaExceededError`.
3. Tách điều kiện đủ hạn ôn khỏi điểm ưu tiên trong bộ lập lịch từ vựng:
   - Trong `src/domain/learning.ts`, hàm `isWordDueForReencounter` kiểm tra nghiêm ngặt điều kiện đủ thời gian chờ tối thiểu kể từ lần gặp trước (`MIN_REENCOUNTER_STEP_GAP` tăng dần theo bậc `mastery` từ `0` đến `3`), hoàn toàn độc lập với hàm tính điểm xếp hạng `computeWordReencounterPriority`. Một từ vừa mới gặp dù có điểm ưu tiên dương cũng không bị lặp lại ngay lập tức; từ đã thành thạo bậc `3` chỉ xuất hiện lại sau quãng nghỉ dài để nhường chỗ cho từ đang cần củng cố.
   - Bổ sung từ điển gốc từ ngoại tuyến `src/data/pocket-dict.ts` kết hợp bộ tách hình thái từ tiếng Anh giúp người chơi chạm tra nghĩa của hơn `90,5%` từ vựng đời thường xuất hiện trong hội thoại ngay cả khi từ đó không gạch chân sẵn, đồng thời xoay vòng câu ví dụ độc lập trong `pickIndependentExample` để tránh chỉ chép lại câu thoại vừa đọc.
4. Đại tu nghệ thuật năm vùng sinh thái, 30 sinh vật và bảng lệnh chiến đấu hai cột:
   - Thay vì chỉ ghép các ô đơn lẻ `16x16`, `WorldScene.ts` đăng ký các khung kiến trúc đa ô từ `structures.png` có tách lớp mái che phía trên nhân vật và lớp chân tường có va chạm chính xác, đồng thời dùng hàng cây rừng tự nhiên nhiều tầng ở viền bản đồ thay cho tường đá cứng: nhà trại lớn `5x5`, quầy tiếp tế mái kẻ, đài phun nước đá ba nhịp động và cụm sồi `2x2` ở `Mosslight Camp`; rừng cây rậm nhiều tầng kèm vệt nắng dịu, bóng đổ mặt đất, thân cây rỗng và đá lát phủ rêu ở `Whisperwood Glen`; đường ván gỗ đa hướng có nút giao ván ghép bắc qua đầm sen và mây sương mềm ở `Reedwater Fen`; đường mòn đất đỏ tự nối 16 trạng thái, vách đá đất nung phân tầng có gờ cát nắng và thác nước `3x3` ở `Terracotta Ridge`; nền đá đen cổ ngữ, cổng vòm `4x4` và tượng hộ vệ ở `Starfall Sanctuary`.
   - Toàn bộ 30 sinh vật trong `creatures.png` được vẽ đổ bóng khối 4 sắc độ không nhiễu hạt với chân bám vững mặt đất ở cả hai nhịp thở, đi kèm 30 hình dáng đồng hành `16x16` đặc trưng trong `companions.png`. Thay nền sân đấu hình học phẳng bằng bảng `battle-bg.png` (`384x1080`) phối lớp pixel riêng cho cả năm vùng, kết hợp bảng điều khiển chiến đấu hai cột chuẩn nhập vai cổ điển và thanh kinh nghiệm trực quan trong `src/ui/battleView.ts`.
5. Chiều sâu đồng hành, tái đấu hậu cốt truyện và công thái học di động:
   - Sinh vật dẫn đầu đi bộ ngay sau lưng người chơi trên bản đồ (`companions.png`, bật tắt được trong cài đặt), xuất hiện biến thể ánh kim hiếm tự nhiên (`isRareVariant`), bốn dấu vết sinh cảnh phát sáng mở gợi ý bách khoa, sáu loài có truyện ngắn thực địa mở khóa sau khi thu phục, màn ăn mừng tiến hóa và bốn trận tái đấu bậc thầy cấp `24-30` với các thủ lĩnh vùng sau khi hoàn tất cốt truyện chính.
   - Trên di động, cụm phím chữ thập hỗ trợ nhấn giữ để bước liên tục mượt mà nhờ quản lý trạng thái con trỏ ở cấp bộ điều phối `GameUiRenderer` không bị ngắt khi vẽ lại giao diện; khung mục tiêu nhiệm vụ hiển thị trọn hai dòng rõ ràng và chạm mở nhanh danh sách nhiệm vụ.
