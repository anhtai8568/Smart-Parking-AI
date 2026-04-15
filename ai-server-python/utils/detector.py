import cv2
import cv2.aruco as aruco
import torch
from ultralytics import YOLO

# Monkey-patch torch.load to allow YOLOv10 and dill loading
_original_torch_load = torch.load

def _patched_torch_load(f, *args, **kwargs):
    kwargs['weights_only'] = False
    return _original_torch_load(f, *args, **kwargs)

torch.load = _patched_torch_load

class SmartDetector:
    def __init__(self, model_path="models/best.pt"):
        self.model = YOLO(model_path)
        # Cấu hình ArUco DICT_5X5_100
        self.aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_5X5_100)
        self.aruco_params = aruco.DetectorParameters()
        self.aruco_detector = aruco.ArucoDetector(self.aruco_dict, self.aruco_params)

    def detect_plates(self, frame):
        results = self.model(frame, conf=0.5, verbose=False)[0]
        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            detections.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "conf": conf})
        return detections

    def detect_aruco(self, frame):
        corners, ids, _ = self.aruco_detector.detectMarkers(frame)
        if ids is not None:
            return ids.flatten().tolist()
        return []
    
    def draw_detections(self, frame, plates):
        """Draw detected plates on frame"""
        frame_copy = frame.copy()
        
        for plate in plates:
            x1, y1, x2, y2 = plate['x1'], plate['y1'], plate['x2'], plate['y2']
            conf = plate.get('conf', 0)
            
            # Draw bounding box
            cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Draw label
            label = f"Plate: {conf:.2f}"
            cv2.putText(frame_copy, label, (x1, y1 - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        return frame_copy
        return []