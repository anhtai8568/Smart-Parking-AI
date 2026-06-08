#include <ESP32Servo.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ===== CẤU HÌNH WI-FI & MQTT =====
const char* ssid        = "Cun Cun";
const char* password    = "12345689";
const char* mqtt_server = "192.168.1.110"; // IP máy chạy Docker

WiFiClient   espClient;
PubSubClient client(espClient);

// ===== CHÂN PHẦN CỨNG =====
#define TRIG1     19
#define ECHO1     18
#define TRIG2      5
#define ECHO2      4
#define SERVO_PIN 21

Servo myServo;

// ===== UART =====
HardwareSerial SerialMega(2); // UART2 – Mega  (RX16, TX17)
HardwareSerial SerialUno(1);  // UART1 – Uno   (RX26, TX27)

// ===== TRẠNG THÁI HỆ THỐNG =====
int  soChoTrong      = -1;
bool slotStatus[6]   = {true, true, true, true, true, true}; // khởi = true → lần đầu nhận Mega sẽ detect thay đổi

bool xeDangVao       = false;  // Sensor 1 đang thấy xe (cổng vào)
bool xeDangRa        = false;  // Sensor 2 đang thấy xe (cổng ra)
bool enableScanID    = false;  // Cho phép nhận thẻ RFID

String rfidUid       = "";     // UID thẻ vãng lai đã lưu tạm

bool dangChoXeVao    = false;  // Đang chờ xe đi qua hẳn sau khi mở (vào)
bool dangChoXeRa     = false;  // Đang chờ xe đi qua hẳn sau khi mở (ra)
bool xeDaVaoTrong    = false;
bool xeDaRaNgoai     = false;

// ===== DEBOUNCE CẢM BIẾN =====
// Chỉ tắt enableScanID sau khi mất tín hiệu liên tục >= DEBOUNCE_MS
const unsigned long DEBOUNCE_MS = 2000;
unsigned long lastSeenD1        = 0;
unsigned long lastSeenD2        = 0;

// ===== TIMER =====
unsigned long lastUartCheck     = 0;
const unsigned long UART_CHECK_INTERVAL = 3000;
bool receivedMega = false;
bool receivedUno  = false;

unsigned long lastReconnectAttempt = 0;

// ===== KHOẢNG CÁCH =====
// Timeout 8ms (≈136cm) – ngắn đủ để MQTT loop() chạy kịp
float getDistance(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long d = pulseIn(echo, HIGH, 8000);
  return (d == 0) ? -1.0f : d * 0.034f / 2.0f;
}

// ===== MỞ / ĐÓNG BARRIER =====
void openBarrier() {
  Serial.println("[BARRIER] Mo!");
  myServo.write(90);
}

void closeBarrier() {
  Serial.println("[BARRIER] Dong!");
  myServo.write(0);
}

// ===== XỬ LÝ THẺ RFID =====
// Gọi mỗi khi nhận được gói "CARD:<id>" từ Uno
void handleRFID(const String& cardID) {
  if (!enableScanID) {
    // Chế độ đăng ký thẻ thô (không liên quan đến cổng)
    Serial.print("[RFID RAW] ");
    Serial.println(cardID);
    return;
  }

  if (xeDangVao) {
    // ---- CỔNG VÀO ----
    Serial.print("[RFID VAO] ID: "); Serial.println(cardID);
    if (soChoTrong > 0) {
      rfidUid = cardID;
      openBarrier();
      dangChoXeVao  = true;
      xeDaVaoTrong  = false;
      enableScanID  = false;
      client.publish("parking/events/gate/in", cardID.c_str());
      Serial.println("[RFID VAO] Luu UID, mo cong.");
    } else {
      Serial.println("[RFID VAO] Het cho! Khong mo cong.");
    }

  } else if (xeDangRa) {
    // ---- CỔNG RA ----
    Serial.print("[RFID RA] ID: "); Serial.println(cardID);
    if (cardID == rfidUid) {
      Serial.println("[RFID RA] The khop. Mo cong.");
      openBarrier();
      dangChoXeRa  = true;
      xeDaRaNgoai  = false;
      rfidUid      = "";
      enableScanID = false;
      client.publish("parking/events/gate/out", cardID.c_str());
    } else {
      Serial.print("[RFID RA] The KHONG khop! Nhan: ");
      Serial.print(cardID);
      Serial.print(" | Luu: ");
      Serial.println(rfidUid);
    }
  }
}

