#include <ESP32Servo.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESPmDNS.h>

// ===== DEBUG FLAG =====
// Set DEBUG 0 khi chạy thực tế, 1 khi cần debug chi tiết
#define DEBUG 0

#if DEBUG
  #define DBG(x)   Serial.print(x)
  #define DBGLN(x) Serial.println(x)
#else
  #define DBG(x)
  #define DBGLN(x)
#endif

// Log quan trọng luôn in, bất kể DEBUG
#define LOG(x)   Serial.print(x)
#define LOGLN(x) Serial.println(x)

// ===== CẤU HÌNH WI-FI & MQTT =====
const char* ssid        = "Cun Cun";
const char* password    = "12345689";
const char* mqtt_server = "smartparking.local";

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
int  soChoTrong         = -1;
bool slotStatus[6]      = {true, true, true, true, true, true};
bool lastSlotStatus[6]  = {true, true, true, true, true, true}; // so sánh thay đổi

bool xeDangVao          = false;
bool xeDangRa           = false;
bool enableScanID       = false;

String rfidUid          = "";
bool dangChoXeVao       = false;
bool dangChoXeRa        = false;
bool xeDaVaoTrong       = false;
bool xeDaRaNgoai        = false;

// ===== DEBOUNCE CẢM BIẾN =====
const unsigned long DEBOUNCE_MS = 2000;
unsigned long lastSeenD1        = 0;
unsigned long lastSeenD2        = 0;

// ===== TIMERS =====
unsigned long lastUartCheck        = 0;
const unsigned long UART_CHECK_MS  = 10000; // Cảnh báo UART mỗi 10s
bool receivedMega                  = false;
bool receivedUno                   = false;

unsigned long lastReconnectAttempt = 0;

// MQTT chỉ log một lần khi mất/phục hồi
bool mqttWasConnected     = false;
bool mqttLostPrinted      = false;

// Heartbeat: chỉ in mỗi 10 giây
unsigned long lastHeartbeatLog = 0;
const unsigned long HEARTBEAT_LOG_MS = 10000;

// Slot summary: chỉ in mỗi 5 giây (debug)
unsigned long lastSlotSummary = 0;
const unsigned long SLOT_SUMMARY_MS = 5000;

// ===== ĐO KHOẢNG CÁCH =====
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
  LOGLN("[BARRIER] Mo!");
  myServo.write(90);
}

void closeBarrier() {
  LOGLN("[BARRIER] Dong tu tu...");
  for (int pos = 90; pos >= 0; pos--) {
    myServo.write(pos);
    delay(15); // 90 steps * 15ms = 1350ms total close time (hạ từ từ)
  }
}

// ===== XỬ LÝ THẺ RFID =====
void handleRFID(const String& cardID) {
  if (!enableScanID) {
    // Không in heartbeat RFID_RAW liên tục — chỉ in khi có thẻ thực sự
    LOGLN("[RFID RAW] " + cardID);
    return;
  }

  if (xeDangVao) {
    LOG("[RFID VAO] ID: "); LOGLN(cardID);
    if (soChoTrong > 0) {
      rfidUid      = cardID;
      enableScanID = false;
      dangChoXeVao = true;
      xeDaVaoTrong = false;
      openBarrier();
      client.publish("parking/events/gate/in", cardID.c_str());
      LOG("[RFID VAO] OK. Luu UID: "); LOGLN(rfidUid);
    } else {
      LOGLN("[RFID VAO] Het cho! Khong mo.");
    }
  } else if (xeDangRa) {
    LOG("[RFID RA] ID: "); LOGLN(cardID);
    if (cardID == rfidUid) {
      LOGLN("[RFID RA] The khop. Mo cong.");
      enableScanID = false;
      dangChoXeRa  = true;
      xeDaRaNgoai  = false;
      rfidUid      = "";
      openBarrier();
      client.publish("parking/events/gate/out", cardID.c_str());
    } else {
      LOG("[RFID RA] KHONG KHOP! Nhan="); LOG(cardID);
      LOG(" Luu="); LOGLN(rfidUid);
    }
  }
}

