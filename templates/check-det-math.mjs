#!/usr/bin/env node
/**
 * check-det-math.mjs: chạy SAU khi build game có contest (docs/REPLAY.md, mục 3).
 *
 *   node check-det-math.mjs dist              # thư mục build (quét mọi .js / .mjs / .html bên trong)
 *
 * Kiểm hai điều trong bản build:
 *   1. det-math có mặt (có dòng thay Math.sin).
 *   2. Ở MỌI file có thư viện chép sẵn Math.sin / cos / atan2 vào biến riêng (planck làm vậy lúc nạp:
 *      `var math_sin = Math.sin;`), det-math phải chạy TRƯỚC chỗ chép đó.
 * Lỗi hay gặp: bundler (Vite, Rollup…) tách thư viện vật lý sang một chunk khác; chunk đó được import nên CHẠY TRƯỚC
 * phần thân file chính, nên det-math nạp ở file chính không còn tác dụng trong trình duyệt (test trên Node vẫn qua).
 * Cách sửa: `import "./det-math.js"` ngay ở đầu file import thư viện vật lý.
 *
 * Mã thoát 0 = đạt, 1 = chưa đạt.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("Dùng: node check-det-math.mjs <thư-mục-build>");
  process.exit(1);
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(m?js|html)$/.test(name) ? [full] : [];
  });
}

// Thay: `Math.sin = <hàm>` (det-math). Chép: `= Math.sin,` / `= Math.sin;` (thư viện giữ bản gốc vào biến riêng).
const PATCH = /Math\.sin\s*=\s*[\w$]/;
const COPY = /=\s*Math\.(sin|cos|atan2)\s*[,;)]/;

let patched = 0;
let bad = 0;
for (const file of files(root)) {
  const text = readFileSync(file, "utf8");
  const patch = text.search(PATCH);
  const copy = text.search(COPY);
  if (patch >= 0) patched += 1;
  if (copy >= 0 && (patch < 0 || patch > copy)) {
    bad += 1;
    console.error(`✗ ${file}: thư viện chép Math.sin / cos / atan2 TRƯỚC khi det-math thay chúng.`);
    console.error(`  sửa: import "./det-math.js" ở dòng đầu của file import thư viện vật lý (không chỉ ở file chính).`);
  }
}
if (!patched) {
  console.error(`✗ ${root}: không thấy det-math trong bản build (không có dòng thay Math.sin).`);
  console.error(`  sửa: chép templates/det-math.js vào game và import nó trước mọi thư viện / luật game.`);
  process.exit(1);
}
if (bad) process.exit(1);
console.log(`✓ det-math có trong bản build và chạy trước mọi thư viện chép Math.sin (${patched} file).`);
