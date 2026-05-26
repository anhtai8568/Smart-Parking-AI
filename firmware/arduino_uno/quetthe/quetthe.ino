#include <SPI.h>
#include <MFRC522.h>

// Định nghĩa chân cho Cổng Vào (Module 1)
#define SS_VAO  10
#define RST_VAO 9

// Định nghĩa chân cho Cổng Ra (Module 2)
#define SS_RA   8
#define RST_RA  7

// Khởi tạo 2 đối tượng MFRC522
MFRC522 mfrc1(SS_VAO, RST_VAO);
MFRC522 mfrc2(SS_RA, RST_RA);

void setup() {
  Serial.begin(9600);
  SPI.begin();       // Khởi tạo bus SPI chung

  pinMode(SS_VAO, OUTPUT);
  pinMode(SS_RA, OUTPUT);
  digitalWrite(SS_VAO, HIGH);
  digitalWrite(SS_RA, HIGH);
  
  mfrc1.PCD_Init();  // Khởi tạo Module 1
  mfrc2.PCD_Init();  // Khởi tạo Module 2
  
  Serial.println("He thong san sang!");
  Serial.println("Dang cho quet the...");
}

void loop() {
  // Kiểm tra Cổng Vào
  if (mfrc1.PICC_IsNewCardPresent() && mfrc1.PICC_ReadCardSerial()) {
    Serial.print("CONG VAO_UID:");
    printUID(mfrc1);
    mfrc1.PICC_HaltA(); 
    mfrc1.PCD_StopCrypto1();
  }

  // Kiểm tra Cổng Ra
  if (mfrc2.PICC_IsNewCardPresent() && mfrc2.PICC_ReadCardSerial()) {
    Serial.print("CONG RA_UID:");
    printUID(mfrc2);
    mfrc2.PICC_HaltA();
    mfrc2.PCD_StopCrypto1();
  }
}

// Hàm hỗ trợ hiển thị mã UID
void printUID(MFRC522 &reader) {
  for (byte i = 0; i < reader.uid.size; i++) {
    Serial.print(reader.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(reader.uid.uidByte[i], HEX);
  }
  Serial.println();
}
