# LingoWild

LingoWild là trò chơi nhập vai thu phục sinh vật 2D chạy trực tiếp trên trình duyệt web, kết hợp tiếp thu tiếng Anh tự nhiên ngay trong ngữ cảnh thám hiểm. Người chơi dạo bước qua năm vùng sinh thái liên thông cùng bạn đồng hành đi theo sau lưng, trò chuyện với đoàn kiểm lâm, lần theo dấu vết sinh cảnh, chiến đấu theo lượt trên các sân đấu pixel, kết bạn với sinh vật hoang dã bằng chuông cộng hưởng và khôi phục sự cân bằng cho Thung Lũng Rêu Xanh mà không bao giờ bị chặn đường bởi bài kiểm tra từ vựng bắt buộc.

## Tính năng nổi bật trong bản phát hành cuối

- Thế giới 5 vùng sinh thái cỡ `32x24` giàu chiều sâu thị giác: Ngôi làng kiểm lâm `Mosslight Camp` có nhà gỗ lớn, đài phun nước đá ba nhịp động, quầy chợ tiếp tế, ghế dài và chậu hoa; `Whisperwood Glen` rậm rạp nhiều tầng cây với nắng xuyên tán lá, thân cây rỗng và nền đá rêu cổ; `Reedwater Fen` nối các đầm sen mờ sương bằng đường ván gỗ đóng đinh và cầu ván; `Terracotta Ridge` xếp tầng vách đá đất nung có gờ cát nắng và thác nước `3x3`; `Starfall Sanctuary` trang nghiêm với nền đá đen cổ ngữ, cổng vòm `4x4` và tượng đá hộ vệ.
- Hệ thống 30 loài sinh vật và đồng hành thực địa: Sinh vật đứng đầu đội hình bước đi theo sau người chơi trên bản đồ (`companions.png`), xuất hiện biến thể ánh kim hiếm tự nhiên, 4 dấu vết sinh cảnh phát sáng mở gợi ý bách khoa, sổ bách khoa hiển thị bóng dáng bí ẩn kèm vùng sống và thời điểm xuất hiện trước khi thu phục, màn ăn mừng tiến hóa và truyện ngắn thực địa cho các loài tiêu biểu.
- Chiến đấu chiến thuật và nội dung hậu cốt truyện: 42 chiêu thức thuộc 6 nguyên tố đối xứng trên 5 sân đấu pixel vẽ riêng cho từng vùng (`battle-bg.png`); thanh dự báo đầu lượt báo tốc độ ra đòn, cảnh báo bất lợi nguyên tố và gợi ý đổi đồng đội khắc chế; hiển thị trực tiếp tỷ lệ thu phục ước tính; mở khóa 4 trận tái đấu bậc thầy cấp `24` đến `30` với các thủ lĩnh vùng sau khi hoàn tất cốt truyện.
- Tiếp thu tiếng Anh ngữ cảnh và giao tiếp đời thường: 367 mục từ và cụm từ thông dụng kèm giải nghĩa đa nghĩa theo ngữ cảnh, phiên âm, từ loại và câu ví dụ độc lập, kết hợp từ điển gốc từ bỏ túi ngoại tuyến hơn 430 mục (`src/data/pocket-dict.ts`) giúp chạm tra nghĩa của trên `90,5%` từ xuất hiện trong 192 đoạn hội thoại từ mức A1 đến B2. Tách bạch rõ 4 trạng thái trong Sổ Từ Vựng (`Encountered`, `Saved`, `Mastered`, `Due Now`) và phân biệt nghiêm ngặt điều kiện đủ hạn thời gian chờ với điểm ưu tiên gặp lại từ.
- Giao diện sổ thực địa và công thái học di động: Khung vẽ tự co giãn sắc nét phủ kín màn hình dọc lẫn ngang, cụm phím chữ thập hỗ trợ nhấn giữ để bước đi liên tục, thanh mục tiêu hai dòng không cắt chữ và chạm mở nhanh danh sách nhiệm vụ.
- Lưu trữ an toàn và vận hành ngoại tuyến: Hỗ trợ chuyển đổi bản lưu từ phiên bản cũ sang cấu trúc mới và tự dời nhân vật khỏi ô mới bị chặn, chống ghi đè khi mở nhiều thẻ trình duyệt, bảo toàn bản dự phòng khi đầy bộ nhớ, định danh bộ nhớ đệm `SHA-256` theo nội dung byte tài nguyên và kiểm thử nâng cấp trình phục vụ ngoại tuyến từ bản A sang bản B.

