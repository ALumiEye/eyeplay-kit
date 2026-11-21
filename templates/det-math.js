/**
 * det-math.js: Math.sin / Math.cos / Math.atan2 cho ra CÙNG TỪNG BIT trên mọi bộ máy JS (V8 của Chrome / Node / server
 * EyePlay, JavaScriptCore của Safari / mọi trình duyệt iPhone). Dùng cho game có contest (docs/REPLAY.md).
 *
 * Cách dùng: chép file này vào game, rồi `import "./det-math.js";` ở DÒNG ĐẦU của file nào import thư viện vật lý
 * (planck, matter-js…) hoặc dùng sin / cos / atan2 trong luật game. Sau khi build, chạy templates/check-det-math.mjs.
 * Không sửa nội dung file: mọi game và server phải dùng đúng các con số này.
 *
 * Deterministic Math.sin / Math.cos / Math.atan2: the same bits in every JS engine.
 *
 * Why: the test on a phone (2026-11-21) matched Node on only 3/12 samples, exactly the ones rejected before any
 * physics ran. IEEE 754 fixes + - * / and sqrt to the last bit, but not sin / cos / atan2: V8 and JavaScriptCore
 * may differ in the last bit, and physics turns that into a different game. planck calls these every step.
 *
 * These versions use only + - * / and Math.round (all exactly specified), following fdlibm's polynomials
 * (Sun Microsystems, freely distributable). Accuracy is about 1 ulp, plenty for physics; what matters is that
 * every engine computes the same number.
 *
 * Import this module FIRST (before planck / sim.ts): planck copies Math.sin etc. into local variables when it
 * loads, so patching later has no effect. main.ts and replay.ts import it on their first line.
 * Same file as replay-audit/src/det-math.ts (tested on iPhone 11 Pro Max: 12/12 replays match Node).
 */

// --- sin / cos: reduce x to r in [-π/4, π/4] with x = n·π/2 + r, then a polynomial ---
const INV_PIO2 = 6.36619772367581382433e-1;
// π/2 split into three parts with 33 significant bits each, so n·PIO2_1 and n·PIO2_2 are exact for |n| < 2^20.
const PIO2_1 = 1.57079632673412561417e0;
const PIO2_2 = 6.07710050650619224932e-11;
const PIO2_3 = 2.02226624879595063154e-21;

const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6, S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7, C5 = 2.08757232129817482790e-9, C6 = -1.13596475577881948265e-11;

function kSin(x) {
  const z = x * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x + z * x * (S1 + z * r);
}

function kCos(x) {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (1 - w - hz + z * r);
}

/** Quadrant n (0..3) and remainder r. */
function reduce(x) {
  const n = Math.round(x * INV_PIO2);
  const r = x - n * PIO2_1 - n * PIO2_2 - n * PIO2_3;
  return [((n % 4) + 4) % 4, r];
}

export function detSin(x) {
  if (!Number.isFinite(x)) return NaN;
  const [q, r] = reduce(x);
  return q === 0 ? kSin(r) : q === 1 ? kCos(r) : q === 2 ? -kSin(r) : -kCos(r);
}

export function detCos(x) {
  if (!Number.isFinite(x)) return NaN;
  const [q, r] = reduce(x);
  return q === 0 ? kCos(r) : q === 1 ? -kSin(r) : q === 2 ? -kCos(r) : kSin(r);
}

// --- atan / atan2 (fdlibm s_atan.c, e_atan2.c) ---
const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800e0];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
];
const PI = 3.14159265358979311600e0;
const PI_LO = 1.22464679914735317720e-16;

export function detAtan(v) {
  if (Number.isNaN(v)) return NaN;
  const negative = v < 0;
  let x = negative ? -v : v;
  if (x >= 7.37869762948382064640e19) return negative ? -ATAN_HI[3] - ATAN_LO[3] : ATAN_HI[3] + ATAN_LO[3];
  let id = -1;
  if (x < 0.4375) {
    if (x < 7.450580596923828e-9) return v;
  } else if (x < 1.1875) {
    if (x < 0.6875) {
      id = 0;
      x = (2 * x - 1) / (2 + x);
    } else {
      id = 1;
      x = (x - 1) / (x + 1);
    }
  } else if (x < 2.4375) {
    id = 2;
    x = (x - 1.5) / (1 + 1.5 * x);
  } else {
    id = 3;
    x = -1 / x;
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) {
    const r = x - x * (s1 + s2);
    return negative ? -r : r;
  }
  const r = ATAN_HI[id] - (x * (s1 + s2) - ATAN_LO[id] - x);
  return negative ? -r : r;
}

export function detAtan2(y, x) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    // Infinities (never in a sane game), with the IEEE results, so even these are the same everywhere.
    const half = ATAN_HI[3] + ATAN_LO[3];
    const sy = y < 0 || Object.is(y, -0) ? -1 : 1;
    if (!Number.isFinite(y)) return sy * (x === Infinity ? half / 2 : x === -Infinity ? (3 * half) / 2 : half);
    return x === Infinity ? sy * 0 : sy * (PI + PI_LO);
  }
  if (y === 0) {
    const xNeg = x < 0 || Object.is(x, -0);
    return xNeg ? (Object.is(y, -0) ? -PI - PI_LO : PI + PI_LO) : y;
  }
  if (x === 0) return y > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
  const t = detAtan(Math.abs(y / x));
  if (x > 0) return y > 0 ? t : -t;
  return y > 0 ? PI - (t - PI_LO) : t - PI_LO - PI;
}

Math.sin = detSin;
Math.cos = detCos;
Math.atan2 = detAtan2;
