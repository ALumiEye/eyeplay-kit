---
name: eyeplay-game
description: Làm game trình duyệt mới hoặc đưa game có sẵn lên EyePlay (play.alumieye.com) - chọn công cụ, cấu trúc build tĩnh, chạy trong iframe sandbox, lưu localStorage, gọi SDK window.EyePlay, vẽ ảnh bìa cover.html, tạo eyeplay.json và chạy tools/verify.js tới khi ĐẠT. Dùng khi người dùng muốn làm game cho EyePlay, đưa game lên EyePlay, sửa game để tương thích EyePlay, hoặc nhắc tới eyeplay-kit, eyeplay.json, cover.html.
---

# Làm game cho EyePlay

Thư mục kit (`eyeplay-kit/`) là thư mục cha hai cấp của file này. Đọc `AGENTS.md` và `docs/HOP-DONG.md` của kit
trước. Đích đến: `node <kit>/tools/verify.js <dự-án>` in `KẾT QUẢ: ĐẠT`.

## 1. Chọn hướng

- **Game mới, đơn giản (2D, ít file)**: chép `examples/ne-sao/` của kit làm điểm bắt đầu. JS thuần + Canvas, không
  cần build: thư mục dự án chính là thư mục build (`"build": "."`).
- **Game mới, lớn hơn**: chọn công cụ hợp game (Vite + TypeScript, Phaser, PixiJS, Three.js…). Đặt `base: './'`
  (Vite) để đường dẫn tương đối. Build ra `dist/` (`"build": "dist"`).
- **Game có sẵn**: giữ công cụ hiện có. Chạy `verify` ngay để thấy cần sửa gì, rồi sửa theo từng dòng `✗`.

Hỏi người dùng ý tưởng game nếu chưa rõ (thể loại, cách điều khiển, chơi trên điện thoại không). Đừng hỏi chuyện kỹ
thuật mà kit đã quyết.

## 2. Những điều phải làm đúng ngay từ đầu

- **Co theo khung**: game chiếm trọn cửa sổ của iframe, tự co khi cửa sổ đổi cỡ, không thanh cuộn
  (`html, body { margin:0; height:100%; overflow:hidden }`, canvas theo `innerWidth/innerHeight` hoặc giữ tỷ lệ và
  căn giữa). Chữ trong game đọc được ở khung 900×516.
- **Lưu bằng localStorage**, khoá có tiền tố `<id>.` (vd. `ne-sao.best`). Bọc `try/catch` khi đọc/ghi.
- **Không** cookie, IndexedDB, service worker, `alert/confirm/prompt`, `window.open`, `top.location`, CDN, API.
  Thư viện (Phaser, Three…) cài qua npm và đóng gói vào build, **không** nạp từ CDN. Font: nhúng file woff2.
- **Âm thanh** bắt đầu sau thao tác đầu tiên (phím / chuột / chạm).
- **Có cách bắt đầu bằng bàn phím** (Enter / Space) và bằng chuột. Màn chơi nên có tạm dừng (Esc / P).
- **Không** vẽ logo / thanh / nút EyePlay; **không** dùng logo, Lumi, màu của ALumiEye.

## 3. SDK (tuỳ chọn nhưng nên có)

```js
// Hết một ván:
window.EyePlay?.recordRun({ mode: 'thuong', score, timeMs, finished: true });
// Mục "Thoát" trong menu:
window.EyePlay?.exit();
```

Game có xếp hạng: khai báo `rankedModes` trong eyeplay.json, `id` trùng `mode` khi gọi `recordRun`. Không nhúng
file SDK — EyePlay tự chèn.

## 4. Ảnh bìa `cover.html`

Trong thư mục build, cạnh `index.html`. Khung 1280×800, nạp **chính file JS vẽ của game**, dựng một cảnh đẹp cố định
(không menu / HUD), thêm tên game to, vẽ xong đặt `window.coverReady = true`. Để dùng lại hàm vẽ, tách code vẽ khỏi
vòng lặp game (xem `examples/ne-sao/game.js`: `drawScene` dùng chung cho game và bìa). Game dùng bundler: thêm
`cover.html` làm một trang vào cấu hình build (Vite: `build.rollupOptions.input`).

## 5. eyeplay.json

Chép `<kit>/templates/eyeplay.json` vào gốc dự án, điền mọi trường (giải thích ngay trong file mẫu, mục `_help`).
`playtest.keys`: các phím để `verify` bấm thử sau khi bấm Chơi — đặt đúng phím vào trận của game (vd.
`["Enter", "ArrowRight", "Space"]`).

## 6. Kiểm tra — lặp tới khi ĐẠT

```bash
<lệnh build của game>          # nếu có
node <kit>/tools/verify.js .   # trong thư mục dự án
```

- Sửa mọi `✗`. Xem từng `!` và sửa nếu áp dụng (cảnh báo `[NETWORK]` từ chuỗi có sẵn trong thư viện thì bỏ qua được).
- `[ALIVE]` cảnh báo: game không đổi hình khi bấm phím → kiểm tra `playtest.keys` hoặc game bị đứng trong khung cách ly.
- **Mở ảnh** `eyeplay-shots/01-waiting.png … 05-cover.png` và nhìn. Ảnh trống / vỡ / chữ bị cắt là chưa xong.

## 7. Xong

Báo người dùng: kết quả `verify`, ảnh bìa, những gì đã làm. Hỏi có muốn nộp không → skill `eyeplay-submit`.
