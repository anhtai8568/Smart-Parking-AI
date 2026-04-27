#define S1_PIN 32
#define S2_PIN 34
#define S3_PIN 36
#define S4_PIN 42
#define S5_PIN 40
#define S6_PIN 38

int prev[6] = {-1, -1, -1, -1, -1, -1};

int readStable(int pin){
  int count = 0;
  for(int i = 0; i < 10; i++){
    if(digitalRead(pin) == 1) count++; // nếu ngược thì đổi lại 0
    delay(2);
  }
  return (count >= 7) ? 1 : 0;
}

void setup() {
  Serial.begin(9600);

  pinMode(S1_PIN, INPUT);
  pinMode(S2_PIN, INPUT);
  pinMode(S3_PIN, INPUT);
  pinMode(S4_PIN, INPUT);
  pinMode(S5_PIN, INPUT);
  pinMode(S6_PIN, INPUT);
}

void loop() {
  int s[6];

  s[0] = readStable(S1_PIN);
  s[1] = readStable(S2_PIN);
  s[2] = readStable(S3_PIN);
  s[3] = readStable(S4_PIN);
  s[4] = readStable(S5_PIN);
  s[5] = readStable(S6_PIN);

  bool changed = false;
  for(int i = 0; i < 6; i++){
    if(s[i] != prev[i]){
      changed = true;
      break;
    }
  }

  if(changed){
    for(int i = 0; i < 6; i++){
      Serial.print("S");
      Serial.print(i+1);
      Serial.print(": ");
      Serial.print(s[i] == 1 ? "CO XE" : "TRONG");

      if(i < 5) Serial.print(" | ");
    }
    Serial.println();

    for(int i = 0; i < 6; i++){
      prev[i] = s[i];
    }
  }

  delay(50);
}