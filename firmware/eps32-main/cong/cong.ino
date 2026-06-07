#include <ESP32Servo.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ===== CẤU HÌNH WI-FI & MQTT =====
const char* ssid = "Cun Cun";             // <--- Thay bằng tên Wi-Fi của bạn
const char* password = "12345689";     // <--- Thay bằng mật khẩu Wi-Fi của bạn
const char* mqtt_server = "192.168.1.95"; // <--- Thay bằng IP máy tính chạy Docker (Ví dụ: 192.168.1.15)

WiFiClient espClient;
PubSubClient client(espClient);

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

// ===== UART với Uno =====
HardwareSerial SerialUno(1); // UART1

// ===== Trạng thái kết nối UART =====
bool receivedMega = false;
bool receivedUno = false;
unsigned long lastConnectionCheck = 0;
const unsigned long checkInterval = 3000; // Cảnh báo định kỳ mỗi 3 giây

// Mảng lưu trạng thái chi tiết của 6 chỗ đỗ (false = trống, true = có xe)
bool slotStatus[6] = {false, false, false, false, false, false}; 

// ===== STATE =====
bool xeDangChoQuetThe = false;
bool xeDangRa = false;
String rfidUid = "";           // Biến tạm lưu UID thẻ xe vãng lai
bool dangChoXeVao = false;     // Chờ xe đi qua cảm biến trong
bool xeDaVaoTrong = false;     // Xác nhận xe đã chạm cảm biến trong (d2 < 10)
bool dangChoXeRa = false;      // Chờ xe đi qua cảm biến ngoài
bool xeDaRaNgoai = false;      // Xác nhận xe đã chạm cảm biến ngoài (d1 < 10)
bool enableScanID = false;     // Cho phép quét thẻ để điều khiển barrier (mặc định tắt)

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

// Hàm kích hoạt servo mở cửa
void moraochan() {
  Serial.println("Mo barrier!");
  myServo.write(90);
  currentAngle = 90;
}

// Hàm kết nối Wi-Fi
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

// Hàm xử lý khi nhận lệnh từ MQTT Broker
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Nếu nhận được lệnh mở cửa từ xa từ cổng Web
  if (String(topic) == "parking/commands/gate") {
    if (message == "OPEN") {
      moraochan();
    }
  }
}

// Hàm kết nối lại với MQTT Broker
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Thử kết nối với ID ngẫu nhiên
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      // Subscribe lại chủ đề nhận lệnh mở cổng
      client.subscribe("parking/commands/gate");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}


void setup() {
  Serial.begin(115200);

  // Khởi động UART2 kết nối thẳng với Mega
  SerialMega.begin(9600, SERIAL_8N1, 16, 17);
  SerialMega.setTimeout(50); 

  // Khởi động UART1 kết nối với Uno
  SerialUno.begin(9600, SERIAL_8N1, 26, 27); // RX=26, TX=27
  SerialUno.setTimeout(50);

  // Sensor
  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);

  pinMode(TRIG2, OUTPUT);
  pinMode(ECHO2, INPUT);

  // Servo
  myServo.attach(SERVO_PIN);
  myServo.write(0);

  // Kết nối Wi-Fi
  setup_wifi();
  
  // Cài đặt thông số MQTT Server
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  Serial.println("ESP32 Gate System Ready...");
}