// ===== XỬ LÝ DỮ LIỆU TỪ MEGA (CHỖ ĐỖ XE) =====
void handleMegaData(const String& data) {
  // Lấy số chỗ trống
  int idx = data.indexOf("EMPTY:");
  if (idx != -1) soChoTrong = data.substring(idx + 6).toInt();

  // Cập nhật từng slot, publish khi có thay đổi
  for (int i = 0; i < 6; i++) {
    String key = "S" + String(i + 1) + ": CO XE";
    bool hasCar = (data.indexOf(key) != -1);
    if (hasCar != slotStatus[i]) {
      String payload = "S" + String(i + 1) + (hasCar ? ": CO XE" : ": TRONG");
      client.publish("parking/events/slots", payload.c_str());
      Serial.print("[SLOT] "); Serial.println(payload);
    }
    slotStatus[i] = hasCar;
  }

  // Log nhanh
  Serial.print("[SLOT TONG] Trong:");
  Serial.print(soChoTrong);
  Serial.print(" |");
  for (int i = 0; i < 6; i++) {
    Serial.print(" S"); Serial.print(i+1);
    Serial.print(slotStatus[i] ? "=FULL" : "=OK ");
  }
  Serial.println();
}

// ===== XỬ LÝ CẢM BIẾN + LOGIC CỔNG =====
// Tất cả logic phát hiện xe và tự động đóng barrier
void handleSensors(float d1, float d2) {
  unsigned long now = millis();

  // -- CỔNG VÀO (sensor 1) --
  if (d1 > 0 && d1 < 10) {
    lastSeenD1 = now;
    if (!xeDangVao) {
      Serial.println("[SENSOR1] Xe den cong vao, cho quet the...");
      xeDangVao   = true;
      enableScanID = true;
    }
  } else if (xeDangVao && (now - lastSeenD1 >= DEBOUNCE_MS)) {
    Serial.println("[SENSOR1] Xe da roi (debounce het).");
    xeDangVao   = false;
    enableScanID = false;
  }

  // -- CỔNG RA (sensor 2) --
  if (d2 > 0 && d2 < 10) {
    lastSeenD2 = now;
    if (!xeDangRa) {
      Serial.println("[SENSOR2] Xe den cong ra, cho quet the...");
      xeDangRa    = true;
      enableScanID = true;
    }
  } else if (xeDangRa && (now - lastSeenD2 >= DEBOUNCE_MS)) {
    Serial.println("[SENSOR2] Xe da roi (debounce het).");
    xeDangRa    = false;
    enableScanID = false;
  }

  // -- TỰ ĐÓNG BARRIER SAU KHI XE ĐI QUA (cổng vào) --
  if (dangChoXeVao) {
    if (d2 > 0 && d2 < 10) xeDaVaoTrong = true;
    if (xeDaVaoTrong && (d2 > 15 || d2 == -1)) {
      static unsigned long t = 0;
      if (t == 0) t = now;
      if (now - t >= 1000) {
        closeBarrier();
        xeDaVaoTrong = false;
        dangChoXeVao = false;
        t = 0;
        Serial.println("[BARRIER] Tu dong dong (xe da vao).");
      }
    }
  }

  // -- TỰ ĐÓNG BARRIER SAU KHI XE ĐI QUA (cổng ra) --
  if (dangChoXeRa) {
    if (d1 > 0 && d1 < 10) xeDaRaNgoai = true;
    if (xeDaRaNgoai && (d1 > 15 || d1 == -1)) {
      static unsigned long t = 0;
      if (t == 0) t = now;
      if (now - t >= 1000) {
        closeBarrier();
        xeDaRaNgoai = false;
        dangChoXeRa = false;
        t = 0;
        Serial.println("[BARRIER] Tu dong dong (xe da ra).");
      }
    }
  }
}

