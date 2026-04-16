import cv2
from ultralytics import YOLO

class PlateDetector:
    def __init__(self, model_path="models/detect_license.pt"):
        # Load mô hình YOLO Stage 1
        print("[INFO] Loading Plate Detector Model...")
        self.model = YOLO(model_path)

    def detect_and_crop(self, frame, conf_threshold=0.5):
        """
        Nhận vào ảnh gốc, trả về danh sách các ảnh đã cắt (biển số) và tọa độ.
        """
        results = self.model(frame, conf=conf_threshold, verbose=False)[0]
        cropped_plates = []
        
        for box in results.boxes:
            # Lấy tọa độ khung biển số
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            
            # Cắt ảnh biển số từ frame gốc
            plate_img = frame[y1:y2, x1:x2]
            
            cropped_plates.append({
                "image": plate_img,
                "bbox": [x1, y1, x2, y2]
            })
            
        return cropped_plates