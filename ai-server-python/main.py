from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uvicorn

# Import 2 module bạn vừa tạo
from utils.detect_license import PlateDetector
from utils.character import CharacterRecognizer

app = FastAPI(title="ParkVision AI API")

# Cấp quyền CORS để Frontend (React) ở port khác có thể gọi được API này
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo mô hình (Chỉ load 1 lần khi bật Server)
print("Đang khởi động hệ thống ParkVision AI...")
detector = PlateDetector("models/detect_license.pt")
recognizer = CharacterRecognizer("models/char.pt")
print("✅ Hệ thống đã sẵn sàng!")

# Khởi tạo camera mặc định (0 = webcam laptop)
camera = cv2.VideoCapture(0)

# Throttle nhận diện để đỡ nặng (mỗi N frame xử lý 1 lần)
FRAME_SKIP = 6
frame_count = 0
last_plate_text = ""

def generate_frames():
    global frame_count, last_plate_text

    while True:
        success, frame = camera.read()
        if not success:
            break

        frame_count += 1
        if frame_count % FRAME_SKIP == 0:
            try:
                plates = detector.detect_and_crop(frame)
                if plates:
                    plate_img = plates[0]["image"]
                    plate_text = recognizer.process_plate(plate_img)
                    if plate_text:
                        last_plate_text = plate_text
            except Exception:
                pass

        if last_plate_text:
            cv2.rectangle(frame, (10, 10), (360, 60), (0, 0, 0), -1)
            cv2.putText(
                frame,
                f"PLATE: {last_plate_text}",
                (20, 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        ret, buffer = cv2.imencode(".jpg", frame)
        if not ret:
            continue

        frame_bytes = buffer.tobytes()
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
        )

@app.get("/api/video-stream")
def video_stream():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )

@app.post("/api/scan-plate")
async def scan_plate(file: UploadFile = File(...)):
    try:
        # 1. Đọc file ảnh gửi lên từ Web/ESP32
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # 2. Stage 1: Tìm và cắt biển số
        plates = detector.detect_and_crop(frame)
        
        if not plates:
            return {"status": "error", "message": "Không tìm thấy biển số trong ảnh", "data": None}
            
        # Giả sử chỉ lấy biển số đầu tiên tìm được (hoặc lặp qua danh sách nếu có nhiều xe)
        plate_img = plates[0]["image"]
        
        # 3. Stage 2: Đọc chữ và Mapping
        plate_text = recognizer.process_plate(plate_img)
        
        if plate_text:
            return {
                "status": "success", 
                "message": "Nhận diện thành công",
                "data": {
                    "plate_number": plate_text
                }
            }
        else:
            return {"status": "error", "message": "Tìm thấy biển nhưng không đọc được chữ", "data": None}
            
    except Exception as e:
        return {"status": "error", "message": str(e), "data": None}

# Lệnh chạy server
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)