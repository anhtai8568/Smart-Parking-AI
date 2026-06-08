from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uvicorn
import base64
import time

# Import 2 module bạn vừa tạo
from utils.detect_license import PlateDetector
from utils.character import CharacterRecognizer
from models.aruco_gene import generate_aruco_image, get_aruco_id_from_license_plate
from io import BytesIO

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

# ===== SCAN RESULT CACHE =====
# Lưu kết quả nhận diện mới nhất của cổng vào và cổng ra
last_scan = {
    "in":  {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None},
    "out": {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None},
}

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

@app.get("/api/aruco/generate/{identifier}")
def generate_aruco(identifier: str, size: int = 400, label: bool = True):
    """
    Tạo và tải về ảnh mã AprilTag dưới định dạng PNG theo ID hoặc biển số xe.
    """
    custom_label = None
    try:
        marker_id = int(identifier)
        if marker_id < 0 or marker_id >= 587:
            return {"status": "error", "message": "ID marker phải nằm trong khoảng từ 0 đến 586"}
    except ValueError:
        # Nếu không phải là số, coi identifier là biển số xe
        plate = identifier.strip()
        marker_id = get_aruco_id_from_license_plate(plate)
        custom_label = f"BIEN SO: {plate.upper()} - AprilTag ID: {marker_id}"

    # Tạo ảnh ArUco (nay là AprilTag)
    img = generate_aruco_image(marker_id, size, include_label=label, custom_label=custom_label)
    
    # Mã hóa ảnh sang dạng PNG
    _, buffer = cv2.imencode(".png", img)
    io_buf = BytesIO(buffer.tobytes())
    
    # Trả về dưới dạng file tải trực tiếp (Attachment)
    filename = f"apriltag_{identifier.replace('-', '_')}.png"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}"
    }
    return StreamingResponse(io_buf, media_type="image/png", headers=headers)

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


@app.post("/api/capture-and-scan")
async def capture_and_scan(gate: str = "in"):
    """
    Chụp frame hiện tại từ webcam, nhận diện biển số xe và AprilTag.
    Gọi khi cảm biến siêu âm kích hoạt (gate='in' hoặc gate='out').
    Trả về: plate_number, apriltag_id, ảnh biển số dạng base64.
    """
    if gate not in ("in", "out"):
        return {"status": "error", "message": "gate phải là 'in' hoặc 'out'"}

    success, frame = camera.read()
    if not success:
        return {"status": "error", "message": "Không đọc được camera", "data": None}

    plate_text  = None
    apriltag_id = None
    plate_b64   = None

    try:
        # --- Nhận diện biển số ---
        plates = detector.detect_and_crop(frame)
        if plates:
            plate_img  = plates[0]["image"]
            plate_text = recognizer.process_plate(plate_img)

            # Encode ảnh biển số sang base64
            _, buf = cv2.imencode(".jpg", plate_img)
            plate_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()

        # --- Nhận diện AprilTag (ArUco) ---
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        aruco_dict   = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_APRILTAG_36h11)
        aruco_params = cv2.aruco.DetectorParameters()
        detector_ar  = cv2.aruco.ArucoDetector(aruco_dict, aruco_params)
        corners, ids, _ = detector_ar.detectMarkers(gray)
        if ids is not None and len(ids) > 0:
            apriltag_id = int(ids[0][0])

    except Exception as e:
        print(f"[capture-and-scan] Error: {e}")

    # Encode toàn bộ frame (để hiển thị trên dashboard)
    _, frame_buf = cv2.imencode(".jpg", frame)
    frame_b64 = "data:image/jpeg;base64," + base64.b64encode(frame_buf.tobytes()).decode()

    result = {
        "plate":      plate_text,
        "apriltag":   apriltag_id,
        "image_b64":  plate_b64 or frame_b64,  # ưu tiên ảnh biển số, fallback frame full
        "timestamp":  time.strftime("%H:%M %d/%m/%Y"),
    }
    last_scan[gate] = result

    return {
        "status": "success",
        "gate": gate,
        "data": result,
    }


@app.get("/api/latest-scan")
async def get_latest_scan():
    """
    Trả về kết quả nhận diện mới nhất của cả 2 cổng.
    Frontend poll endpoint này mỗi ~2 giây để cập nhật dashboard.
    """
    return {
        "status": "success",
        "data":   last_scan,
    }


# Lệnh chạy server
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)