// ===== XỬ LÝ DỮ LIỆU MEGA (CHỖ ĐỖ) =====
// Chỉ publish & log khi trạng thái THAY ĐỔI
void handleMegaData(const String& data) {
  int idx = data.indexOf("EMPTY:");
  if (idx != -1) soChoTrong = data.substring(idx + 6).toInt();

  bool anyChange = false;
  for (int i = 0; i < 6; i++) {
    String key   = "S" + String(i + 1) + ": CO XE";
    bool hasCar  = (data.indexOf(key) != -1);
    if (hasCar != slotStatus[i]) {
      anyChange    = true;
      String msg   = "S" + String(i + 1) + (hasCar ? ": CO XE" : ": TRONG");
      client.publish("parking/events/slots", msg.c_str());
      LOG("[SLOT] "); LOGLN(msg);
    }
    slotStatus[i]     = hasCar;
    lastSlotStatus[i] = hasCar;
  }

  // In tóm tắt chỉ ở chế độ DEBUG, và chỉ mỗi 5 giây
  #if DEBUG
  unsigned long now = millis();
  if (now - lastSlotSummary >= SLOT_SUMMARY_MS) {
    lastSlotSummary = now;
    DBG("[SLOT] Trong:"); DBG(soChoTrong); DBG(" |");
    for (int i = 0; i < 6; i++) {
      DBG(" S"); DBG(i + 1);
      DBG(slotStatus[i] ? "=FULL" : "=OK ");
    }
    DBGLN("");
  }
  #endif
}

// ===== XỬ LÝ CẢM BIẾN + LOGIC CỔNG =====
void handleSensors(float d1, float d2) {
  unsigned long now = millis();

  // -- CỔNG VÀO (sensor 1) --
  if (d1 > 0 && d1 < 10) {
    lastSeenD1 = now;
    if (!xeDangVao) {
      LOGLN("[SENSOR1] Xe den cong vao.");
      xeDangVao    = true;
      enableScanID = true;
      client.publish("parking/events/sensor/in", "DETECTED");
    }
  } else if (xeDangVao && (now - lastSeenD1 >= DEBOUNCE_MS)) {
    LOGLN("[SENSOR1] Xe da roi.");
    xeDangVao    = false;
    enableScanID = false;
  }

  // -- CỔNG RA (sensor 2) --
  if (d2 > 0 && d2 < 10) {
    lastSeenD2 = now;
    if (!xeDangRa) {
      LOGLN("[SENSOR2] Xe den cong ra.");
      xeDangRa     = true;
      enableScanID = true;
      client.publish("parking/events/sensor/out", "DETECTED");
    }
  } else if (xeDangRa && (now - lastSeenD2 >= DEBOUNCE_MS)) {
    LOGLN("[SENSOR2] Xe da roi.");
    xeDangRa     = false;
    enableScanID = false;
  }

  // -- TỰ ĐÓNG BARRIER (xe vào đi qua sensor trong) --
  if (dangChoXeVao) {
    if (d2 > 0 && d2 < 10)  xeDaVaoTrong = true;
    if (xeDaVaoTrong && (d2 > 15 || d2 == -1)) {
      static unsigned long t = 0;
      if (t == 0) t = now;
      if (now - t >= 1000) {
        closeBarrier();
        xeDaVaoTrong = false;
        dangChoXeVao = false;
        t = 0;
        LOGLN("[BARRIER] Tu dong dong (xe da vao).");
      }
    }
  }

  // -- TỰ ĐÓNG BARRIER (xe ra đi qua sensor ngoài) --
  if (dangChoXeRa) {
    if (d1 > 0 && d1 < 10)  xeDaRaNgoai = true;
    if (xeDaRaNgoai && (d1 > 15 || d1 == -1)) {
      static unsigned long t = 0;
      if (t == 0) t = now;
      if (now - t >= 1000) {
        closeBarrier();
        xeDaRaNgoai = false;
        dangChoXeRa = false;
        t = 0;
        LOGLN("[BARRIER] Tu dong dong (xe da ra).");
      }
    }
  }
}

// ===== MQTT CALLBACK =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  LOG("[MQTT IN] Topic: "); LOG(topic); LOG(" | Payload: "); LOGLN(msg);

  if (String(topic) == "parking/commands/gate") {
    if (msg == "OPEN") {
      LOGLN("[MQTT COMMAND] Nhan lenh MO cong!");
      openBarrier();
    }
    else if (msg == "CLOSE") {
      LOGLN("[MQTT COMMAND] Nhan lenh DONG cong!");
      closeBarrier();
    }
  }
}

