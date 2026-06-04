#include <ESP32Servo.h>

// ===== SENSOR =====
#define TRIG1 19
#define ECHO1 18

#define TRIG2 5
#define ECHO2 4

// ===== SERVO =====
#define SERVO_PIN 21
Servo myServo;

int currentAngle = 0;

// ===== UART với Mega =====
HardwareSerial SerialMega(2); // UART2
int soChoTrong = -1;

// ===== UART với Uno =====
HardwareSerial SerialUno(1); // UART1

// Mảng lưu trạng thái chi tiết của 6 chỗ đỗ (false = trống, true = có xe)
bool slotStatus[6] = {false, false, false, false, false, false}; 

// ===== STATE =====
bool xeDangChoQuetThe = false;
bool xeDangRa = false;
String rfidUid = "";           // Biến tạm lưu UID thẻ xe vãng lai
bool dangChoXeVao = false;     // Chờ xe đi qua cảm biến trong
bool xeDaVaoTrong = false;     // Xác nhận xe đã chạm cảm biến trong (d2 < 10)
bool dangChoXeRa = false;      // Chờ xe đi qua cảm biến ngoài
bool xeDaRaNgoai = false;      // Xác nhận xe đã chạm cảm biến ngoài (d1 < 10)
bool enableScanID = false;     // Cho phép quét thẻ để điều khiển barrier (mặc định tắt)

// ===== Đo khoảng cách =====
float getDistance(int trigPin, int echoPin) {
  long duration;

  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return -1;

  return duration * 0.034 / 2;
}

// Hàm kích hoạt servo mở cửa
void moraochan() {
  Serial.println("Mo barrier!");
  myServo.write(90);
  currentAngle = 90;
}


void setup() {
  Serial.begin(115200);

  // Khởi động UART2 kết nối thẳng với Mega
  SerialMega.begin(9600, SERIAL_8N1, 16, 17);
  SerialMega.setTimeout(50); 

  // Khởi động UART1 kết nối với Uno
  SerialUno.begin(9600, SERIAL_8N1, 26, 27); // RX=26, TX=27
  SerialUno.setTimeout(50);

  // Sensor
  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);

  pinMode(TRIG2, OUTPUT);
  pinMode(ECHO2, INPUT);

  // Servo
  myServo.attach(SERVO_PIN);
  myServo.write(0);

  Serial.println("ESP32 Gate System Ready...");
}

