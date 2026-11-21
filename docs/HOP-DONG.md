# Hợp đồng tích hợp EyePlay

Game chạy được trên EyePlay khi đáp ứng các điều dưới đây. Mã trong ngoặc vuông là mã mà `tools/verify.js` in ra.

## 1. Game chạy thế nào trên EyePlay

```
┌ play.alumieye.com/choi/<id> ───────────────────────────────┐
│ thanh EyePlay: logo · EyePlay › tên game · Phím ⛶ Kho game  │
├─────────────────────────────────────────────────────────────┤
│ <iframe sandbox>  ← game, chiếm phần còn lại của cửa sổ      │
└─────────────────────────────────────────────────────────────┘
```

- Game được phục vụ ở `https://play.alumieye.com/play/<id>/`, trong **iframe sandbox không có
  `allow-same-origin`** (`allow-scripts allow-pointer-lock allow-downloads allow-forms`).
- Trước khi người chơi bấm **▶ Chơi**, EyePlay giữ bàn phím: game chưa nhận phím nào. Enter / Space ở lúc đó bắt
  đầu chơi. Bấm Chơi xong, mọi phím vào game.
- Khung game đổi cỡ theo cửa sổ (thử ở 1280×716 và 900×516). Toàn màn hình do thanh EyePlay lo.

## 2. Bản build

- Một **thư mục tĩnh có `index.html` ở gốc** [INDEX], cùng JS / CSS / ảnh / âm thanh. Không cần server.
- **Đường dẫn tương đối** [ABSOLUTE_PATH]: `src="game.js"`, không `/game.js`. Vite: `base: './'`. Webpack:
  `publicPath: ''`.
- Loại file nhận [FILE_TYPE]: html, js, mjs, css, json, map, txt, md, xml, webmanifest; ảnh png, jpg, gif, webp,
  avif, svg, ico, bmp; âm thanh mp3, ogg, oga, wav, m4a, aac, flac, opus; video webm, mp4; font woff, woff2, ttf,
  otf; wasm, bin, glb, gltf, atlas, fnt, csv.
- Giới hạn: tối đa **20 MB** [TOO_BIG], **2000 file** [TOO_MANY_FILES], mỗi file **15 MB** [FILE_TOO_BIG]. Không
  symlink [SYMLINK].

## 3. Mạng

- **Mọi kết nối ra ngoài bị chặn** (CSP `connect-src 'self'`) [NETWORK], [EXTERNAL_RESOURCE]: không CDN, API,
  WebSocket, analytics, quảng cáo, ảnh / âm thanh / script từ trang khác. Đưa mọi thứ vào thư mục build.
- Đọc file trong chính thư mục build thì được: `fetch('data/level1.json')`.
- Ngoại lệ: font Google Fonts chỉ cảnh báo [GOOGLE_FONTS]; nên tải về nhúng (woff2).

## 4. Khung cách ly: có gì, không có gì

| Có | Không có (lỗi hoặc bị bỏ qua) |
|---|---|
| Canvas 2D, WebGL, WebGPU, Web Audio, `<audio>`, `<video>` | cookie [STORAGE_API] |
| Bàn phím, chuột, cảm ứng, gamepad, pointer lock | IndexedDB, Cache API [STORAGE_API] |
| `localStorage`, `sessionStorage` (EyePlay giả lập, lưu hộ) | service worker — EyePlay tắt [SERVICE_WORKER] |
| `requestAnimationFrame`, Web Worker, wasm | `alert` / `confirm` / `prompt` [DIALOG] |
| Fullscreen (qua thanh EyePlay) | popup, `window.open`, `top.location`, `parent.document` [TOP_ACCESS] |

- **Lưu dữ liệu bằng `localStorage`**. Đặt khoá có tiền tố là id game: `ne-sao.best`. Tối đa khoảng 2,5 triệu ký tự
  mỗi game. Người chơi tải / nạp file save được qua EyePlay.
- Thay `alert` bằng thông báo vẽ ngay trong game.
- Âm thanh: bắt đầu sau thao tác đầu tiên của người chơi (chính sách trình duyệt).

## 5. Ảnh bìa: `cover.html` (nên có) [COVER], [COVER_MISSING]

Trang `cover.html` cạnh `index.html`. EyePlay mở nó ở khung **1280×800** (không cách ly, không SDK), chờ
`window.coverReady = true` (tối đa 60 giây) rồi chụp làm ảnh bìa thẻ game và ảnh khi chia sẻ link.

- Vẽ bằng **chính code vẽ của game** (nạp cùng file JS), một cảnh đẹp nhất: nhân vật, trận đấu, bản đồ. Không
  menu, không HUD. Có thể thêm tên game thật to.
- Trang chiếm đúng 1280×800. Vẽ xong (ảnh, font đã tải) thì đặt `window.coverReady = true`.
- Không gọi mạng. Xem mẫu: `examples/ne-sao/cover.html`.

## 6. SDK EyePlay (tuỳ chọn)

EyePlay tự chèn SDK vào game khi đăng — **đừng nhúng file SDK**. Chạy riêng thì không có `window.EyePlay`, nên
luôn gọi kiểu tuỳ chọn:

```js
// Hết một ván: lưu kết quả (hiện ở trang game; dùng cho bảng xếp hạng). mode trùng id trong eyeplay.json "rankedModes".
// seed (tuỳ chọn, số nguyên 0…4294967295): ván dựng từ seed thì gửi kèm, để EyePlay tạo link thách đấu (xem dưới).
window.EyePlay?.recordRun({ mode: 'thuong', score: 1250, timeMs: 178400, finished: true, seed: 123456 });
// Về trang chủ EyePlay (vd. mục "Thoát" trong menu game).
window.EyePlay?.exit();
// Tải một ảnh (Blob, vd. ảnh khoe thành tích vẽ bằng canvas) về máy người chơi. EyePlay đặt tên chung cho mọi game
// record-<id>-<lúc bấm>.png và tải hộ (game cách ly không tự tải file được). imageName() trả về đúng tên đó.
window.EyePlay?.saveImage(blob);
// Đang chạy trên EyePlay không?
if (window.EyePlay) { /* … */ }
```

