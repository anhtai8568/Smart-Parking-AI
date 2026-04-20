#include <ESP32Servo.h>

#define TRIG1 19
#define ECHO1 18

#define TRIG2 5
#define ECHO2 17

#define SERVO_PIN 21

#define SLOT1 35
#define SLOT2 32
#define SLOT3 33

Servo myServo;

int currentAngle = 0;

// ===== STATE =====
bool xeDangVao = false;
bool daBaoSlot = false;

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

// ===== Đọc slot =====
int getSlot() {
  int s1 = digitalRead(SLOT1);
  int s2 = digitalRead(SLOT2);
  int s3 = digitalRead(SLOT3);

  if (s1 == 1) return 1;
  if (s2 == 1) return 2;
  if (s3 == 1) return 3;

  return 0;
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);

  pinMode(TRIG2, OUTPUT);
  pinMode(ECHO2, INPUT);

  pinMode(SLOT1, INPUT);
  pinMode(SLOT2, INPUT);
  pinMode(SLOT3, INPUT);

  myServo.attach(SERVO_PIN);
  myServo.write(0);
}

void loop() {
  float d1 = getDistance(TRIG1, ECHO1);
  float d2 = getDistance(TRIG2, ECHO2);

  // ===== XE VÀO =====
  if (d1 > 0 && d1 < 5 && !xeDangVao) {
    Serial.println("Xe dang vao bai");

    myServo.write(90); // mở
    currentAngle = 90;

    xeDangVao = true;
    daBaoSlot = false; // reset để chuẩn bị báo slot
  }

  // ===== XÁC ĐỊNH SLOT (chỉ in 1 lần) =====
  if (xeDangVao && !daBaoSlot) {
    int slot = getSlot();

    if (slot != 0) {
      Serial.print("Xe dang o o so: ");
      Serial.println(slot);

      daBaoSlot = true; // CHẶN spam
    }
  }

  // ===== XE RA =====
  if (d2 > 0 && d2 < 5) {
    Serial.println("Xe ra cong");

    myServo.write(90);
    currentAngle = 90;

    xeDangVao = false;
    daBaoSlot = false;
  }

  // ===== ĐÓNG BARRIER =====
  if (currentAngle == 90 && d1 > 10 && d2 > 10) {
    delay(1000);
    myServo.write(0);
    currentAngle = 0;
  }

  delay(100);
}