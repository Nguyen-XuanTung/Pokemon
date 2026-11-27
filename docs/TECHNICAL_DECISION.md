# Quyết định kỹ thuật và kiến trúc LingoWild

## 1. Bối cảnh và phương pháp kiểm chứng giai đoạn nền tảng

Trước khi viết mã nguồn cho LingoWild, nhóm kỹ thuật thực hiện kiểm chứng độc lập toàn bộ ứng viên mã nguồn mở, mẫu khởi tạo, nguồn ngữ liệu và nguồn tài nguyên đồ họa nêu trong `docs/RESEARCH.md`. Mọi kết luận dựa trên việc tải mã nguồn về thư mục tạm ngoài nhánh chính, đọc trực tiếp tệp giấy phép, đối chiếu mã commit, kiểm tra cây thư mục tài nguyên và chạy thử trình biên dịch trên môi trường Node.js `v24.14.0`, npm `11.9.0`, Windows x64.

## 2. Bảng kiểm toán các kho mã nguồn và nguồn dữ liệu ban đầu

| Nguồn khảo sát | Phiên bản kiểm chứng | Giấy phép mã | Giấy phép tài nguyên | Phân tích kỹ thuật thực tế | Quyết định |
| --- | --- | --- | --- | --- | --- |
| `devshareacademy/monster-tamer` | `a964bba7` | MIT | Rỗng ảnh và nhạc trong git; gói rời pha trộn 14 nguồn itch.io và SoundCloud | Không có `package.json`, không dùng TypeScript, tải Phaser qua CDN nên hỏng khi mất mạng; công thức bắt sinh vật trộn trực tiếp vào đối tượng hiển thị | Không nhập mã hay tài nguyên; chỉ tham khảo máy trạng thái lượt đấu |
| `phaserjs/template-vite-ts` | `d1d7d58a` | MIT | Ảnh mẫu Phaser Studio | Lệch phiên bản trong `package-lock.json` làm `npm ci` lỗi; tệp `log.js` ngầm gọi máy chủ `gryzor.co` mỗi lần đóng gói | Không chép mẫu; dựng cấu hình Vite và TypeScript nghiêm ngặt sạch theo dõi |
| `Annoraaq/grid-engine` | `ddb9b61f` (`v2.55.1`) | Apache-2.0 | Không kèm tài nguyên | Yêu cầu `phaser@~4.2.1` và kéo theo `rxjs`, `mnemonist` chỉ cho di chuyển lưới 4 hướng | Tự viết bộ điều khiển ô lưới thuần TypeScript gọn nhẹ |
| `pokeclicker` và `pokerogue` | `b6b4200d` / `8abad7c2` | ISC / AGPL-3.0 | Chứa tài sản trí tuệ Pokémon | Dính bản quyền thương mại bên thứ ba và điều khoản AGPL-3.0 | Loại bỏ hoàn toàn |
| `Tuxemon/Tuxemon` | `4e63c45b` | GPL-3.0 | Pha trộn CC-BY-SA 4.0 và GPL-3.0 | Viết bằng Python/Pygame; nhập tài nguyên hoặc mã sẽ kích hoạt nghĩa vụ copyleft | Chỉ tham khảo cách tách dữ liệu loài và chiêu thức ra tệp cấu hình |
| `wordfreq` và `Tatoeba` | `912caf64` / trang chủ | Apache-2.0 / mở | CC-BY-SA 4.0 và CC-BY 2.0 FR | Nhúng dữ liệu kéo theo copyleft và câu ví dụ đời thường lệch bối cảnh thám hiểm | Tự biên soạn toàn bộ từ vựng, cụm từ và hội thoại gắn với thế giới game |
| `Kenney Roguelike/RPG Pack` | Tệp `License.txt` gốc | Không áp dụng | CC0 1.0 Universal | Sạch bản quyền tuyệt đối, giàu chi tiết địa hình rừng, nước, đường mòn, mái nhà | Sử dụng làm nền địa hình chính trong `assets-src/kenney-roguelike-cc0/` |
| `Sharm Tiny 16: Basic` | Tệp `ATTRIBUTION.txt` gốc | Không áp dụng | CC-BY 3.0 / 4.0 | Bộ nhân vật bước đi 4 hướng, rương gỗ, lửa trại và vách đá rất đồng bộ tỷ lệ `16x16` | Sử dụng có ghi công chuẩn trong `assets-src/sharm-tiny16-ccby/` và `CREDITS.md` |

## 3. Phản biện và bài học thiết kế khi nâng cấp lên bản 1.1

Sau đợt rà soát nghiệm thu độc lập đối với mốc `8bd1b89`, nhóm đối chiếu sản phẩm với các chuẩn mực thiết kế của Pokémon Emerald, Pokémon HeartGold, Stardew Valley, Eastward, Cassette Beasts, Coromon và Nexomon để giải quyết sáu vấn đề trọng tâm mà không viết lại dự án hay tạo giao diện trùng lặp:

