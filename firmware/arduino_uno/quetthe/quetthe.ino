#include <SPI.h>
#include <MFRC522.h>

// ===== KẾT NỐI CHÂN RFID =====
// SPI Chung: SCK (13), MISO (12), MOSI (11)
// Cổng VÀO
#define SS_PIN_IN    10  // Chân SS (SDA) cổng vào
#define RST_PIN_IN   9   // Chân RST cổng vào

// Cổng RA
#define SS_PIN_OUT   8   // Chân SS (SDA) cổng ra
#define RST_PIN_OUT  7   // Chân RST cổng ra

// Khởi tạo các đối tượng RFID
MFRC522 mfrc522_in(SS_PIN_IN, RST_PIN_IN);
MFRC522 mfrc522_out(SS_PIN_OUT, RST_PIN_OUT);

void setup() {
  // Giao tiếp Serial với ESP32 ở baudrate 9600
  Serial.begin(9600);
  while (!Serial); // Chờ Serial khởi động xong

  SPI.begin(); // Khởi tạo SPI bus

  // Khởi tạo RFID cổng vào và cổng ra
  mfrc522_in.PCD_Init();
  mfrc522_out.PCD_Init();

  Serial.println("UNO_RFID_READY");
}

void loop() {
  quetthe();
  delay(50);
}

// Hàm kích hoạt và quét module thẻ RFID
void quetthe() {
  // --- 1. KIỂM TRA RFID CỔNG VÀO ---
  if (mfrc522_in.PICC_IsNewCardPresent() && mfrc522_in.PICC_ReadCardSerial()) {
    String cardID = getUIDString(mfrc522_in.uid.uidByte, mfrc522_in.uid.size);
    Serial.println("IN:" + cardID); // Gửi mã thẻ cổng vào qua UART sang ESP32
    
    // Dừng đọc thẻ hiện tại
    mfrc522_in.PICC_HaltA();
    mfrc522_in.PCD_StopCrypto1();
    delay(500); // Tránh đọc lặp thẻ quá nhanh
  }

  // --- 2. KIỂM TRA RFID CỔNG RA ---
  if (mfrc522_out.PICC_IsNewCardPresent() && mfrc522_out.PICC_ReadCardSerial()) {
    String cardID = getUIDString(mfrc522_out.uid.uidByte, mfrc522_out.uid.size);
    Serial.println("OUT:" + cardID); // Gửi mã thẻ cổng ra qua UART sang ESP32
    
    // Dừng đọc thẻ hiện tại
    mfrc522_out.PICC_HaltA();
    mfrc522_out.PCD_StopCrypto1();
    delay(500); // Tránh đọc lặp thẻ quá nhanh
  }
}

// Hàm hỗ trợ chuyển UID thẻ sang chuỗi Hex viết hoa
String getUIDString(byte *buffer, byte bufferSize) {
  String uidStr = "";
  for (byte i = 0; i < bufferSize; i++) {
    if (buffer[i] < 0x10) {
      uidStr += "0";
    }
    uidStr += String(buffer[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}