**Ván thi contest** (chỉ game theo hợp đồng replay, `docs/REPLAY.md`): `recordRun` gửi thêm thao tác để server chơi
lại và kiểm điểm.

```js
window.EyePlay?.recordRun({
  mode: 'daily', score: 6463, timeMs: 200850, seed: 3486083199,
  finished: true,        // false = ván chốt giữa chừng (xem dưới)
  rules: 'eyemerge@1',   // phiên bản luật (đổi khi luật đổi)
  endTick: 12051,        // số bước cố định lúc ván chốt
  inputs: 'Ga4lNMMS…'    // thao tác đã nén (base64), do lõi session của game ghi
});
```

- **Xếp hạng trong contest, chung mọi game**: `score` cao hơn thắng → bằng điểm thì `timeMs` ngắn hơn → bằng nữa thì
  **số lần thử** ít hơn (lần nộp thứ mấy thì đạt ván đó; server tự đếm). `score` là **một số nguyên, càng cao càng
  tốt**, được âm. Game "về đích nhanh nhất thắng" thì đặt `score` = mức hoàn thành (vd. 1 nếu về đích, 0 nếu không), thời
  gian đã nằm ở `timeMs`.
- **Ván dở**: ván đang chơi dở (checkpoint để chơi tiếp) **chỉ lưu trên máy**, không gửi. Chỉ gửi khi ván **chốt**: chơi
  tới hết (`finished: true`), hoặc chốt giữa chừng (`finished: false`): game có resume thì khi người chơi chọn "Chơi
  lại", game không resume thì khi thoát giữa ván. Mỗi lần gửi là một lần thử.

**Thành tích trên máy người chơi** (chung cho mọi game): EyePlay chỉ giữ **ván tốt nhất mọi thời gian của từng
chế độ** (điểm cao hơn trước, bằng điểm thì nhanh hơn) và **các ván hôm nay**; sang ngày mới lịch sử về rỗng, kỷ lục
vẫn còn. Trang game trên EyePlay hiện hai phần đó và có nút **Khoe kỷ lục** (ảnh + lời thách, chỉ chia sẻ kỷ lục).
Game tự lưu thành tích riêng thì nên theo cùng luật, và nên có nút chia sẻ ngay ở màn kết quả (ván vừa chơi).

**Trang game trên EyePlay dùng một mẫu chung cho mọi game:** cột trái là thẻ giới thiệu (ảnh bìa, tên, nút Chơi, `about`)
rồi thẻ **Mẹo chơi** (`tips`, đóng sẵn, bấm mới mở); cột phải là **Thành tích của bạn** → **Xếp hạng** → **Điều khiển**.
Bạn chỉ điền nội dung trong `eyeplay.json`, không tự làm trang.

Trong `eyeplay.json` (tuỳ chọn):
- `"unit"` trong mỗi chế độ của `rankedModes`: đơn vị của `score` khi hiện (vd. `"m"`); không có thì là "điểm".
- `"challenge"`: link thách đấu khi khoe kỷ lục, `{ "seed": "s", "seedRadix": 36, "score": "diem", "name": "ten" }` =
  tên tham số game đọc từ `/choi/<id>/?s=…&diem=…&ten=…` để người nhận chơi đúng ván đó (cùng seed) và thấy điểm cần
  vượt. Chỉ dùng khi ván có `seed`. Game đọc tham số từ trang EyePlay (`window.top.location.search`), vì iframe game
  không mang theo query của trang.

**Contest và bảng xếp hạng chung (tuỳ chọn):** muốn game có contest (đề chung, xếp hạng toàn server, rating) thì game
phải theo **hợp đồng replay** `docs/REPLAY.md`: logic ván và replay là một nguồn, tất định trên mọi máy, xuất
`dist/replay.mjs`. Không làm thì game vẫn đăng được, chỉ có kỷ lục trên máy.

## 7. Hiển thị

- **Giữ đúng màu của game**: thêm `<meta name="color-scheme" content="only light" />` (game màu tối: `only dark`) vào
  `<head>` của `index.html` và `cover.html`. Không có thì Auto Dark Mode của Chrome / Edge (hay bật trên Windows) tự
  đảo màu game. SDK EyePlay cũng chặn hộ, nhưng game nên tự khai báo.

- Game tự co theo cửa sổ [FIT], [FIT_SMALL]: canvas theo `innerWidth/innerHeight` hoặc CSS `max-width/max-height:
  100%`, `overflow: hidden`. Không để người chơi phải cuộn.
- Không thêm logo / nút / thanh "EyePlay" vào game: thanh EyePlay đã có.
- Chơi được trên điện thoại thì đặt `"touch": true` trong eyeplay.json và thử `verify` (nó chạy thêm `--touch`).
  Không thì điện thoại hiện "Game cần bàn phím".

## 8. Nội dung và quyền

- Phù hợp mọi lứa tuổi. Không dùng hình, nhạc, nhân vật có bản quyền của người khác.
- **Không dùng nhận diện ALumiEye** (logo con mắt trong tam giác, Lumi, bảng màu kem/tím/cam của ALumiEye).
- Bạn giữ bản quyền game. Khi nộp, bạn cho phép ALumiEye phát hành game miễn phí trên EyePlay và gỡ game khi vi phạm.