// ===== MQTT CALLBACK =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.print("[MQTT IN] "); Serial.print(topic); Serial.print(" -> "); Serial.println(msg);

  if (String(topic) == "parking/commands/gate") {
    if      (msg == "OPEN")  openBarrier();
    else if (msg == "CLOSE") closeBarrier();
  }
}

// ===== MQTT RECONNECT (non-blocking) =====
void mqttReconnect() {
  if (client.connected()) return;
  unsigned long now = millis();
  if (now - lastReconnectAttempt < 5000) return;
  lastReconnectAttempt = now;

  Serial.print("[MQTT] Reconnecting...");
  String id = "ESP32-Gate-" + String(random(0xffff), HEX);
  if (client.connect(id.c_str())) {
    Serial.println(" OK");
    client.subscribe("parking/commands/gate");
  } else {
    Serial.print(" FAIL rc="); Serial.println(client.state());
  }
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);

  SerialMega.begin(9600, SERIAL_8N1, 16, 17);
  SerialMega.setTimeout(50);

  SerialUno.begin(9600, SERIAL_8N1, 26, 27);
  SerialUno.setTimeout(50);

  pinMode(TRIG1, OUTPUT); pinMode(ECHO1, INPUT);
  pinMode(TRIG2, OUTPUT); pinMode(ECHO2, INPUT);

  myServo.attach(SERVO_PIN);
  myServo.write(0);

  // Wi-Fi
  Serial.print("[WIFI] Connecting to "); Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.print("\n[WIFI] Connected. IP: "); Serial.println(WiFi.localIP());

  // MQTT
  client.setServer(mqtt_server, 1883);
  client.setCallback(mqttCallback);
  client.setKeepAlive(60);

  Serial.println("[SYS] ESP32 Gate Ready.");
}

// ===== LOOP =====
void loop() {
  // 1. Duy trì MQTT
  mqttReconnect();
  client.loop();

  // 2. Cảnh báo UART (định kỳ)
  unsigned long now = millis();
  if (now - lastUartCheck >= UART_CHECK_INTERVAL) {
    lastUartCheck = now;
    if (!receivedMega) Serial.println("[WARN] Chua nhan Mega UART!");
    if (!receivedUno)  Serial.println("[WARN] Chua nhan Uno UART!");
  }

  // 3. Đọc Mega → trạng thái chỗ đỗ xe
  if (SerialMega.available()) {
    String data = SerialMega.readStringUntil('\n');
    data.trim();
    Serial.print("[MEGA] "); Serial.println(data);
    if (!receivedMega) { receivedMega = true; Serial.println("[UART] Mega OK!"); }
    handleMegaData(data);
  }

  // 4. Đọc Uno → RFID
  if (SerialUno.available()) {
    String data = SerialUno.readStringUntil('\n');
    data.trim();
    Serial.print("[UNO] "); Serial.println(data);
    if (!receivedUno) { receivedUno = true; Serial.println("[UART] Uno OK!"); }
    if (data.startsWith("CARD:")) {
      handleRFID(data.substring(5));
    }
  }

  // 5. Đọc cảm biến + xử lý cổng
  float d1 = getDistance(TRIG1, ECHO1);
  client.loop(); // giữ MQTT alive trong khoảng pulseIn
  float d2 = getDistance(TRIG2, ECHO2);
  client.loop();

  handleSensors(d1, d2);

  delay(5);
}