void loop() {
  // Duy trì kết nối Wi-Fi & MQTT
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // ===== KIỂM TRA TRẠNG THÁI KẾT NỐI UART (ĐỊNH KỲ) =====
  if (millis() - lastConnectionCheck >= checkInterval) {
    lastConnectionCheck = millis();
    if (!receivedMega) {
      Serial.println("[UART STATUS] CHUA nhan duoc tin hieu tu ARDUINO MEGA! (Kiem tra day TX Mega -> RX16 ESP32)");
    }
    if (!receivedUno) {
      Serial.println("[UART STATUS] CHUA nhan duoc tin hieu tu ARDUINO UNO! (Kiem tra day TX Uno -> RX26 ESP32, hoac quet the thu)");
    }
  }

  // ===== 1. NHẬN VÀ BÓC TÁCH DỮ LIỆU TỪ MEGA =====
  if (SerialMega.available()) {
    String data = SerialMega.readStringUntil('\n');
    data.trim();

    if (!receivedMega) {
      Serial.print("[UART STATUS] -> DA NHAN DUOC TIN HIEU TU ARDUINO MEGA! Du lieu dau tien: ");
      Serial.println(data);
      receivedMega = true;
    }

    // 1.1 Tách tổng số chỗ trống
    int idx = data.indexOf("EMPTY:");
    if (idx != -1) {
      soChoTrong = data.substring(idx + 6).toInt();
    }

    // 1.2 Tách trạng thái chi tiết của từng chỗ đỗ và báo ô trống khi xe đỗ vào
    for (int i = 0; i < 6; i++) {
      String matchStr = "S" + String(i + 1) + ": CO XE"; 
      bool currentSlotHasCar = (data.indexOf(matchStr) != -1);
      
      // Nếu ô đỗ trước đó TRỐNG (false) mà bây giờ CÓ XE (true) thì báo
      if (currentSlotHasCar && !slotStatus[i]) {
        Serial.print("Xe da vao o do: S");
        Serial.println(i + 1);
        
        // Publish lên MQTT
        String payload = "S" + String(i + 1) + ": CO XE";
        client.publish("parking/events/slots", payload.c_str());
      }
      // Nếu ô đỗ trước đó CÓ XE (true) mà bây giờ TRỐNG (false) thì báo xe ra
      else if (!currentSlotHasCar && slotStatus[i]) {
        Serial.print("Xe da roi khoi o do: S");
        Serial.println(i + 1);
        
        // Publish lên MQTT
        String payload = "S" + String(i + 1) + ": TRONG";
        client.publish("parking/events/slots", payload.c_str());
      }
      slotStatus[i] = currentSlotHasCar;
    }

    // [IN RA ĐỂ TEST] - Hiển thị lên màn hình xem ESP32 đã tách đúng chưa
    Serial.print("Thong ke nhanh -> Trong: ");
    Serial.print(soChoTrong);
    Serial.print(" | Chi tiet: ");
    for(int i = 0; i < 6; i++){
      Serial.print("S"); 
      Serial.print(i + 1); 
      Serial.print(slotStatus[i] ? "=(FULL) " : "=(TRONG) ");
    }
    Serial.println();
  }

  // ===== 1.5 NHẬN VÀ BÓC TÁCH DỮ LIỆU TỪ UNO (RFID) =====
  if (SerialUno.available()) {
    String data = SerialUno.readStringUntil('\n');
    data.trim();

    if (!receivedUno) {
      Serial.print("[UART STATUS] -> DA NHAN DUOC TIN HIEU TU ARDUINO UNO! Du lieu dau tien: ");
      Serial.println(data);
      receivedUno = true;
    }

    if (enableScanID) {
      if (data.startsWith("IN:")) {
        String cardID = data.substring(3);
        Serial.print("QUET THE CONG VAO - ID: ");
        Serial.println(cardID);

        if (xeDangChoQuetThe) {
          if (soChoTrong > 0) {
          rfidUid = cardID; // Lưu tạm vào biến tạm rfidUid (xe vãng lai)
          Serial.print("Da luu rfidUid tam: ");
          Serial.println(rfidUid);
          moraochan(); // Gọi hàm mở rào chắn
          dangChoXeVao = true;
          xeDaVaoTrong = false;
          enableScanID = false; // Tắt quét thẻ sau khi nhận dạng thành công
          
          // Publish sự kiện thẻ vào lên MQTT
          client.publish("parking/events/gate/in", cardID.c_str());
        } else {
            Serial.println("Het cho! Khong the mo barrier.");
          }
        }
      } 
      else if (data.startsWith("OUT:")) {
        String cardID = data.substring(4);
        Serial.print("QUET THE CONG RA - ID: ");
        Serial.println(cardID);

        if (xeDangRa) {
          if (cardID == rfidUid) {
            Serial.println("THE KHOP. Mo barrier!");
          moraochan(); // Gọi hàm mở rào chắn
          dangChoXeRa = true;
          xeDaRaNgoai = false;
          rfidUid = ""; // Xoá biến tạm sau khi khớp thẻ ra
          enableScanID = false; // Tắt quét thẻ sau khi nhận dạng thành công
          
          // Publish sự kiện thẻ ra lên MQTT
          client.publish("parking/events/gate/out", cardID.c_str());
        } else {
            Serial.print("THE KHONG KHOP! (The ra: ");
            Serial.print(cardID);
            Serial.print(" | The da luu: ");
            Serial.print(rfidUid);
            Serial.println(")");
          }
        }
      }
    } else {
      // Chế độ chờ xe hoặc quét thô từ xa để đăng ký thẻ tháng (không mở cổng)
      if (data.startsWith("IN:")) {
        String cardID = data.substring(3);
        Serial.print("RFID_IN_SCAN_RAW: ");
        Serial.println(cardID);
      } else if (data.startsWith("OUT:")) {
        String cardID = data.substring(4);
        Serial.print("RFID_OUT_SCAN_RAW: ");
        Serial.println(cardID);
      }
    }
  }

  // ===== 2. ĐỌC CẢM BIẾN SIÊU ÂM =====
  float d1 = getDistance(TRIG1, ECHO1);
  float d2 = getDistance(TRIG2, ECHO2);

  // ===== 3. LOGIC XE VÀO (CẢM BIẾN 1) =====
  if (d1 > 0 && d1 < 10) {
    if (!xeDangChoQuetThe) {
      Serial.println("Xe den, vui long quet the...");
      xeDangChoQuetThe = true;
      enableScanID = true; // Kích hoạt quét thẻ
    }
  } 
  else if (d1 > 15 || d1 == -1) {
    if (xeDangChoQuetThe) {
      xeDangChoQuetThe = false; 
      enableScanID = false; // Hủy kích hoạt nếu xe lùi đi mất
    }
  }

  // ===== 4. CHO XE VAO: DOI RFID TU UNO GUI SANG =====
  if (xeDangChoQuetThe && soChoTrong == 0) {
    static unsigned long lastBaoHetCho = 0;
    if (millis() - lastBaoHetCho > 3000) {
      Serial.println("Het cho! Khong the vao.");
      lastBaoHetCho = millis();
    }
  }

  // ===== 5. LOGIC XE RA (CẢM BIẾN 2) =====
  if (d2 > 0 && d2 < 10) {
    if (!xeDangRa) {
      Serial.println("Xe ra cong, vui long quet the...");
      xeDangRa = true;
      enableScanID = true; // Kích hoạt quét thẻ
    }
  } 
  else if (d2 > 15 || d2 == -1) {
    if (xeDangRa) {
      xeDangRa = false;
      enableScanID = false; // Hủy kích hoạt nếu xe lùi đi mất
    }
  }

  // ===== 6. ĐÓNG BARRIER AN TOÀN =====
  // Logic xe vào: đóng cửa khi xe đi qua hẳn cảm biến bên trong (TRIG2/ECHO2)
  if (dangChoXeVao) {
    if (d2 > 0 && d2 < 10) {
      xeDaVaoTrong = true; // Xe bắt đầu đi qua cảm biến trong
    }
    if (xeDaVaoTrong && (d2 > 15 || d2 == -1)) {
      delay(1000); // Chờ đuôi xe qua hẳn
      myServo.write(0);
      currentAngle = 0;
      xeDaVaoTrong = false;
      dangChoXeVao = false;
      Serial.println("Dong cong (Xe da vao)!");
    }
  }

  // Logic xe ra: đóng cửa khi xe đi qua hẳn cảm biến bên ngoài (TRIG1/ECHO1)
  if (dangChoXeRa) {
    if (d1 > 0 && d1 < 10) {
      xeDaRaNgoai = true; // Xe bắt đầu đi qua cảm biến ngoài
    }
    if (xeDaRaNgoai && (d1 > 15 || d1 == -1)) {
      delay(1000); // Chờ đuôi xe qua hẳn
      myServo.write(0);
      currentAngle = 0;
      xeDaRaNgoai = false;
      dangChoXeRa = false;
      Serial.println("Dong cong (Xe da ra)!");
    }
  }

  delay(50);
}