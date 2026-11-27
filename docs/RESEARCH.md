# Nghiên cứu và thiết kế LingoWild

## Quyết định sản phẩm
Game-first, learning-second. RPG 2D thu phục sinh vật, chơi đơn offline, tiếng Anh trong ngữ cảnh, hỗ trợ tiếng Việt theo nhu cầu. Không bắt buộc làm bài để bắt sinh vật, không phạt vì sai ngôn ngữ. Tên sản phẩm tạm thời.

## Khảo sát nền tảng
- https://github.com/devshareacademy/monster-tamer: ứng viên Phaser 3, MIT cho code theo thông tin khảo sát ban đầu. Kiểm tra chính xác URL, commit, LICENSE, nguồn từng asset và khả năng build trước khi nhập code. Nếu không đạt, chỉ tái sử dụng kỹ thuật và dùng template Phaser.
- https://github.com/phaserjs/template-vite-ts: ứng viên nền TypeScript/Vite; kiểm tra license và phiên bản.
- https://github.com/pokeclicker/pokeclicker: tham khảo collection và progression, không ưu tiên vì thiên về idle.
- https://github.com/pagefaultgames/pokerogue: tham khảo chiến đấu và replayability, không ưu tiên vì phạm vi roguelike và tài nguyên thương hiệu.
- https://github.com/Tuxemon/Tuxemon: tham khảo game design và asset có giấy phép phù hợp; không port Python sang web.
- https://kenney.nl/assets: tìm tileset CC0, xác minh từng gói.
- https://tatoeba.org: câu ví dụ có attribution theo license từng nguồn; không nhập hàng loạt chưa kiểm duyệt.
- https://github.com/rspeer/wordfreq: tham khảo tần suất, kiểm tra giấy phép code và data riêng.
Không coi các URL trên là chứng nhận quyền sử dụng. Tạo bảng audit theo commit, license code, asset, build, chất lượng, chi phí tích hợp. Không sao chép Pokémon sprites, nhạc, bản đồ hoặc logo. Dùng sinh vật nguyên bản; ghi rõ nguồn và attribution.

## Gameplay
Vòng lặp: khám phá, gặp sinh vật, quan sát/chiến đấu, thu phục, xây đội hình, mở khu vực. Chiến đấu theo lượt có hệ tương khắc, trạng thái, vật phẩm, flee. Có nhiệm vụ chính, NPC, bí mật, ngày đêm đơn giản, sổ sinh vật. Người chơi chọn hành động bằng UI rõ ràng. Tiếng Anh nằm trong hội thoại, mô tả chiêu, nhật ký, manh mối và vật phẩm. Tap từ để gloss tiếng Việt, phát âm nếu thiết bị hỗ trợ, lưu từ tự nguyện. Không chặn tiến trình do thiếu từ vựng. Có chế độ trợ giúp đầy đủ. Không tự bật quiz giữa combat. Ôn từ tùy chọn tại trại; tái xuất hiện từ trong ngữ cảnh mới theo mức độ nhớ. Không coi CEFR tự gán là chứng nhận năng lực.

## Phạm vi release 1.0 đề xuất
4 vùng liên kết, 1 hub, 30 sinh vật gồm các dạng tiến hóa, 3 starter, 40 chiêu, 15 NPC, 12 nhiệm vụ có kết thúc, 3 boss, 300 mục từ đã kiểm duyệt, 150 đoạn hội thoại có ngữ cảnh, A1-B2 có cấu hình, 60-120 phút tuyến chính mục tiêu. Không bơm nội dung lặp để đạt số lượng. Kiểm tra thực tế và báo cáo số liệu, không tuyên bố thời lượng chưa đo. Multiplayer, tài khoản, giao dịch, LLM runtime ngoài phạm vi.

## Kiến trúc đề xuất
Phaser 3, TypeScript strict, Vite, DOM/CSS cho menu và glossary nếu phù hợp, IndexedDB hoặc localStorage có schema version, Vitest, Playwright. Static deploy GitHub Pages, base path đúng repo, offline sau tải tài nguyên nếu service worker đáng tin. Game domain độc lập renderer: battle, capture, inventory, progression, quests, learning, save. Data schema validate tại build. RNG có seed cho test, không dùng network để giải quyết combat. Save export/import có kiểm tra size/schema và rollback. Tránh framework hoặc backend không cần thiết. Web Speech API fallback text khi không có voice.

## Art direction
Pixel art top-down thống nhất palette rừng xanh rêu, đất nung, kem giấy, nước xanh. Menu kiểu sổ thực địa, HUD nhỏ, combat tập trung vào sinh vật. Không dashboard SaaS, gradient tím, glassmorphism, card lặp, icon emoji thay sprite. Touch controls, keyboard remap nếu khả thi, contrast, giảm chuyển động, âm lượng riêng. Không dùng hình AI hàng loạt thiếu nhất quán. Audit asset nguồn và quyền sử dụng.

## Nghiên cứu giáo dục
Giả thuyết: tiếp xúc lặp lại trong ngữ cảnh, hỗ trợ nghĩa đúng lúc và retrieval tự nguyện giúp tăng khả năng nhớ. Không tuyên bố hiệu quả thực nghiệm cho game khi chưa đo. Đánh giá khả dụng bằng playtest, kiểm tra người chơi hoàn thành nhiệm vụ không dùng quiz, đo số lần hỗ trợ và khảo sát tự nguyện. Bảo vệ dữ liệu local, không telemetry mặc định.

## Cổng nghiệm thu
G0 audit upstream + build spike; G1 vertical slice hoàn chỉnh; G2 combat/capture/save; G3 quest và world; G4 learning/content; G5 art/audio/accessibility; G6 regression, deployment, bàn giao. Mỗi cổng cần test thực chạy, ghi lỗi còn lại. Không tuyên bố release-ready nếu chỉ build được. Kiểm tra mobile, keyboard, reload, corrupted save, storage full, audio disabled, route progression, capture probability, type balance, repeated interactions, missing assets, console errors. Đo thời gian load và FPS trên môi trường ghi rõ. Test chơi hết tuyến chính, quay video/screenshot nếu môi trường cho phép. README có lệnh chạy, hướng dẫn, credits và giới hạn. Không merge/push trực tiếp main khi triển khai; tạo branch riêng và PR.
