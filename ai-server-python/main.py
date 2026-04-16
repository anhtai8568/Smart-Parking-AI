from fastapi import FastAPI, File, UploadFile
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