#include <SPI.h>
#include <MFRC522.h>

// ===== KẾT NỐI CHÂN RFID (DÙNG CHUNG 1 ĐẦU ĐỌC) =====
// SPI Chung: SCK (13), MISO (12), MOSI (11)
#define SS_PIN    8   // Chân SS (SDA) nối với D8 (đầu đọc dùng chung)
#define RST_PIN   7   // Chân RST nối với D7 (đầu đọc dùng chung)

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  // Giao tiếp Serial với ESP32 ở baudrate 9600
  Serial.begin(9600);
  while (!Serial); // Chờ Serial khởi động xong

  SPI.begin(); // Khởi tạo SPI bus

  // Khởi tạo RFID
  mfrc522.PCD_Init();

  Serial.println("UNO_RFID_READY");
}

void loop() {
  quetthe();
  
  // Gửi heartbeat định kỳ 5 giây để ESP32 biết Uno vẫn hoạt động
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 5000) {
    Serial.println("UNO_HEARTBEAT");
    lastHeartbeat = millis();
  }
  
  delay(50);
}

// Hàm kích hoạt và quét module thẻ RFID
void quetthe() {
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    String cardID = getUIDString(mfrc522.uid.uidByte, mfrc522.uid.size);
    Serial.println("CARD:" + cardID); // Gửi mã thẻ chung qua UART
    
    // Dừng đọc thẻ hiện tại
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    delay(1000); // Tránh đọc lặp thẻ quá nhanh (tăng lên 1s cho ổn định)
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