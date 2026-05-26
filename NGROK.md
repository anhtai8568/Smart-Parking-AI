# Chạy ngrok cho thanh toán SePay

## 1. Khởi động backend

```bash
cd backend-nodejs
npm run dev
```

## 2. Chạy ngrok

```bash
ngrok http --domain=snoring-thud-animate.ngrok-free.dev 4000
```

## 3. Webhook SePay

Cấu hình trong dashboard SePay:

```
https://snoring-thud-animate.ngrok-free.dev/api/sepay/webhook
```

> Phương thức: `POST` — Xác thực: không
