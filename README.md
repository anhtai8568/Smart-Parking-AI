# Smart Parking AI — Hướng dẫn chạy dự án

## Tổng quan kiến trúc

Dự án gồm **3 service** cần chạy đồng thời:

| Service | Công nghệ | Port |
|---|---|---|
| Backend API | Node.js + Express + MongoDB | 4000 |
| AI Server | Python + FastAPI + YOLO | 8000 |
| Frontend | React + Vite | 5173 |

```
DA/Smart-Parking-AI/
├── backend-nodejs/          ← Node.js API server
├── ai-server-python/        ← Python AI server (nhận diện biển số)
├── frontend-react/          ← React app
└── .venv/                   ← Python virtual environment
```

---

## Cách 1: Chạy kết hợp Docker & Chạy Local (Khuyên dùng)

Phương pháp này sử dụng Docker để chạy nhanh **Backend (Node.js)** và **MQTT Broker (Mosquitto)**, đồng thời chạy **Frontend (React)** và **AI Server (Python)** trực tiếp ở máy thật (local) để tối ưu hiệu năng, tránh lỗi thư viện native (như Rolldown) và giúp AI Server truy cập trực tiếp vào Webcam máy tính.

### Yêu cầu chuẩn bị
- Đã cài đặt **Docker Desktop**: https://www.docker.com/products/docker-desktop/
- Đã cài đặt **Node.js** (v20 trở lên) và **Python** (v3.10 trở lên) trên máy thật.

### Hướng dẫn khởi chạy

Bạn cần chạy các phần sau:

#### 1. Chạy Backend & MQTT (Sử dụng Docker)
1. Khởi động ứng dụng **Docker Desktop**.
2. Mở terminal tại thư mục gốc của dự án (`d:\Đồ án liên ngành`) và chạy lệnh:
   ```powershell
   docker-compose up --build -d
   ```
   *(Lệnh này chạy ngầm Backend tại cổng `4000` và MQTT Broker tại cổng `1883`)*

#### 2. Chạy Frontend (Local)
1. Mở một terminal mới tại thư mục `frontend-react`:
   ```powershell
   cd frontend-react
   npm install
   npm run dev
   ```
   *(Frontend sẽ chạy tại cổng `5173`)*

#### 3. Chạy AI Server (Local để dùng Webcam)
1. Mở một terminal mới tại thư mục gốc của dự án.
2. Kích hoạt môi trường ảo Python và chạy AI Server:
   ```powershell
   .venv\Scripts\Activate.ps1
   cd ai-server-python
   python main.py
   ```
   *(AI Server sẽ chạy tại cổng `8000` và kết nối trực tiếp đến webcam)*

### Địa chỉ truy cập
- **Giao diện Web**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000`
- **AI Server Docs**: `http://localhost:8000/docs`

---

## Cách 2: Chạy dự án thủ công (Không dùng Docker)

## A. Lần đầu cài đặt (chưa có gì)

### A1. Cài đặt các công cụ cần thiết

1. **Node.js** (v18 trở lên): https://nodejs.org/en/download  
   Sau khi cài, kiểm tra:
   ```powershell
   node -v
   npm -v
   ```

2. **Python** (v3.10 trở lên): https://www.python.org/downloads  
   Khi cài trên Windows, **tích chọn "Add Python to PATH"**.  
   Sau khi cài, kiểm tra:
   ```powershell
   python --version
   ```

3. **Git** (nếu chưa có): https://git-scm.com/downloads

---

### A2. Cài đặt Backend (Node.js)

Mở terminal, chạy lần lượt:

```powershell
cd "e:\Đồ án liên ngành\DA\Smart-Parking-AI\backend-nodejs"
npm install
```

Kiểm tra file `.env` (đã có sẵn, không cần sửa nếu dùng database chung):

```powershell
cat .env
```

Seed dữ liệu mẫu (chỉ cần làm **một lần**):

```powershell
npm run seed
```

Tài khoản mẫu sau khi seed:
- `admin / 123456`
- `user1 / 123456`
- `user2 / 123456`

---

### A3. Cài đặt AI Server (Python)

Tạo và kích hoạt virtual environment (chỉ làm **một lần**):

```powershell
cd "e:\Đồ án liên ngành\DA\Smart-Parking-AI"
python -m venv .venv
.venv\Scripts\Activate.ps1
```

> **Nếu bị lỗi "execution policy"**, chạy lệnh này trước rồi thử lại:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

Cài đặt các thư viện Python:

```powershell
pip install fastapi "uvicorn[standard]" opencv-python numpy ultralytics python-multipart
```

> Lần đầu cài `ultralytics` có thể mất vài phút vì tải PyTorch.

---

### A4. Cài đặt Frontend (React)

```powershell
cd "e:\Đồ án liên ngành\DA\Smart-Parking-AI\frontend-react"
npm install
```

---

## B. Chạy dự án hàng ngày (đã cài đặt rồi)

Cần mở **3 cửa sổ terminal riêng biệt** và chạy mỗi lệnh trong một cửa sổ.

### Terminal 1 — Backend

```powershell
cd "e:\Đồ án liên ngành\DA\Smart-Parking-AI\backend-nodejs"
npm run dev
```

Thành công khi thấy:
```
Server running on port 4000
MongoDB connected
```

---

### Terminal 2 — AI Server

```powershell
cd "e:\Đồ án liên ngành\DA\Smart-Parking-AI"
.venv\Scripts\Activate.ps1
cd ai-server-python
python main.py
```

Thành công khi thấy:
```
Đang khởi động hệ thống ParkVision AI...
✅ Hệ thống đã sẵn sàng!
INFO:     Uvicorn running on http://0.0.0.0:8000
```

> **Lưu ý:** AI Server cần **webcam** để stream video. Nếu không có webcam, luồng `/api/video-stream` sẽ không hoạt động nhưng `/api/scan-plate` vẫn hoạt động bình thường.

---

### Terminal 3 — Frontend

```powershell
cd "e:\Đồ án liên ngành\DA\Smart-Parking-AI\frontend-react"
npm run dev
```

Thành công khi thấy:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Mở trình duyệt và truy cập: **http://localhost:5173**

---

## C. Kiểm tra nhanh các service

| Kiểm tra | URL |
|---|---|
| Backend health check | http://localhost:4000/api/health |
| AI Server docs (Swagger) | http://localhost:8000/docs |
| Frontend | http://localhost:5173 |

---

## D. Xử lý lỗi thường gặp

**Lỗi `npm: command not found`**  
→ Node.js chưa được cài hoặc chưa thêm vào PATH. Cài lại Node.js và khởi động lại terminal.

**Lỗi `python: command not found`**  
→ Python chưa được cài hoặc chưa thêm vào PATH. Cài lại Python và tích chọn "Add Python to PATH".

**Lỗi kết nối MongoDB**  
→ Kiểm tra file `.env` trong `backend-nodejs/`. Chuỗi `MONGODB_URI` phải đúng. Đảm bảo máy có kết nối internet (vì dùng MongoDB Atlas).

**Lỗi `ModuleNotFoundError` khi chạy Python**  
→ Chưa kích hoạt virtual environment hoặc chưa cài thư viện. Chạy lại bước A3.

**Lỗi `camera not found` ở AI Server**  
→ Webcam không được nhận. Thử cắm webcam ngoài hoặc kiểm tra quyền truy cập camera trong cài đặt Windows.

**Port đang bị chiếm (EADDRINUSE)**  
→ Tìm và tắt process đang dùng port đó:
```powershell
netstat -ano | findstr :4000
taskkill /PID <PID_number> /F
```
