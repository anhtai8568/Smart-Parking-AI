from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uvicorn
import base64
import time
import atexit
import copy

# Import 2 module bạn vừa tạo
from utils.detect_license import PlateDetector
from utils.character import CharacterRecognizer
from models.apriltag_gene import generate_aruco_image, get_aruco_id_from_license_plate
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
print("[OK] He thong da san sang!")

import urllib.request
import json
import threading

# Lock đồng bộ hóa dữ liệu cache last_scan
scan_lock = threading.Lock()

def notify_plate_ready(gate, plate, image_b64, apriltag=None):
    """
    Thông báo cho Node.js biết đã nhận diện được biển số cho cổng này.
    AI server không cần biết RFID - chỉ đẩy plate lên session manager của Node.js.
    """
    try:
        url = "http://localhost:4000/api/gate/plate-ready"
        payload = {"gate": gate, "plate": plate, "image_b64": image_b64}
        if apriltag is not None:
            payload["apriltag"] = apriltag
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=2.0) as response:
            response.read()
            print(f"[notify_plate_ready] gate={gate} plate={plate} -> Node.js OK")
    except Exception as e:
        print(f"[notify_plate_ready] Error: {e}")

# Khởi hoạt camera mặc định (0 = webcam laptop)
camera = cv2.VideoCapture(0)
camera_lock = threading.Lock()

# Giải phóng camera khi server tắt
@atexit.register
def cleanup_camera():
    global camera
    with camera_lock:
        if camera.isOpened():
            camera.release()
            print("[cleanup] Camera has been released successfully.")

# Throttle nhận diện để đỡ nặng (mỗi N frame xử lý 1 lần)
FRAME_SKIP = 3
frame_count = 0
last_plate_text = ""

# Active Plate Tracking State
current_plate_text = None
current_plate_b64 = None
plate_lost_counter = 0

# ===== SCAN RESULT CACHE =====
# Lưu kết quả nhận diện mới nhất của cổng vào và cổng ra
last_scan = {
    "in":  {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None, "warning": None, "rfid": None, "entryTime": None, "exitTime": None, "fee": None, "paymentStatus": None, "qrUrl": None},
    "out": {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None, "warning": None, "rfid": None, "entryTime": None, "exitTime": None, "fee": None, "paymentStatus": None, "qrUrl": None},
}

# Cấu trúc lưu trữ biển số nhận diện từ livestream độc lập theo từng cổng
livestream_cache = {
    "in":  {"text": None, "b64": None, "timestamp": 0},
    "out": {"text": None, "b64": None, "timestamp": 0},
}

# Theo dõi cổng nào đang hoạt động để tránh ghi đè nhận diện lên cả hai cổng
active_gate = "in"