void loop() {

  // ===== 1. NHẬN VÀ BÓC TÁCH DỮ LIỆU TỪ MEGA =====
  if (SerialMega.available()) {
    String data = SerialMega.readStringUntil('\n');
    data.trim();

    // 1.1 Tách tổng số chỗ trống
    int idx = data.indexOf("EMPTY:");
    if (idx != -1) {
      soChoTrong = data.substring(idx + 6).toInt();
    }

    // 1.2 Tách trạng thái chi tiết của từng chỗ đỗ và báo ô trống khi xe đỗ vào
    for (int i = 0; i < 6; i++) {
      String matchStr = "S" + String(i + 1) + ": CO XE"; 
      bool currentSlotHasCar = (data.indexOf(matchStr) != -1);
      
      // Nếu ô đỗ trước đó TRỐNG (false) mà bây giờ CÓ XE (true) thì báo
      if (currentSlotHasCar && !slotStatus[i]) {
        Serial.print("Xe da vao o do: S");
        Serial.println(i + 1);
      }
      slotStatus[i] = currentSlotHasCar;
    }

    // [IN RA ĐỂ TEST] - Hiển thị lên màn hình xem ESP32 đã tách đúng chưa
    Serial.print("Thong ke nhanh -> Trong: ");
    Serial.print(soChoTrong);
    Serial.print(" | Chi tiet: ");
    for(int i = 0; i < 6; i++){
      Serial.print("S"); 
      Serial.print(i + 1); 
      Serial.print(slotStatus[i] ? "=(FULL) " : "=(TRONG) ");
    }
    Serial.println();
  }

  // ===== 1.5 NHẬN VÀ BÓC TÁCH DỮ LIỆU TỪ UNO (RFID) =====
  if (SerialUno.available()) {
    String data = SerialUno.readStringUntil('\n');
    data.trim();

    if (enableScanID) {
      if (data.startsWith("IN:")) {
        String cardID = data.substring(3);
        Serial.print("QUET THE CONG VAO - ID: ");
        Serial.println(cardID);

        if (xeDangChoQuetThe) {
          if (soChoTrong > 0) {
            rfidUid = cardID; // Lưu tạm vào biến tạm rfidUid (xe vãng lai)
            Serial.print("Da luu rfidUid tam: ");
            Serial.println(rfidUid);
            moraochan(); // Gọi hàm mở rào chắn
            dangChoXeVao = true;
            xeDaVaoTrong = false;
            enableScanID = false; // Tắt quét thẻ sau khi nhận dạng thành công
          } else {
            Serial.println("Het cho! Khong the mo barrier.");
          }
        }
      } 
      else if (data.startsWith("OUT:")) {
        String cardID = data.substring(4);
        Serial.print("QUET THE CONG RA - ID: ");
        Serial.println(cardID);

        if (xeDangRa) {
          if (cardID == rfidUid) {
            Serial.println("THE KHOP. Mo barrier!");
            moraochan(); // Gọi hàm mở rào chắn
            dangChoXeRa = true;
            xeDaRaNgoai = false;
            rfidUid = ""; // Xoá biến tạm sau khi khớp thẻ ra
            enableScanID = false; // Tắt quét thẻ sau khi nhận dạng thành công
          } else {
            Serial.print("THE KHONG KHOP! (The ra: ");
            Serial.print(cardID);
            Serial.print(" | The da luu: ");
            Serial.print(rfidUid);
            Serial.println(")");
          }
        }
      }
    } else {
      // Chế độ chờ xe hoặc quét thô từ xa để đăng ký thẻ tháng (không mở cổng)
      if (data.startsWith("IN:")) {
        String cardID = data.substring(3);
        Serial.print("RFID_IN_SCAN_RAW: ");
        Serial.println(cardID);
      } else if (data.startsWith("OUT:")) {
        String cardID = data.substring(4);
        Serial.print("RFID_OUT_SCAN_RAW: ");
        Serial.println(cardID);
      }
    }
  }

  // ===== 2. ĐỌC CẢM BIẾN SIÊU ÂM =====
  float d1 = getDistance(TRIG1, ECHO1);
  float d2 = getDistance(TRIG2, ECHO2);

  // ===== 3. LOGIC XE VÀO (CẢM BIẾN 1) =====
  if (d1 > 0 && d1 < 10) {
    if (!xeDangChoQuetThe) {
      Serial.println("Xe den, vui long quet the...");
      xeDangChoQuetThe = true;
      enableScanID = true; // Kích hoạt quét thẻ
    }
  } 
  else if (d1 > 15 || d1 == -1) {
    if (xeDangChoQuetThe) {
      xeDangChoQuetThe = false; 
      enableScanID = false; // Hủy kích hoạt nếu xe lùi đi mất
    }
  }

  // ===== 4. CHO XE VAO: DOI RFID TU UNO GUI SANG =====
  if (xeDangChoQuetThe && soChoTrong == 0) {
    static unsigned long lastBaoHetCho = 0;
    if (millis() - lastBaoHetCho > 3000) {
      Serial.println("Het cho! Khong the vao.");
      lastBaoHetCho = millis();
    }
  }

  // ===== 5. LOGIC XE RA (CẢM BIẾN 2) =====
  if (d2 > 0 && d2 < 10) {
    if (!xeDangRa) {
      Serial.println("Xe ra cong, vui long quet the...");
      xeDangRa = true;
      enableScanID = true; // Kích hoạt quét thẻ
    }
  } 
  else if (d2 > 15 || d2 == -1) {
    if (xeDangRa) {
      xeDangRa = false;
      enableScanID = false; // Hủy kích hoạt nếu xe lùi đi mất
    }
  }

  // ===== 6. ĐÓNG BARRIER AN TOÀN =====
  // Logic xe vào: đóng cửa khi xe đi qua hẳn cảm biến bên trong (TRIG2/ECHO2)
  if (dangChoXeVao) {
    if (d2 > 0 && d2 < 10) {
      xeDaVaoTrong = true; // Xe bắt đầu đi qua cảm biến trong
    }
    if (xeDaVaoTrong && (d2 > 15 || d2 == -1)) {
      delay(1000); // Chờ đuôi xe qua hẳn
      myServo.write(0);
      currentAngle = 0;
      xeDaVaoTrong = false;
      dangChoXeVao = false;
      Serial.println("Dong cong (Xe da vao)!");
    }
  }

  // Logic xe ra: đóng cửa khi xe đi qua hẳn cảm biến bên ngoài (TRIG1/ECHO1)
  if (dangChoXeRa) {
    if (d1 > 0 && d1 < 10) {
      xeDaRaNgoai = true; // Xe bắt đầu đi qua cảm biến ngoài
    }
    if (xeDaRaNgoai && (d1 > 15 || d1 == -1)) {
      delay(1000); // Chờ đuôi xe qua hẳn
      myServo.write(0);
      currentAngle = 0;
      xeDaRaNgoai = false;
      dangChoXeRa = false;
      Serial.println("Dong cong (Xe da ra)!");
    }
  }

  delay(50);
}