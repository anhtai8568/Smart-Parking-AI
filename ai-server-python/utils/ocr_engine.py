import easyocr
import re
import cv2
import numpy as np

class OCREngine:
    def __init__(self):
        # Tải model OCR (Lần đầu chạy sẽ mất vài phút để tải model về máy)
        self.reader = easyocr.Reader(['en'], gpu=False) 

    def preprocess_plate(self, plate_image):
        """Improve plate image for better OCR"""
        # Convert to grayscale
        if len(plate_image.shape) == 3:
            gray = cv2.cvtColor(plate_image, cv2.COLOR_BGR2GRAY)
        else:
            gray = plate_image
        
        # Upscale 2x for better OCR
        h, w = gray.shape
        gray = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        
        # Denoise
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Enhance contrast - CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        return enhanced
    
    def fix_ocr_errors(self, text):
        """Fix common OCR character confusion
        2↔L, 4↔I, 0↔O based on Vietnamese plate format
        Format: [0-9][0-9][A-Z][0-9]{5} or [0-9][0-9][A-Z][0-9]{3}/[0-9]{2}
        """
        # Rules for Vietnamese plates:
        # Positions 0-1: DIGITS (provincial code first 2 digits like 50, 59, 30, etc.)
        # Position 2: LETTER (provincial letter like A, B, C, G, etc.)
        # Position 3+: DIGITS (registration number)
        
        result = []
        for i, char in enumerate(text):
            # Position 0-1: Should be digits (provincial code)
            if i < 2:
                if char == 'L' or char == 'I':
                    result.append('1')
                elif char == 'Z':
                    result.append('2')
                elif char == 'O':
                    result.append('0')
                elif char == 'S':
                    result.append('5')
                elif char == 'G':
                    result.append('9')
                elif char == 'B':
                    result.append('8')
                else:
                    result.append(char)
            
            # Position 2: Should be LETTER (provincial letter)
            elif i == 2:
                if char == '0':
                    result.append('O')
                elif char == '1' or char == 'I' or char == 'L':
                    result.append('I')
                elif char == '4':
                    result.append('A')
                elif char == '6':
                    result.append('G')
                elif char == '5':
                    result.append('S')
                elif char == '8':
                    result.append('B')
                else:
                    result.append(char)
            
            # Position 3+: Should be DIGITS (registration number)
            else:
                if char == 'L':
                    result.append('1')
                elif char == 'I':
                    result.append('1')
                elif char == 'O':
                    result.append('0')
                elif char == 'Z':
                    result.append('2')
                elif char == 'S':
                    result.append('5')
                elif char == 'B':
                    result.append('8')
                elif char == 'G':
                    result.append('9')
                elif char == 'A':
                    result.append('4')
                else:
                    result.append(char)
        
        return ''.join(result)

    def process(self, image_crop):
        h, w = image_crop.shape[:2]
        aspect_ratio = w / h
        
        # Preprocess for better OCR
        preprocessed = self.preprocess_plate(image_crop)
        
        # OCR on preprocessed image
        results = self.reader.readtext(preprocessed, detail=1)
        
        # Sắp xếp chữ dựa trên loại biển
        if aspect_ratio > 2.2:
            # Biển dài (1 dòng): Sắp xếp từ trái qua phải (theo x)
            results.sort(key=lambda x: x[0][0][0])
            plate_type = "1-line"
        else:
            # Biển vuông (2 dòng): Sắp xếp theo dòng (y) trước, rồi mới đến x
            # Nhóm các kết quả có y gần nhau vào cùng 1 dòng
            results.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
            plate_type = "2-line"
            
        raw_text = "".join([res[1] for res in results])
        # Làm sạch chuỗi: chỉ giữ chữ và số, bỏ dấu
        clean_text = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
        
        # Fix OCR character confusion
        fixed_text = self.fix_ocr_errors(clean_text)
        
        return fixed_text, plate_type