// Game hỏng cố ý để kiểm tra kit bắt đúng lỗi: gọi API ngoài, đọc cookie (lỗi trong khung cách ly).
fetch('https://api.example.com/score').catch(function () {});
var saved = document.cookie;
