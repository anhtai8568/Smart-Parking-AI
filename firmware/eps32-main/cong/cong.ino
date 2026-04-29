#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

// ===== RFID =====
#define SS_PIN 26
#define RST_PIN 27

#define SCK_PIN 14
#define MISO_PIN 12
#define MOSI_PIN 13

MFRC522 rfid(SS_PIN, RST_PIN);

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

// ===== Đọc UID =====
String readUID() {
  if (!rfid.PICC_IsNewCardPresent()) return "";
  if (!rfid.PICC_ReadCardSerial()) return "";

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i], HEX);
  }

  rfid.PICC_HaltA();
  return uid;
}

void setup() {
  Serial.begin(115200);

  // UART2: RX=16, TX=17
  SerialMega.begin(9600, SERIAL_8N1, 16, 17);

  // RFID
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  rfid.PCD_Init();

  // Sensor
  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);

  pinMode(TRIG2, OUTPUT);
  pinMode(ECHO2, INPUT);

  // Servo
  myServo.attach(SERVO_PIN);
  myServo.write(0);

  Serial.println("System ready...");
}

void loop() {

  // ===== NHẬN DỮ LIỆU TỪ MEGA =====
  if (SerialMega.available()) {
    String data = SerialMega.readStringUntil('\n');
    data.trim();

    // In toàn bộ dữ liệu nhận được
    Serial.print("Mega: ");
    Serial.println(data);

    // Tách số chỗ trống nếu có
    int idx = data.indexOf("EMPTY:");
    if (idx != -1) {
      soChoTrong = data.substring(idx + 6).toInt();
  }
}

  float d1 = getDistance(TRIG1, ECHO1);
  float d2 = getDistance(TRIG2, ECHO2);

  // ===== XE TỚI CỔNG → CHỜ QUÉT THẺ =====
  if (d1 > 0 && d1 < 10 && !xeDangChoQuetThe) {
    Serial.println("Xe den, vui long quet the...");
    xeDangChoQuetThe = true;
  }

  // ===== QUÉT RFID =====
  if (xeDangChoQuetThe) {

    // 👉 nếu hết chỗ thì không mở
    if (soChoTrong == 0) {
      Serial.println("Het cho!");
      xeDangChoQuetThe = false;
      return;
    }

    String uid = readUID();

    if (uid != "") {
      Serial.print("UID: ");
      Serial.println(uid);

      Serial.println("Mo cong!");

      myServo.write(90);
      currentAngle = 90;

      xeDangChoQuetThe = false;
    }
  }

  // ===== XE RA =====
  if (d2 > 0 && d2 < 10 && !xeDangRa) {
    Serial.println("Xe ra cong");

    myServo.write(90);
    currentAngle = 90;

    xeDangRa = true;
  }

  if (d2 > 15) {
    xeDangRa = false;
  }

  // ===== ĐÓNG BARRIER =====
  if (currentAngle == 90 && d1 > 15 && d2 > 15) {
    delay(1000);
    myServo.write(0);
    currentAngle = 0;
  }

  delay(100);
}