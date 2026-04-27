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
#define ECHO2 17

// ===== SERVO =====
#define SERVO_PIN 21
Servo myServo;

int currentAngle = 0;

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
  float d1 = getDistance(TRIG1, ECHO1);
  float d2 = getDistance(TRIG2, ECHO2);

  // ===== XE TỚI CỔNG → CHỜ QUÉT THẺ =====
  if (d1 > 0 && d1 < 5 && !xeDangChoQuetThe) {
    Serial.println("Xe den, vui long quet the...");
    xeDangChoQuetThe = true;
  }

  // ===== QUÉT RFID =====
  if (xeDangChoQuetThe) {
    String uid = readUID();

    if (uid != "") {
      Serial.print("UID: ");
      Serial.println(uid);

      // 👉 sau này check DB ở đây
      Serial.println("Mo cong!");

      myServo.write(90);
      currentAngle = 90;

      xeDangChoQuetThe = false;
    }
  }

  // ===== XE RA =====
  if (d2 > 0 && d2 < 5 && !xeDangRa) {
    Serial.println("Xe ra cong");

    myServo.write(90);
    currentAngle = 90;

    xeDangRa = true;
  }

  if (d2 > 10) {
    xeDangRa = false;
  }

  // ===== ĐÓNG BARRIER =====
  if (currentAngle == 90 && d1 > 10 && d2 > 10) {
    delay(1000);
    myServo.write(0);
    currentAngle = 0;
  }

  delay(100);
}