1. Từ hình chữ nhật tự vẽ sang quy trình kết hợp tài nguyên pixel mở và tự nối ô 16 hướng:
   - Ở bản đầu, việc vẽ toàn bộ cây cối, đất đá và nhà cửa bằng các hình khối đơn giản khiến bản đồ trông giống môi trường thử thuật toán.
   - Nhóm tích hợp bộ địa hình Kenney CC0 cùng bộ nhân vật và vật cảnh Sharm CC-BY vào `assets-src/`, đồng thời xây dựng bộ tự nối ô theo mặt nạ 4 hướng Bắc Đông Nam Tây (`16` trạng thái cho đường mòn đất nện và `16` trạng thái cho bờ nước tự nhiên) trong `scripts/generate-assets.ts` và `src/scenes/WorldScene.ts`. Cây cổ thụ được tách thành lớp gốc có va chạm và lớp tán lá hiển thị phía trên nhân vật, kết hợp mái trại, cầu gỗ, thuyền sậy, hoa dại và hạt sáng môi trường để mỗi vùng có bản sắc thị giác riêng.
2. Mở rộng không gian `32x24` và khử khoảng trống chết trên di động:
   - Cố định khung vẽ tỷ lệ `4:3` trước đây tạo mảng đen lớn phía trên bản đồ khi cầm dọc điện thoại và gây biến dạng nếu ép giãn bằng CSS khi xoay ngang.
   - Nhóm chuyển sang `Phaser.Scale.RESIZE` kết hợp `ResizeObserver` đồng bộ kích thước đệm điểm ảnh thực tế, đi cùng máy quay bám theo nhân vật với hệ số phóng đại nửa nguyên sắc nét từ `2x` đến `3.5x`. Bản đồ luôn phủ kín khung nhìn trên cả màn hình dọc lẫn ngang mà không méo điểm ảnh.
3. Nâng cấp chiều sâu chiến đấu và nhận diện 30 loài sinh vật:
   - Toàn bộ 30 loài được nâng lên khung `48x48` hai nhịp động có đổ bóng, bổ sung phân hạng độ hiếm và vai trò chiến đấu rõ ràng.
   - Sân đấu dựng 5 phông nền chân trời riêng cho từng vùng, bổ sung bảng ảnh hiệu ứng nguyên tố `vfx.png`, chuyển động lao tới khi ra đòn, chớp sáng kèm số sát thương nổi khi trúng đòn, quỹ đạo chuông cộng hưởng khi thu phục thành công hoặc bung ra và tùy chọn tốc độ hoạt ảnh trận đấu.
4. Nâng cấp cơ chế tiếng Anh từ gạch chân tĩnh sang thích ứng thực chất:
   - Trong `src/domain/learning.ts`, bộ tách từ ưu tiên khớp cụm nhiều từ dài nhất trước từ đơn, chọn đúng nghĩa của từ đa nghĩa dựa trên ngữ cảnh hội thoại và chọn biến thể câu thoại phù hợp với mức A1 đến B2 của người chơi.
   - Hồ sơ từ vựng tách riêng số lần bắt gặp thụ động (`exposures`) với mức độ thành thạo (`mastery`): nhìn thấy từ nhiều lần trong thoại tuyệt đối không tự cộng điểm thuộc từ. Bộ lập lịch tính độ ưu tiên gặp lại dựa trên số lần tra cứu, trạng thái lưu từ, khoảng cách thời gian và kết quả ôn tự nguyện để lồng ghép từ đó trở lại trong lời kể ở các điểm ngắm cảnh và bếp lửa trại.
5. Gia cố an toàn lưu trữ và cô lập bộ nhớ đệm ngoại tuyến:
   - `src/domain/save.ts` bổ sung bộ kiểm định sâu toàn bộ cấu trúc lồng nhau, giới hạn số học, biên tọa độ theo từng bản đồ và khóa ngoại đối chiếu trực tiếp với danh mục loài, chiêu thức, vật phẩm, nhiệm vụ và từ điển. Khi `localStorage` chứa bản cũ hơn phiên đang giữ trên bộ nhớ tạm do lỗi đầy bộ nhớ trước đó, `SaveRepository.load()` tự động ưu tiên bản trên bộ nhớ tạm để không mất tiến trình vừa chơi.
   - `public/sw.js` gắn danh sách tệp tiền nạp xác định ngay lúc đóng gói qua `scripts/inject-sw-manifest.ts`, chỉ xóa các bộ nhớ đệm mang tiền tố `lingowild-cache-` và trả mã lỗi `503` chuẩn cho yêu cầu JS, CSS hoặc ảnh thất bại khi mất mạng thay vì trả nhầm `index.html`.
6. Nâng cấp chuỗi công cụ và tách gọn mô-đun giao diện:
   - Nâng cấp `vite@8.4.0` và `vitest@5.1.2` để xử lý triệt để các cảnh báo bảo mật phụ thuộc (`npm audit` đạt 0 lỗ hổng).
   - Tách `src/ui/gameUi.ts` theo đúng trách nhiệm thực tế thành `battleView.ts`, `journalView.ts`, `uiHelpers.ts` và bộ điều phối `gameUi.ts` mà không sinh lớp trung gian rườm rà.
