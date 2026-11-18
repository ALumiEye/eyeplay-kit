// Né Sao — game mẫu nhỏ cho nhà phát triển muốn đưa game lên EyePlay.
// Chỉ dùng thứ EyePlay hỗ trợ trong khung cách ly: canvas, bàn phím, localStorage, requestAnimationFrame.
// Gọi SDK kiểu tuỳ chọn (window.EyePlay?.…) nên mở file này riêng vẫn chơi được bình thường.
(function () {
  'use strict';
  var BEST_KEY = 'ne-sao.best'; // khoá localStorage nên có tiền tố riêng của game
  var canvas = document.getElementById('game');
  if (!canvas) { // cover.html nạp file này chỉ để lấy hàm vẽ
    window.NeSao = { drawScene: function () { return drawScene.apply(null, arguments); } };
  }
  var ctx;
  var keys = {};
  var state;

  function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
  }

  function reset() {
    state = { x: canvas.width / 2, stars: [], t: 0, over: false, best: readBest(), startedAt: performance.now() };
  }

  function spawn() {
    state.stars.push({ x: Math.random() * canvas.width, y: -20, v: 160 + Math.random() * 120 + state.t * 6, r: 10 + Math.random() * 10 });
  }

  function finish() {
    state.over = true;
    var score = Math.floor(state.t * 10);
    if (score > state.best) {
      state.best = score;
      try { localStorage.setItem(BEST_KEY, String(score)); } catch (e) { /* bộ nhớ bị chặn: bỏ qua */ }
    }
    // Báo kết quả cho EyePlay (chỉ có khi chạy trên EyePlay).
    if (window.EyePlay) window.EyePlay.recordRun({ mode: 'thuong', score: score, timeMs: Math.round(state.t * 1000), finished: true });
  }

  function update(dt) {
    if (state.over) return;
    state.t += dt;
    var dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    state.x = Math.max(20, Math.min(canvas.width - 20, state.x + dir * 360 * dt));
    if (Math.random() < dt * (1.5 + state.t * 0.15)) spawn();
    for (var i = state.stars.length - 1; i >= 0; i--) {
      var s = state.stars[i];
      s.y += s.v * dt;
      if (s.y > canvas.height + 30) state.stars.splice(i, 1);
      else if (Math.hypot(s.x - state.x, s.y - (canvas.height - 30)) < s.r + 16) finish();
    }
  }

  // Vẽ một cảnh (sao + người chơi). cover.html dùng lại đúng hàm này để vẽ ảnh bìa.
  function drawScene(c, w, h, s) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f5c24a';
    s.stars.forEach(function (st) { c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#7fd4ff';
    c.fillRect(s.x - 16, h - 46, 32, 32);
  }

  function draw() {
    drawScene(ctx, canvas.width, canvas.height, state);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText('Điểm: ' + Math.floor(state.t * 10) + '   Cao nhất: ' + state.best, 16, 30);
    if (state.over) {
      ctx.font = '800 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Trúng sao! Space để chơi lại', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
    }
  }

  var last = performance.now();
  function frame(now) {
    update(Math.min(0.05, (now - last) / 1000));
    last = now;
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', function (e) {
    keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
    if (e.key === ' ' && state.over) reset();
    if (e.key === 'Escape' && window.EyePlay) window.EyePlay.exit(); // tuỳ chọn: về EyePlay
  });
  window.addEventListener('keyup', function (e) { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });

  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  reset();
  requestAnimationFrame(frame);
})();
