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

// Mảng lưu trạng thái chi tiết của 6 chỗ đỗ (false = trống, true = có xe)
bool slotStatus[6] = {false, false, false, false, false, false}; 

// ===== STATE =====
bool xeDangChoQuetThe = false;
bool xeDangRa = false;

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


void setup() {
  Serial.begin(115200);

  // Khởi động UART2 kết nối thẳng với Mega
  SerialMega.begin(9600, SERIAL_8N1, 16, 17);
  SerialMega.setTimeout(50); 

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

    // 1.2 Tách trạng thái chi tiết của từng chỗ đỗ
    for (int i = 0; i < 6; i++) {
      // Tìm chữ "S1: CO XE", "S2: CO XE"... trong chuỗi Mega gửi sang
      String matchStr = "S" + String(i + 1) + ": CO XE"; 
      if (data.indexOf(matchStr) != -1) {
        slotStatus[i] = true;  // Có xe
      } else {
        slotStatus[i] = false; // Trống
      }
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

  // ===== 2. ĐỌC CẢM BIẾN SIÊU ÂM =====
  float d1 = getDistance(TRIG1, ECHO1);
  float d2 = getDistance(TRIG2, ECHO2);

  // ===== 3. LOGIC XE VÀO (CẢM BIẾN 1) =====
  if (d1 > 0 && d1 < 10) {
    if (!xeDangChoQuetThe) {
      Serial.println("Xe den, vui long quet the...");
      xeDangChoQuetThe = true;
    }
  } 
  else if (d1 > 15 || d1 == -1) {
    xeDangChoQuetThe = false; 
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
      Serial.println("Xe ra cong, tu dong mo!");
      myServo.write(90);
      currentAngle = 90;
      xeDangRa = true;
    }
  } 
  else if (d2 > 15 || d2 == -1) {
    xeDangRa = false;
  }

  // ===== 6. ĐÓNG BARRIER AN TOÀN =====
  bool anToanD1 = (d1 > 15 || d1 == -1);
  bool anToanD2 = (d2 > 15 || d2 == -1);

  if (currentAngle == 90 && anToanD1 && anToanD2) {
    delay(1000); 
    myServo.write(0);
    currentAngle = 0;
    Serial.println("Dong cong!");
  }

  delay(50);
}