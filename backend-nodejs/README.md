# Smart Parking Backend (Node.js + MongoDB)

## 1. Setup

1. Copy `.env.example` to `.env`.
2. Update `MONGODB_URI` to your MongoDB connection string.
3. Install dependencies:

```bash
npm install
```

## 2. Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## 3. Seed demo data

```bash
npm run seed
```

Demo accounts after seed:
- `admin / 123456`
- `user1 / 123456`
- `user2 / 123456`

## 4. Available APIs

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/vehicles?plate=&status=&limit=`
- `GET /api/parking-history?username=&userId=&status=&limit=`

## 5. Notes

- Current auth token is demo-only and not JWT yet.
- This backend is the first integration step to replace frontend mock data.
