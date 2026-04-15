import cv2
import torch

# Patch torch.load TRƯỚC khi import detector
_original_torch_load = torch.load
def _patched_torch_load(f, *args, **kwargs):
    kwargs['weights_only'] = kwargs.get('weights_only', False)
    return _original_torch_load(f, *args, **kwargs)
torch.load = _patched_torch_load

from utils.detector import SmartDetector
from utils.ocr_engine import OCREngine

def main():
    detector = SmartDetector("models/best.pt")
    ocr = OCREngine()
    cap = cv2.VideoCapture(0) # Mở webcam

    print("🚀 Đang chạy Camera... Nhấn 'q' để thoát.")

    while True:
        ret, frame = cap.read()
        if not ret: break

        # Quét ArUco
        aruco_ids = detector.detect_aruco(frame)
        if aruco_ids:
            cv2.putText(frame, f"ArUco ID: {aruco_ids}", (20, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)

        # Quét Biển số
        plates = detector.detect_plates(frame)
        for p in plates:
            # Cắt và đọc OCR
            crop = frame[p['y1']:p['y2'], p['x1']:p['x2']]
            text, p_type = ocr.process(crop)

            # Vẽ khung và text
            cv2.rectangle(frame, (p['x1'], p['y1']), (p['x2'], p['y2']), (0, 255, 0), 2)
            cv2.putText(frame, f"{text} ({p_type})", (p['x1'], p['y1']-10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.imshow("Test Camera Smart Parking", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()