// ===== MQTT RECONNECT =====
void mqttReconnect() {
  if (client.connected()) {
    if (!mqttWasConnected) {
      LOGLN("[MQTT] Da ket noi thanh cong!");
      mqttWasConnected = true;
      mqttLostPrinted  = false;
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastReconnectAttempt < 5000) return;
  lastReconnectAttempt = now;

  LOGLN("[MQTT] Dang do tim IP cua may tinh 'smartparking' qua mDNS...");
  IPAddress serverIP = MDNS.queryHost("smartparking");
  
  if (serverIP.toString() != "0.0.0.0") {
    LOG("[MQTT] Da tim thay IP: "); LOGLN(serverIP.toString());
    client.setServer(serverIP, 1883);

    String id = "ESP32-Gate-" + String(random(0xffff), HEX);
    LOGLN("[MQTT] Dang ket noi...");
    if (client.connect(id.c_str())) {
      LOGLN("[MQTT] Connected & Subscribed to parking/commands/gate");
      client.subscribe("parking/commands/gate");
      mqttWasConnected = true;
      mqttLostPrinted  = false;
    } else {
      LOG("[MQTT] Ket noi that bai! Client state = "); LOG(client.state());
      LOGLN(" (Cho 5s thu lai)");
      mqttWasConnected = false;
    }
  } else {
    LOGLN("[MQTT ERROR] Khong do tim thay may tinh nao co ten la 'smartparking' trong mang!");
    LOGLN("=> HUONG DAN KAC PHUC:");
    LOGLN("   1. Kiem tra xem ban da doi ten may tinh Windows thanh 'smartparking' chua (System -> About).");
    LOGLN("   2. Kiem tra xem may tinh va ESP32 co dang ket noi chung 1 mang Wi-Fi hay khong.");
    LOGLN("   3. Thu tat va bat lai ket noi Wi-Fi cua may tinh.");
    mqttWasConnected = false;
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
  LOG("[WIFI] Connecting to "); LOGLN(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  LOG("\n[WIFI] IP: "); LOGLN(WiFi.localIP());

  // Khởi tạo mDNS
  if (MDNS.begin("esp32-gate")) {
    LOGLN("[mDNS] Da khoi tao. Giai quyet ten mien: smartparking.local");
  }

  // MQTT
  client.setServer(mqtt_server, 1883);
  client.setCallback(mqttCallback);
  client.setKeepAlive(60);

  LOGLN("[SYS] ESP32 Gate Ready.");
}

// ===== LOOP =====
void loop() {
  // 1. Duy trì MQTT (non-blocking, không spam log)
  mqttReconnect();
  client.loop();

  // 2. Cảnh báo UART thiếu tín hiệu — chỉ mỗi 10 giây
  unsigned long now = millis();
  if (now - lastUartCheck >= UART_CHECK_MS) {
    lastUartCheck = now;
    if (!receivedMega) LOGLN("[WARN] Chua nhan Mega UART!");
    if (!receivedUno)  LOGLN("[WARN] Chua nhan Uno UART!");
  }

  // 3. Đọc Mega → chỗ đỗ xe
  if (SerialMega.available()) {
    String data = SerialMega.readStringUntil('\n');
    data.trim();
    if (!receivedMega) {
      LOGLN("[UART] Mega OK.");
      receivedMega = true;
    }
    // In raw chỉ ở DEBUG mode
    DBG("[MEGA] "); DBGLN(data);
    handleMegaData(data);
  }

  // 4. Đọc Uno → RFID
  if (SerialUno.available()) {
    String data = SerialUno.readStringUntil('\n');
    data.trim();
    if (!receivedUno) {
      LOGLN("[UART] Uno OK.");
      receivedUno = true;
    }
    // Heartbeat: chỉ log mỗi 10s
    if (data == "UNO_HEARTBEAT") {
      if (now - lastHeartbeatLog >= HEARTBEAT_LOG_MS) {
        DBGLN("[HB] Uno alive.");
        lastHeartbeatLog = now;
      }
      return; // bỏ qua, không xử lý thêm
    }
    DBG("[UNO] "); DBGLN(data);
    if (data.startsWith("CARD:")) {
      handleRFID(data.substring(5));
    }
  }

  // 5. Đọc cảm biến + xử lý cổng
  float d1 = getDistance(TRIG1, ECHO1);
  client.loop();
  float d2 = getDistance(TRIG2, ECHO2);
  client.loop();

  handleSensors(d1, d2);

  delay(5);
}