def generate_frames():
    global frame_count, last_plate_text, livestream_cache
    global plate_lost_counter, active_gate, camera

    current_plate_text = None
    current_plate_b64  = None

    last_bboxes    = []
    last_ocr_time  = 0
    plate_notified = False   # True khi đã notify Node.js cho biển số hiện tại, reset khi biển mất

    while True:
        with camera_lock:
            if not camera.isOpened():
                print("[camera] Camera is not opened. Attempting to reopen...")
                camera.release()
                camera = cv2.VideoCapture(0)
            success, frame = camera.read()
        if not success:
            print("[camera] Failed to read frame. Sleeping 1.0s...")
            time.sleep(1.0)
            continue

        frame_count += 1
        if frame_count % FRAME_SKIP == 0:
            try:
                plates = detector.detect_and_crop(frame)
                if plates:
                    last_bboxes = [p["bbox"] for p in plates]
                    plate_lost_counter = 0
                    print(f"[YOLO Stage 1] Phat hien {len(plates)} bien so trong khung hinh.")
                    
                    # Giãn cách chạy OCR tối thiểu 1.0 giây để tránh giật lag camera stream
                    now_time = time.time()
                    if current_plate_text is None and (now_time - last_ocr_time > 1.0):
                        last_ocr_time = now_time
                        plate_img  = plates[0]["image"]
                        plate_text = recognizer.process_plate(plate_img)
                        if plate_text:
                            current_plate_text = plate_text
                            last_plate_text    = plate_text
                            plate_notified     = False   # Reset để cho phép notify với biển mới này
                            print(f"[YOLO Stage 2] Nhan dien bien so: '{plate_text}'")
                            
                            # Encode ảnh biển số sang base64
                            _, buf = cv2.imencode(".jpg", plate_img)
                            current_plate_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()
                            
                            # Cập nhật last_scan cho dashboard bảo vệ
                            gate = active_gate
                            if gate in ["in", "out"]:
                                now_ts = time.time()
                                livestream_cache[gate]["text"] = plate_text
                                livestream_cache[gate]["b64"] = current_plate_b64
                                livestream_cache[gate]["timestamp"] = now_ts

                                with scan_lock:
                                    last_scan[gate]["plate"]     = plate_text
                                    last_scan[gate]["image_b64"] = current_plate_b64
                                    last_scan[gate]["timestamp"] = time.strftime("%H:%M %d/%m/%Y")
                                    last_scan[gate]["warning"]   = None
                                
                                # Notify Node.js session manager (chỉ 1 lần đầu cho mỗi biển số)
                                if not plate_notified:
                                    plate_notified = True
                                    print(f"[livestream] Notify Node.js: gate={gate}, plate={plate_text}")
                                    threading.Thread(
                                        target=notify_plate_ready,
                                        args=(gate, plate_text, current_plate_b64, None),
                                        daemon=True
                                    ).start()
                else:
                    last_bboxes = []
                    plate_lost_counter += 1
                    if plate_lost_counter > 45:  # ~9 giây không thấy biển mới xóa cache
                        current_plate_text = None
                        current_plate_b64  = None
                        plate_notified     = False   # Reset để lần phát hiện tiếp sẽ notify lại
            except Exception as e:
                print(f"[generate_frames] Error: {e}")

        # Vẽ khung màu xanh lá cây xung quanh biển số xe trên mọi frame
        for bbox in last_bboxes:
            try:
                x1, y1, x2, y2 = bbox
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
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
        try:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )
        except GeneratorExit:
            print("[stream] Client disconnected from video stream.")
            break

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
        custom_label = f"BIEN SO: {plate.upper()} - ID: {marker_id}"

    # Tạo ảnh AprilTag
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
    """
    global active_gate, camera, livestream_cache
    
    if gate in ("in", "out"):
        active_gate = gate
    
    if gate not in ("in", "out"):
        return {"status": "error", "message": "gate phải là 'in' hoặc 'out'"}

    existing_rfid = None
    prev_plate    = None   # <<< Lưu biển số cũ làm fallback nếu scan mới thất bại
    prev_image_b64 = None
    with scan_lock:
        existing_rfid  = last_scan[gate].get("rfid")
        prev_plate     = last_scan[gate].get("plate")      # <<< giữ lại
        prev_image_b64 = last_scan[gate].get("image_b64")  # <<< giữ lại
        
        # Reset cache của cổng hiện tại để đón nhận diện mới (tránh kẹt hình ảnh/biển số của giao dịch trước)
        last_scan[gate] = {
            "plate":     None,
            "apriltag":  None,
            "image_b64": None,
            "timestamp": time.strftime("%H:%M %d/%m/%Y"),
            "warning":   None,
            "rfid":      existing_rfid,
            "entryTime": None,
            "exitTime":  None,
            "fee":       None,
            "paymentStatus": None,
            "qrUrl":     None,
        }

    # 1. Nếu livestream đang nhìn thấy biển số trực tiếp cho cổng này và còn mới (< 3.0s), sử dụng luôn
    now_ts = time.time()
    cached = livestream_cache.get(gate)
    if cached and cached["text"] is not None and (now_ts - cached["timestamp"] < 3.0):
        print(f"[capture-and-scan] Tai su dung bien so tu dong nhan dien tu livestream cho gate={gate}: {cached['text']}")
        
        # Quét nhanh AprilTag từ camera hiện tại phòng trường hợp là xe tháng ô tô
        apriltag_id = None
        with camera_lock:
            if not camera.isOpened():
                camera.release()
                camera = cv2.VideoCapture(0)
            success, frame = camera.read()
        if success:
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                aruco_dict   = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_APRILTAG_36h11)
                aruco_params = cv2.aruco.DetectorParameters()
                detector_ar  = cv2.aruco.ArucoDetector(aruco_dict, aruco_params)
                corners, ids, _ = detector_ar.detectMarkers(gray)
                if ids is not None and len(ids) > 0:
                    apriltag_id = int(ids[0][0])
            except Exception:
                pass
                
        with scan_lock:
            last_scan[gate]["plate"] = cached["text"]
            last_scan[gate]["image_b64"] = cached["b64"]
            if apriltag_id is not None:
                last_scan[gate]["apriltag"] = apriltag_id
            res_data = copy.deepcopy(last_scan[gate])
                
        return {
            "status": "success",
            "gate": gate,
            "data": res_data,
        }

    # 2. Nếu chưa có biển số, tiến hành chụp và nhận dạng nhanh (chỉ thử 1 frame duy nhất, không sleep, không loop)
    plate_text  = None
    apriltag_id = None
    plate_b64   = None
    frame_b64   = None
    best_frame  = None

    with camera_lock:
        if not camera.isOpened():
            camera.release()
            camera = cv2.VideoCapture(0)
        success, frame = camera.read()
    if success:
        best_frame = frame
        try:
            plates = detector.detect_and_crop(frame)
            if plates:
                print(f"[capture-and-scan] Single frame - Phat hien {len(plates)} bien so xe.")
                plate_img  = plates[0]["image"]
                plate_text = recognizer.process_plate(plate_img)
                if plate_text:
                    print(f"[capture-and-scan] Single frame - Doc duoc bien so: '{plate_text}'")
                    _, buf = cv2.imencode(".jpg", plate_img)
                    plate_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()
                else:
                    print(f"[capture-and-scan] Single frame - Phat hien bien so nhung OCR khong thanh cong.")
            else:
                print(f"[capture-and-scan] Single frame - Khong phat hien thay bien so xe nao.")
        except Exception as e:
            print(f"[capture-and-scan] Error single frame scan: {e}")

    # Quét AprilTag từ best_frame
    if best_frame is not None:
        try:
            gray = cv2.cvtColor(best_frame, cv2.COLOR_BGR2GRAY)
            aruco_dict   = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_APRILTAG_36h11)
            aruco_params = cv2.aruco.DetectorParameters()
            detector_ar  = cv2.aruco.ArucoDetector(aruco_dict, aruco_params)
            corners, ids, _ = detector_ar.detectMarkers(gray)
            if ids is not None and len(ids) > 0:
                apriltag_id = int(ids[0][0])
        except Exception:
            pass

        # Encode full frame để fallback
        _, frame_buf = cv2.imencode(".jpg", best_frame)
        frame_b64 = "data:image/jpeg;base64," + base64.b64encode(frame_buf.tobytes()).decode()

    # ✔ Nếu scan 1-frame không ra biển số → dùng lại biển số mà livestream đã nhận diện trước đó
    if plate_text is None and prev_plate is not None:
        plate_text = prev_plate
        plate_b64  = prev_image_b64 or plate_b64 or frame_b64
        print(f"[capture-and-scan] Single frame that bai -> phuc hoi bien so cu tu livestream: '{plate_text}'")
    
    result = {
        "plate":      plate_text,
        "apriltag":   apriltag_id,
        "image_b64":  plate_b64 or frame_b64,
        "timestamp":  time.strftime("%H:%M %d/%m/%Y"),
        "warning":    None,
        "rfid":       existing_rfid,
    }
    
    with scan_lock:
        last_scan[gate] = result
        res_data = copy.deepcopy(last_scan[gate])

    return {
        "status": "success",
        "gate": gate,
        "data": res_data,
    }

@app.post("/api/clear-scan")
async def clear_scan(payload: dict = None):
    """
    Reset kết quả quét của cổng (in/out/all) về giá trị trống.
    """
    global active_gate, livestream_cache
    active_gate = "in"  # Reset về cổng vào mặc định
    
    gate = payload.get("gate") if payload else None
    with scan_lock:
        if gate in last_scan:
            last_scan[gate] = {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None, "warning": None, "rfid": None, "entryTime": None, "exitTime": None, "fee": None, "paymentStatus": None, "qrUrl": None}
            if gate in livestream_cache:
                livestream_cache[gate] = {"text": None, "b64": None, "timestamp": 0}
        else:
            last_scan["in"] = {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None, "warning": None, "rfid": None, "entryTime": None, "exitTime": None, "fee": None, "paymentStatus": None, "qrUrl": None}
            last_scan["out"] = {"plate": None, "apriltag": None, "image_b64": None, "timestamp": None, "warning": None, "rfid": None, "entryTime": None, "exitTime": None, "fee": None, "paymentStatus": None, "qrUrl": None}
            livestream_cache["in"] = {"text": None, "b64": None, "timestamp": 0}
            livestream_cache["out"] = {"text": None, "b64": None, "timestamp": 0}
    return {"status": "success", "message": "Đã reset kết quả quét."}


@app.get("/api/latest-scan")
async def get_latest_scan():
    """
    Trả về kết quả nhận diện mới nhất của cả 2 cổng.
    Frontend poll endpoint này mỗi ~2 giây để cập nhật dashboard.
    """
    with scan_lock:
        data_copy = copy.deepcopy(last_scan)
    return {
        "status": "success",
        "data":   data_copy,
    }


@app.post("/api/update-scan-warning")
async def update_scan_warning(payload: dict, request: Request):
    """
    Cập nhật cảnh báo nhận diện/mismatch hoặc thông tin rfid từ Node.js backend.
    Hỗ trợ thêm giả lập biển số xe và hình ảnh để kiểm thử.
    """
    # Bảo mật: Chỉ cho phép localhost hoặc dải IP của Docker
    client_ip = request.client.host
    is_allowed = (
        client_ip in ("127.0.0.1", "localhost", "::1") or
        client_ip.startswith("172.") or
        client_ip.startswith("10.") or
        client_ip.startswith("192.168.")
    )
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Access denied. Local or Docker network only.")

    gate = payload.get("gate", "in")
    
    with scan_lock:
        if gate in last_scan:
            # Sao chép động toàn bộ các trường nhận được từ payload sang cache
            for key, val in payload.items():
                if key == "gate":
                    continue
                # Tránh ghi đè None lên plate và image_b64 nếu chúng đã có dữ liệu trước đó
                if key in ["plate", "image_b64"] and val is None:
                    continue
                last_scan[gate][key] = val
            
            # Print log ra để debug chính xác dòng chạy
            print(f"[update_scan_warning] Cổng {gate} -> RFID: {last_scan[gate].get('rfid')}, BIỂN SỐ: {last_scan[gate].get('plate')}, CẢNH BÁO: {last_scan[gate].get('warning')}, PHÍ: {last_scan[gate].get('fee')}, TT: {last_scan[gate].get('paymentStatus')}")
            
    return {"status": "success", "message": "Cập nhật cảnh báo thành công"}


# Lệnh chạy server
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)