#include <ESP32Servo.h>

#define TRIG1 19   // HC-SR04
#define ECHO1 18

#define TRIG2 5    // US-015
#define ECHO2 17

#define SERVO_PIN 21

Servo myServo;

int currentAngle = 0; // lưu trạng thái servo

// Hàm đo khoảng cách
float getDistance(int trigPin, int echoPin) {
  long duration;

  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duration = pulseIn(echoPin, HIGH, 30000); // timeout

  if (duration == 0) return -1; // lỗi

  return duration * 0.034 / 2;
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);

  pinMode(TRIG2, OUTPUT);
  pinMode(ECHO2, INPUT);

  myServo.attach(SERVO_PIN);
  myServo.write(0);
}

void loop() {
  float d1 = getDistance(TRIG1, ECHO1); // HC-SR04
  float d2 = getDistance(TRIG2, ECHO2); // US-015

  Serial.print("SR04: ");
  Serial.print(d1);
  Serial.print(" cm | US015: ");
  Serial.print(d2);
  Serial.println(" cm");

  // Ưu tiên đóng (an toàn hơn)
  if (d2 > 0 && d2 < 5) {
    if (currentAngle != 0) {
      myServo.write(0);
      currentAngle = 0;
    }
  }
  // Mở khi SR04 kích hoạt
  else if (d1 > 0 && d1 < 5) {
    if (currentAngle != 90) {
      myServo.write(90);
      currentAngle = 90;
    }
  }

  delay(200);
}