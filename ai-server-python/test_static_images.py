import cv2
import os
import torch

# Patch torch.load TRƯỚC khi import detector
_original_torch_load = torch.load
def _patched_torch_load(f, *args, **kwargs):
    kwargs['weights_only'] = kwargs.get('weights_only', False)
    return _original_torch_load(f, *args, **kwargs)
torch.load = _patched_torch_load

from utils.detector import SmartDetector
from utils.ocr_engine import OCREngine

def test_images():
    """Test detector + OCR trên 2 ảnh tĩnh"""
    
    print("🚀 Initializing models...")
    detector = SmartDetector("models/best.pt")
    ocr = OCREngine()
    
    test_dir = "test_images"
    test_files = [f for f in os.listdir(test_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    print(f"📸 Found {len(test_files)} test image(s)\n")
    
    for filename in test_files:
        filepath = os.path.join(test_dir, filename)
        print(f"\n{'='*60}")
        print(f"Testing: {filename}")
        print('='*60)
        
        # Read image
        frame = cv2.imread(filepath)
        if frame is None:
            print(f"❌ Cannot read image: {filepath}")
            continue
        
        print(f"Image size: {frame.shape}")
        
        # Detect plates
        print("\n🔍 Detecting plates...")
        plates = detector.detect_plates(frame)
        print(f"Found {len(plates)} plate(s)")
        
        if not plates:
            print("⚠️ No plates detected")
            continue
        
        # Process each detection
        for i, plate in enumerate(plates, 1):
            print(f"\n--- Plate {i} ---")
            print(f"Box: ({plate['x1']}, {plate['y1']}) -> ({plate['x2']}, {plate['y2']})")
            print(f"Detection confidence: {plate['conf']:.4f}")
            
            # Crop plate
            crop = frame[plate['y1']:plate['y2'], plate['x1']:plate['x2']]
            
            # OCR
            print("📖 Reading plate text...")
            text, plate_type = ocr.process(crop)
            
            print(f"Raw OCR text: {text}")
            print(f"Plate type: {plate_type}")
            
        # Draw detections and save annotated image
        annotated_frame = detector.draw_detections(frame, plates)
        output_filename = f"test_output_{os.path.splitext(filename)[0]}.jpg"
        cv2.imwrite(output_filename, annotated_frame)
        print(f"\n✅ Annotated image saved: {output_filename}")
    
    print(f"\n{'='*60}")
    print("✅ Test complete!")
    print('='*60)

if __name__ == "__main__":
    test_images()
