#include <Servo.h>

Servo myServo;

void setup() {
  myServo.attach(9);
}

void loop() {

  // Quay từ 0 -> 90 độ chậm
  for(int angle = 0; angle <= 90; angle++) {
    myServo.write(angle);
    delay(10);   // tăng delay để quay chậm hơn
  }

  delay(1000);

  // Quay từ 90 -> 0 độ chậm
  for(int angle = 90; angle >= 0; angle--) {
    myServo.write(angle);
  
  }

  delay(2000);
}