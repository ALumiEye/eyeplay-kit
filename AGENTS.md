# eyeplay-kit — hướng dẫn cho trợ lý AI

Bạn đang giúp một nhà phát triển **làm game (hoặc đưa game có sẵn) lên EyePlay** — kho game chơi ngay trên trình
duyệt tại https://play.alumieye.com. File này là điểm bắt đầu. Đọc hết trước khi làm.

## Mục tiêu duy nhất

Lệnh sau in **`KẾT QUẢ: ĐẠT`** (mã thoát 0):

```bash
node <đường-dẫn-tới>/eyeplay-kit/tools/verify.js <thư-mục-dự-án-game>
```

`verify` đọc `eyeplay.json` ở gốc dự án game, kiểm tra tĩnh thư mục build, rồi **chơi thử game trong một EyePlay
thu nhỏ** (khung cách ly, chặn mạng, SDK thật) và chụp ảnh. Chưa ĐẠT thì sửa theo dòng `sửa:` của từng `✗` rồi chạy
lại. Thêm `--json` nếu muốn đọc kết quả bằng máy.

## Làm theo thứ tự

1. **Cài kit một lần**: trong thư mục `eyeplay-kit` chạy `npm install` (chỉ cài `playwright-core`). Cần Node 22+
   và **Google Chrome**.
2. **Đọc hợp đồng** `docs/HOP-DONG.md`: những gì game được / không được làm trên EyePlay. Ngắn, đọc hết.
3. **Làm game** (hoặc sửa game có sẵn) theo skill `skills/eyeplay-game/SKILL.md`. Công cụ tuỳ game: JS thuần +
   Canvas, Phaser, PixiJS, Three.js, Vite… đều được, miễn ra **một thư mục build tĩnh có `index.html`**.
4. **Tạo `eyeplay.json`** ở gốc dự án: chép `templates/eyeplay.json` rồi điền. `"build"` trỏ tới thư mục build.
5. **Thêm `cover.html`** vào thư mục build (ảnh bìa 1280×800 vẽ bằng code của game). Xem hợp đồng, mục Ảnh bìa.
6. **Build** game, rồi **chạy `verify`** tới khi ĐẠT.
7. **Mở các ảnh chụp** mà `verify` in ra (`eyeplay-shots/*.png`) và **nhìn**: màn chờ, đang chơi, khung nhỏ, ảnh
   bìa. Đạt kiểm tra chưa có nghĩa là đẹp — nếu ảnh trống, vỡ bố cục hoặc chữ bị cắt thì sửa tiếp.
8. **Nộp**: theo skill `skills/eyeplay-submit/SKILL.md` (zip thư mục build + `eyeplay.json`).

## Quy tắc cứng (vi phạm là không đăng được)

- Chỉ dùng file trong thư mục build, **đường dẫn tương đối** (`src="game.js"`, không `/game.js`). Vite: `base: './'`.
- **Không gọi mạng ra ngoài**: không CDN, API, analytics, quảng cáo, ảnh/âm thanh từ trang khác.
- Game chạy trong **iframe sandbox không có allow-same-origin**: không cookie, IndexedDB, Cache API, service worker,
  `alert/confirm/prompt`, popup, `top.location`. **Lưu dữ liệu bằng `localStorage`** (EyePlay lưu hộ).
- Tối đa 20 MB, 2000 file, mỗi file 15 MB.
- **Không dùng nhận diện của ALumiEye**: logo con mắt trong tam giác, nhân vật Lumi, bảng màu kem/tím/cam của
  ALumiEye là của ALumiEye. Game mẫu `eyepalace` dùng chúng vì là game của ALumiEye — **đừng chép phần đó**.
- Nội dung phù hợp mọi lứa tuổi, không dùng hình / nhạc / nhân vật có bản quyền của người khác.

## Mẫu để học

- `examples/ne-sao/` — game nhỏ nhất đạt mọi yêu cầu (Canvas 2D, bàn phím, localStorage, SDK, cover.html,
  eyeplay.json). Bắt đầu từ đây nếu làm game mới.
- **eyepalace** (https://github.com/ALumiEye/eyepalace) — game đầy đủ của ALumiEye (thủ thành, nhiều file, lưu
  game, thành tựu, cover.html). Học cách tổ chức code, vẽ, lưu dữ liệu, ảnh bìa. **Không chép**: logo/Lumi/màu
  ALumiEye, service worker `sw.js` (EyePlay tắt nó), phần GitHub Pages/Release (không bắt buộc với bạn).

## Công cụ

| Lệnh | Làm gì |
|---|---|
| `node tools/verify.js <dự-án>` | **Dùng lệnh này.** eyeplay.json + kiểm tra tĩnh + chơi thử |
| `node tools/check.js <build>` | Chỉ kiểm tra tĩnh (nhanh, không cần Chrome) |
| `node tools/playtest.js <build> --id <id>` | Chỉ chơi thử. `--keys Enter,Space,ArrowUp` nếu game cần phím khác để vào trận; `--touch` thử trên điện thoại; `--headed` để xem trình duyệt |

Mọi lệnh: không hỏi gì, in `✓ / ✗ / !` kèm mã (`[NETWORK]`, `[ABSOLUTE_PATH]`…) và dòng `sửa:`; `--json` cho máy đọc.
Mã thoát 0 = đạt, 1 = chưa đạt, 2 = gọi sai / thiếu Chrome.

## Đừng

- Đừng sửa file trong `eyeplay-kit/` để cho qua kiểm tra. Sửa game.
- Đừng tự nhúng SDK EyePlay: EyePlay tự chèn khi đăng. Trong game chỉ gọi kiểu tuỳ chọn `window.EyePlay?.…`.
- Đừng thêm nút / logo / thanh "EyePlay" vào game: EyePlay đã có thanh riêng phía trên.
