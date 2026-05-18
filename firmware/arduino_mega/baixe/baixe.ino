#define S1_PIN 32
#define S2_PIN 34
#define S3_PIN 36
#define S4_PIN 38
#define S5_PIN 40
#define S6_PIN 42

// Mạng lưu trạng thái trước đó để so sánh chống spam UART
int prev[6] = {-1, -1, -1, -1, -1, -1};

// Hàm lọc nhiễu phần mềm cực tốt cho cảm biến hồng ngoại
int readStable(int pin){
  int count = 0;
  for(int i = 0; i < 10; i++){
    if(digitalRead(pin) == 1) count++;
    delay(2);
  }
  return (count >= 7) ? 1 : 0;
}

void setup() {
  Serial.begin(9600);    // Debug lên máy tính
  Serial1.begin(9600);   // Giao tiếp UART phần cứng nối thẳng với ESP32

  pinMode(S1_PIN, INPUT);
  pinMode(S2_PIN, INPUT);
  pinMode(S3_PIN, INPUT);
  pinMode(S4_PIN, INPUT);
  pinMode(S5_PIN, INPUT);
  pinMode(S6_PIN, INPUT);

  Serial.println("Mega Sensor Board Ready...");
}

void loop() {
  int s[6];

  s[0] = readStable(S1_PIN);
  s[1] = readStable(S2_PIN);
  s[2] = readStable(S3_PIN);
  s[3] = readStable(S4_PIN);
  s[4] = readStable(S5_PIN);
  s[5] = readStable(S6_PIN);

  // ===== KIỂM TRA XEM CÓ SỰ THAY ĐỔI XE RA/VÀO CHUỒNG KHÔNG =====
  bool hasChanged = false;
  for(int i = 0; i < 6; i++){
    if(s[i] != prev[i]){
      hasChanged = true;
      prev[i] = s[i]; 
    }
  }

  // ===== CHỈ GỬI KHI CÓ THAY ĐỔI HOẶC ĐỊNH KỲ 5 GIÂY (HEARTBEAT) =====
  static unsigned long lastForceSend = 0;
  
  if (hasChanged || millis() - lastForceSend > 5000) {
    int empty = 0;
    String msg = "";

    for(int i = 0; i < 6; i++){
      if(s[i] == 0) empty++;

      msg += "S";
      msg += String(i+1);
      msg += ": ";
      msg += (s[i] == 1 ? "CO XE" : "TRONG");

      if(i < 5) msg += " | ";
    }

    msg += " || EMPTY:";
    msg += String(empty);

    // Xuất dữ liệu đồng thời lên cả 2 cổng Serial
    Serial.println(msg);     // Xem trên máy tính
    Serial1.println(msg);    // Bắn sang chân RX2 của ESP32

    lastForceSend = millis();
  }

  delay(50); 
}