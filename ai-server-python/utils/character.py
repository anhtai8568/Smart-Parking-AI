from ultralytics import YOLO

class CharacterRecognizer:
    def __init__(self, model_path="models/char.pt"):
        # Load mô hình YOLO Stage 2 (Nhận diện chữ cái)
        print("[INFO] Loading Character Recognizer Model...")
        self.model = YOLO(model_path)
        
        # Bảng Mapping: Ép về SỐ
        self.num_map = {
            'L': '4', 'G': '6', 'D': '0', 'O': '0', 'Q': '0',
            'S': '5', 'B': '8', 'I': '1', 'T': '7', 'Z': '2'
        }
        # Bảng Mapping: Ép về CHỮ
        self.char_map = {
            '4': 'L', '6': 'G', '0': 'D', '5': 'S', 
            '8': 'B', '1': 'I', '7': 'T', '2': 'Z'
        }

    def process_plate(self, plate_img, conf_threshold=0.4):
        """
        Nhận vào ảnh biển số đã cắt, trả về chuỗi text chính xác.
        Áp dụng logic validation 8-9 ký tự và format Việt Nam.
        """
        if plate_img is None or plate_img.size == 0:
            return ""

        h, w = plate_img.shape[:2]
        # Phân loại: Biển vuông (ô tô 2 dòng hoặc xe máy) thường có h/w > 0.4
        is_square_plate = (h / w) > 0.4

        # Chạy YOLO Stage 2
        results = self.model(plate_img, conf=conf_threshold, verbose=False)[0]
        detected_chars = []
        
        for box in results.boxes:
            char_name = self.model.names[int(box.cls)]
            cx, cy, cw, ch = box.xywh[0] # Lấy tâm x, y
            detected_chars.append({'name': char_name, 'x': float(cx), 'y': float(cy)})

        total_chars = len(detected_chars)

        # ---------------------------------------------------------
        # 1. BỘ LỌC ĐỘ DÀI (VALIDATION)
        # Chỉ chấp nhận biển số có đúng 8 ký tự (ô tô) hoặc 9 ký tự (xe máy)
        # ---------------------------------------------------------
        if total_chars not in [8, 9]:
            return "" # Trả về rỗng để giao diện Web tiếp tục quét khung hình khác

        final_text = ""

        # ---------------------------------------------------------
        # 2. LOGIC CHO BIỂN VUÔNG (2 DÒNG: Ô TÔ HOẶC XE MÁY)
        # ---------------------------------------------------------
        if is_square_plate:
            # Chia làm 2 hàng dựa trên trục Y (cắt ngang giữa ảnh)
            row1 = [c for c in detected_chars if c['y'] < h / 2]
            row2 = [c for c in detected_chars if c['y'] >= h / 2]
            
            # Sắp xếp từ trái qua phải theo trục X
            row1 = sorted(row1, key=lambda c: c['x'])
            row2 = sorted(row2, key=lambda c: c['x'])
            
            # XỬ LÝ HÀNG TRÊN: Vị trí thứ 3 (index 2) luôn là CHỮ (VD: 30A, 29A1)
            text_row1 = ""

            for i, c in enumerate(row1):
                name = c['name']
                
                if i < 2:
                    # 2 ký tự đầu luôn là số (tỉnh)
                    text_row1 += self.num_map.get(name, name)
                else:
                    # Phần sau: linh hoạt chữ hoặc số
                    if name.isalpha():
                        text_row1 += self.char_map.get(name, name)
                    else:
                        text_row1 += self.num_map.get(name, name)
            # XỬ LÝ HÀNG DƯỚI: 100% luôn là SỐ
            text_row2 = "".join([self.num_map.get(c['name'], c['name']) for c in row2])
            
            final_text = text_row1 + text_row2

        # ---------------------------------------------------------
        # 3. LOGIC CHO BIỂN DÀI (1 DÒNG: Ô TÔ)
        # ---------------------------------------------------------
        else:
            # Sắp xếp tất cả từ trái qua phải theo trục X
            sorted_chars = sorted(detected_chars, key=lambda c: c['x'])
            
            for i, c in enumerate(sorted_chars):
                # Vị trí thứ 3 (index 2) luôn là CHỮ (VD: 30A12345)
                if i == 2:
                    final_text += self.char_map.get(c['name'], c['name']) # Ép ra CHỮ
                else:
                    final_text += self.num_map.get(c['name'], c['name'])  # Ép ra SỐ

        return final_text