import cv2
import sys
from datetime import datetime
import os

# Import detector & OCR
from utils.detector import SmartDetector
from utils.ocr_engine import OCREngine

def run_camera_detection():
    """Real-time camera stream with plate detection and capture"""
    
    print("🚀 Initializing models...")
    detector = SmartDetector("models/best.pt")
    ocr = OCREngine()
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Cannot open webcam")
        return
    
    # Set video properties for better quality
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    # Create output directory for captured plates
    os.makedirs("captured_plates", exist_ok=True)
    
    print("\n📹 Camera stream started!")
    print("Controls:")
    print("  's' - Capture and save detected plates")
    print("  'q' - Quit")
    print("\n" + "="*60)
    
    capture_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read frame")
            break
        
        # Detect plates on frame
        plates = detector.detect_plates(frame)
        
        # Draw detections on frame
        display_frame = detector.draw_detections(frame, plates)
        
        # Prepare OCR results for display
        ocr_results = []
        for i, plate in enumerate(plates):
            crop = frame[plate['y1']:plate['y2'], plate['x1']:plate['x2']]
            text, plate_type = ocr.process(crop)
            
            ocr_results.append({
                'index': i,
                'text': text,
                'type': plate_type,
                'box': plate,
                'crop': crop,
                'conf': plate.get('conf', 0)
            })
            
            # Draw OCR text on frame
            x1, y1 = plate['x1'], plate['y1']
            label = f"[{text}] {plate_type}"
            cv2.putText(display_frame, label, (x1, y1 - 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
        # Display plate count
        cv2.putText(display_frame, f"Plates detected: {len(plates)}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        # Show frame
        cv2.imshow("Smart Parking - Plate Detection", display_frame)
        
        # Check for key press
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):  # Quit
            print("\n✅ Quitting...")
            break
        
        elif key == ord('s'):  # Save detected plates
            if ocr_results:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                
                for result in ocr_results:
                    capture_count += 1
                    
                    # Save plate crop
                    plate_filename = f"captured_plates/plate_{timestamp}_{result['index']}_{result['text']}.jpg"
                    cv2.imwrite(plate_filename, result['crop'])
                    
                    print(f"\n📸 Captured Plate #{capture_count}")
                    print(f"  Filename: {plate_filename}")
                    print(f"  Text: {result['text']}")
                    print(f"  Type: {result['type']}")
                    print(f"  Detection Confidence: {result['conf']:.4f}")
                
                # Save full annotated frame
                frame_filename = f"captured_plates/frame_{timestamp}_full.jpg"
                cv2.imwrite(frame_filename, display_frame)
                print(f"  Full frame saved: {frame_filename}")
            else:
                print("⚠️  No plates detected to capture")
    
    cap.release()
    cv2.destroyAllWindows()
    print("\n" + "="*60)
    print(f"✅ Camera stream ended. Total captures: {capture_count}")

if __name__ == "__main__":
    run_camera_detection()