## Ảnh chụp màn hình và video gameplay thực tế

Video quay trực tiếp quá trình chơi thực tế dài `151` giây lưu tại `docs/videos/lingowild-gameplay.webm`.

![Ngôi làng Trại Đèn Rêu và bạn đồng hành đi theo sau](docs/screenshots/03-mosslight-camp.png)

![Rừng Thầm nhiều tầng cây, vệt nắng và đá lát rêu](docs/screenshots/04-whisperwood-overworld.png)

![Đầm Sậy Nước Trong với đường ván gỗ, cầu nối đảo sen và sương mờ](docs/screenshots/12-reedwater-fen.png)

![Sân đấu hẻm núi hoàng hôn và dự báo chiến thuật đầu lượt](docs/screenshots/15-terracotta-boss-battle.png)

![Sổ bách khoa bóng dáng bí ẩn và gợi ý vùng sinh cảnh](docs/screenshots/07-field-journal-compendium.png)

Xem trọn bộ 17 ảnh chụp thực tế của cả 5 khu vực, nhiều sân đấu pixel, giao diện sổ từ vựng và di động dọc ngang trong thư mục `docs/screenshots/`.

## Yêu cầu hệ thống và lệnh chạy

Cần cài đặt Node.js phiên bản `22.6` trở lên, đã kiểm thử trên Node.js `v24.14.0` và npm `11.9.0`.

```bash
# Cài đặt gói phụ thuộc từ tệp khóa phiên bản
npm ci --ignore-scripts

# Kiểm tra lỗ hổng bảo mật phụ thuộc
npm audit

# Chạy máy chủ phát triển cục bộ tại http://localhost:5173
npm run dev

# Sinh 8 bảng ảnh pixel, kiểm định dữ liệu, kiểm tra kiểu, đóng gói dist/ và băm danh mục ngoại tuyến
npm run build

# Xem thử bản đóng gói tại http://127.0.0.1:4173
npm run preview

# Chạy kiểm tra quy tắc dự án, kiểm thử đơn vị và tích hợp kèm độ phủ V8, kiểm thử trình duyệt đầu cuối
npm run lint
npm run test:coverage
npm run test:e2e
```

## Tài liệu bàn giao dự án

- [Hướng dẫn chơi chi tiết](docs/HOW_TO_PLAY.md)
- [Quyết định kỹ thuật và kiến trúc](docs/TECHNICAL_DECISION.md)
- [Báo cáo kiểm thử, độ phủ và đánh giá chơi thử](docs/TEST_REPORT.md)
- [Danh mục kiểm tra bàn giao phát hành cuối](docs/RELEASE_CHECKLIST.md)
- [Ghi công và nguồn gốc tài nguyên](CREDITS.md)
- [Nghiên cứu sản phẩm ban đầu](docs/RESEARCH.md)
- [Quy tắc triển khai](AGENTS.md)

## Giới hạn và lưu ý pháp lý

- Thời lượng hoàn thành tuyến chính khoảng 30 đến 50 phút nếu đi thẳng mục tiêu, hoặc 75 đến 110 phút khi khám phá trọn vẹn 30 loài, tìm đủ 4 dấu vết sinh cảnh, hoàn thành cả 12 nhiệm vụ và vượt qua 4 trận tái đấu bậc thầy sau cốt truyện.
- Trò chơi vận hành hoàn toàn phía máy khách cho một người chơi, không có máy chủ tài khoản hay đồng bộ đám mây tự động. Nhạc nền tổng hợp bằng Web Audio API và giọng đọc tiếng Anh phụ thuộc vào gói giọng nói của trình duyệt trên thiết bị.
- Nhãn mức độ từ A1 đến B2 trong cài đặt chỉ dùng để điều chỉnh độ phức tạp câu thoại và gợi ý từ trong game, không phải chứng chỉ đánh giá năng lực ngoại ngữ và chưa qua thử nghiệm độc lập trên nhóm người học bên ngoài.
- Tên gọi LingoWild là tên làm việc tạm thời, chưa đăng ký nhãn hiệu. Dự án hoàn toàn độc lập và không có bất kỳ mối liên hệ nào với The Pokémon Company hay Nintendo.
