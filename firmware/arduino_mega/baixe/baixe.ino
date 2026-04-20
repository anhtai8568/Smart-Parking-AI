#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 53
#define RST_PIN 48

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();

  Serial.println("Quet the RFID...");
}

void loop() {
  // Chưa có thẻ
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // Đọc thẻ
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  Serial.print("UID the: ");
  
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i], HEX);
    Serial.print(" ");
  }
  
  Serial.println();
}