import cv2
import os
from utils.detector import SmartDetector
from utils.ocr_engine import OCREngine

def debug_ocr():
    """Debug OCR by saving preprocessing steps"""
    
    print("🚀 Initializing models...")
    detector = SmartDetector("models/best.pt")
    ocr = OCREngine()
    
    # Test with static images
    test_images = ["test_images/oto.jpg", "test_images/xemay.jpg"]
    
    os.makedirs("debug_output", exist_ok=True)
    
    for img_file in test_images:
        if not os.path.exists(img_file):
            continue
            
        print(f"\n{'='*60}")
        print(f"Processing: {img_file}")
        print('='*60)
        
        frame = cv2.imread(img_file)
        if frame is None:
            continue
        
        # Detect plate
        plates = detector.detect_plates(frame)
        if not plates:
            print("No plates detected")
            continue
        
        # For each plate, save preprocessing steps
        for i, plate in enumerate(plates):
            x1, y1, x2, y2 = plate['x1'], plate['y1'], plate['x2'], plate['y2']
            crop = frame[y1:y2, x1:x2]
            
            print(f"\nPlate {i+1}:")
            print(f"  Crop size: {crop.shape}")
            
            # Save original crop
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_01_original.jpg", crop)
            
            # Apply preprocessing steps
            # Step 1: Grayscale
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_02_grayscale.jpg", gray)
            
            # Step 2: Upscale
            h, w = gray.shape
            upscaled = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_03_upscaled.jpg", upscaled)
            
            # Step 3: Bilateral filter
            denoised = cv2.bilateralFilter(upscaled, 9, 75, 75)
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_04_denoised.jpg", denoised)
            
            # Step 4: CLAHE
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(denoised)
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_05_enhanced.jpg", enhanced)
            
            # Step 5: Morphological
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            morphed = cv2.morphologyEx(enhanced, cv2.MORPH_CLOSE, kernel)
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_06_morphed.jpg", morphed)
            
            # Step 6: Adaptive threshold
            thresh = cv2.adaptiveThreshold(morphed, 255, 
                                          cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          cv2.THRESH_BINARY, 11, 2)
            cv2.imwrite(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_07_threshold.jpg", thresh)
            
            # OCR
            text, conf = ocr.read_plate(crop)
            
            print(f"  Raw OCR text: {text}")
            print(f"  Confidence: {conf:.4f}")
            
            is_valid, cleaned = ocr.validate_format(text)
            print(f"  Cleaned text: {cleaned}")
            print(f"  Is valid: {is_valid}")
            
            # Info file
            with open(f"debug_output/{os.path.basename(img_file)[:-4]}_crop_{i}_info.txt", 'w') as f:
                f.write(f"File: {img_file}\n")
                f.write(f"Plate index: {i}\n")
                f.write(f"Box: ({x1}, {y1}) -> ({x2}, {y2})\n")
                f.write(f"Raw OCR: {text}\n")
                f.write(f"Confidence: {conf:.4f}\n")
                f.write(f"Cleaned: {cleaned}\n")
                f.write(f"Valid: {is_valid}\n")
    
    print(f"\n✅ Debug images saved to debug_output/")

if __name__ == "__main__":
    debug_ocr()
