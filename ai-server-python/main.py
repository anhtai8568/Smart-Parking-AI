from fastapi import FastAPI, File, UploadFile
from utils.detector import SmartDetector
from utils.ocr_engine import OCREngine
import cv2
import numpy as np
import uvicorn

app = FastAPI()

# Khởi tạo các công cụ (Chỉ khởi tạo 1 lần để tiết kiệm RAM)
detector = SmartDetector("models/best.pt")
ocr = OCREngine()

@app.post("/detect")
async def detect_api(file: UploadFile = File(...)):
    # 1. Đọc ảnh từ Request
    data = await file.read()
    nparr = np.fromstring(data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 2. Nhận diện ArUco
    aruco_ids = detector.detect_aruco(frame)

    # 3. Nhận diện biển số và đọc chữ
    final_plates = []
    plate_boxes = detector.detect_plates(frame)
    
    for box in plate_boxes:
        crop = frame[box['y1']:box['y2'], box['x1']:box['x2']]
        if crop.size == 0: continue
        
        text, p_type = ocr.process(crop)
        final_plates.append({
            "number": text,
            "type": p_type,
            "confidence": box['conf']
        })

    # 4. Trả kết quả JSON
    return {
        "status": "success",
        "aruco_ids": aruco_ids,
        "plates": final_plates,
        "total_plates": len(final_plates)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)