# Smart Parking AI - MongoDB Database Framework

## 1. Muc tieu tai lieu
Tai lieu nay de xuat khung CSDL MongoDB cho toan bo du an Smart Parking AI, dua tren:
- Frontend React (admin/user dashboards, pricing, reports, settings, topup, payment history).
- AI server Python (`/api/scan-plate`) de nhan dien bien so.
- Firmware ESP32/Arduino (barrier, ultrasonic, slot sensors, RFID).

Muc tieu la co bo collection day du de backend Node.js co the trien khai API that.

## 2. Nguyen tac thiet ke
- Dung UTC cho tat ca thoi gian (`Date`).
- Dung `ObjectId` cho quan he tham chieu.
- Luu so tien theo `Number` (VND), khong luu string co dau cham phay.
- Tach su kien thiet bi (event log) khoi nghiep vu gui xe de de debug va bao cao.
- Tao index som cho truong tim kiem nhieu: bien so, uid RFID, user, trang thai phien gui xe.

## 3. Danh sach collection cot loi

### 3.1 `users`
Luu tai khoan dang nhap va thong tin nguoi dung he thong.

Suggested fields:
- `_id: ObjectId`
- `username: String` (unique, required)
- `passwordHash: String` (required)
- `role: String` (`admin` | `user`, required)
- `fullName: String` (required)
- `phone: String` (unique, sparse)
- `email: String` (unique, sparse)
- `status: String` (`active` | `blocked`, default `active`)
- `walletBalance: Number` (default 0)
- `defaultVehicleId: ObjectId | null` (ref `vehicles`)
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ username: 1 }` unique
- `{ phone: 1 }` unique sparse
- `{ email: 1 }` unique sparse
- `{ role: 1, status: 1 }`

---

### 3.2 `vehicles`
Luu phuong tien dang ky (xe thang/xe nguoi dung).

Suggested fields:
- `_id: ObjectId`
- `userId: ObjectId` (ref `users`, nullable cho xe vang lai)
- `licensePlate: String` (required, unique)
- `vehicleType: String` (`car` | `motorbike`, required)
- `brand: String`
- `color: String`
- `rfidCardId: ObjectId | null` (ref `rfid_cards`)
- `isVisitor: Boolean` (default false)
- `status: String` (`active` | `inactive`, default `active`)
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ licensePlate: 1 }` unique
- `{ userId: 1, status: 1 }`
- `{ rfidCardId: 1 }`

---

### 3.3 `rfid_cards`
Quan ly the RFID doc tu Arduino.

Suggested fields:
- `_id: ObjectId`
- `uid: String` (required, unique) // VD: "AB 1C 22 9F"
- `userId: ObjectId | null` (ref `users`)
- `vehicleId: ObjectId | null` (ref `vehicles`)
- `status: String` (`active` | `lost` | `disabled`, default `active`)
- `issuedAt: Date`
- `expiredAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ uid: 1 }` unique
- `{ userId: 1 }`
- `{ vehicleId: 1 }`

---

### 3.4 `parking_slots`
Luu thong tin o do xe trong bai.

Suggested fields:
- `_id: ObjectId`
- `code: String` (unique, required) // VD: S1, S2, S3
- `zone: String` // VD: A, B
- `slotType: String` (`car` | `motorbike` | `mixed`, default `mixed`)
- `sensorPin: String | null` // mapping voi firmware neu can
- `status: String` (`available` | `occupied` | `maintenance`, default `available`)
- `currentSessionId: ObjectId | null` (ref `parking_sessions`)
- `lastOccupiedAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ code: 1 }` unique
- `{ status: 1, slotType: 1 }`

---

### 3.5 `parking_sessions`
Collection nghiep vu quan trong nhat, theo doi moi luot xe vao/ra.

Suggested fields:
- `_id: ObjectId`
- `sessionCode: String` (unique) // VD: PS20260422-0001
- `vehicleId: ObjectId | null` (ref `vehicles`)
- `userId: ObjectId | null` (ref `users`)
- `licensePlate: String` (required, snapshot tai thoi diem vao)
- `vehicleType: String` (`car` | `motorbike`)
- `entryAt: Date` (required)
- `exitAt: Date | null`
- `durationMinutes: Number | null`
- `entryGateId: ObjectId | null` (ref `gate_devices`)
- `exitGateId: ObjectId | null` (ref `gate_devices`)
- `slotId: ObjectId | null` (ref `parking_slots`)
- `entryMethod: String` (`ai` | `rfid` | `qr` | `manual`)
- `exitMethod: String | null` (`ai` | `rfid` | `qr` | `manual`)
- `isVisitor: Boolean` (default false)
- `feeAmount: Number` (default 0)
- `paymentStatus: String` (`unpaid` | `paid` | `waived`, default `unpaid`)
- `status: String` (`in_progress` | `completed` | `cancelled`, default `in_progress`)
- `aiEntryScanId: ObjectId | null` (ref `ai_scan_logs`)
- `aiExitScanId: ObjectId | null` (ref `ai_scan_logs`)
- `notes: String | null`
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ sessionCode: 1 }` unique
- `{ licensePlate: 1, status: 1 }`
- `{ userId: 1, entryAt: -1 }`
- `{ status: 1, entryAt: -1 }`
- `{ isVisitor: 1, paymentStatus: 1, entryAt: -1 }`

---

### 3.6 `wallet_transactions`
Luu lich su nap tien, tru tien gui xe, dieu chinh so du.

Suggested fields:
- `_id: ObjectId`
- `userId: ObjectId` (ref `users`, required)
- `sessionId: ObjectId | null` (ref `parking_sessions`)
- `type: String` (`topup` | `parking_fee` | `monthly_package` | `adjustment`)
- `direction: String` (`credit` | `debit`) // cong/tru
- `amount: Number` (required)
- `method: String` (`cash` | `bank_transfer` | `ewallet` | `system`)
- `status: String` (`pending` | `success` | `failed`, default `success`)
- `description: String`
- `createdBy: ObjectId | null` (ref `users`, admin thao tac)
- `createdAt: Date`

Indexes:
- `{ userId: 1, createdAt: -1 }`
- `{ sessionId: 1 }`
- `{ type: 1, status: 1 }`

---

### 3.7 `pricing_policies`
Luu cau hinh gia ve luot, ve thang (theo UI Pricing).

Suggested fields:
- `_id: ObjectId`
- `name: String` // VD: "standard-2026"
- `isActive: Boolean` (default true)
- `monthlyPriceMotorbike: Number`
- `monthlyPriceCar: Number`
- `singlePriceMotorbike: Number`
- `singlePriceCar: Number`
- `effectiveFrom: Date`
- `effectiveTo: Date | null`
- `updatedBy: ObjectId | null` (ref `users`)
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ isActive: 1, effectiveFrom: -1 }`

---

### 3.8 `user_packages`
Theo doi goi thang cua tung user/xe.

Suggested fields:
- `_id: ObjectId`
- `userId: ObjectId` (ref `users`)
- `vehicleId: ObjectId` (ref `vehicles`)
- `packageType: String` (`monthly`)
- `startDate: Date`
- `endDate: Date`
- `priceAtPurchase: Number`
- `status: String` (`active` | `expired` | `cancelled`)
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ userId: 1, status: 1 }`
- `{ vehicleId: 1, status: 1 }`
- `{ endDate: 1 }`

---

### 3.9 `ai_scan_logs`
Luu ket qua goi AI `/api/scan-plate` de truy vet.

Suggested fields:
- `_id: ObjectId`
- `requestId: String` (unique) // sinh tu backend Node
- `cameraId: ObjectId | null` (ref `gate_devices`)
- `imageUrl: String | null` // neu co luu anh len object storage
- `rawResponse: Object` // JSON tu AI server
- `detectedPlate: String | null`
- `confidence: Number | null`
- `scanType: String` (`entry` | `exit` | `manual_check`)
- `status: String` (`success` | `error`)
- `errorMessage: String | null`
- `scannedAt: Date`

Indexes:
- `{ requestId: 1 }` unique
- `{ detectedPlate: 1, scannedAt: -1 }`
- `{ scanType: 1, scannedAt: -1 }`

---

### 3.10 `gate_devices`
Thong tin camera/barrier/sensor theo trang Settings va firmware.

Suggested fields:
- `_id: ObjectId`
- `code: String` (unique) // VD: GATE_IN_1, CAM_OUT_1
- `deviceType: String` (`camera` | `barrier` | `ultrasonic` | `rfid_reader` | `controller`)
- `location: String` // VD: "Cong vao"
- `ipAddress: String | null`
- `streamUrl: String | null`
- `controllerTopic: String | null` // neu sau nay dung MQTT
- `status: String` (`online` | `offline` | `maintenance`)
- `lastSeenAt: Date | null`
- `meta: Object` // pin mapping, model, firmware version...
- `createdAt: Date`
- `updatedAt: Date`

Indexes:
- `{ code: 1 }` unique
- `{ deviceType: 1, status: 1 }`
- `{ lastSeenAt: -1 }`

---

### 3.11 `device_events`
Log su kien thiet bi tu firmware (xe vao/ra, slot occupancy, servo open/close, RFID scan).

Suggested fields:
- `_id: ObjectId`
- `deviceId: ObjectId` (ref `gate_devices`, required)
- `eventType: String` (`vehicle_detected` | `barrier_open` | `barrier_close` | `slot_detected` | `rfid_scanned` | `heartbeat` | `error`)
- `direction: String | null` (`entry` | `exit`)
- `slotCode: String | null`
- `rfidUid: String | null`
- `distanceCm: Number | null`
- `payload: Object` // raw event payload
- `eventAt: Date` (required)

Indexes:
- `{ deviceId: 1, eventAt: -1 }`
- `{ eventType: 1, eventAt: -1 }`
- `{ rfidUid: 1, eventAt: -1 }`

---

### 3.12 `system_configs`
Luu cau hinh he thong (camera URL, barrier IP, Mongo URI, API base URL) theo trang Settings.

Suggested fields:
- `_id: ObjectId`
- `key: String` (unique) // VD: camera.entry.url
- `value: Mixed`
- `category: String` (`camera` | `barrier` | `database` | `api` | `other`)
- `isSecret: Boolean` (default false)
- `updatedBy: ObjectId | null` (ref `users`)
- `updatedAt: Date`

Indexes:
- `{ key: 1 }` unique
- `{ category: 1 }`

## 4. Quan he nghiep vu chinh
- `users (1) - (n) vehicles`
- `users (1) - (n) wallet_transactions`
- `vehicles (1) - (n) parking_sessions`
- `parking_slots (1) - (n) parking_sessions`
- `gate_devices (1) - (n) device_events`
- `parking_sessions (1) - (0..n) wallet_transactions`
- `parking_sessions (1) - (0..2) ai_scan_logs` (vao/ra)

## 5. Luong du lieu de map voi du an hien tai
1. Xe vao cong:
- Firmware phat hien xe (ultrasonic) -> ghi `device_events`.
- Camera chup frame -> backend goi AI `/api/scan-plate` -> luu `ai_scan_logs`.
- Tao `parking_sessions` voi `status=in_progress`, `entryAt`, `entryMethod`.
- Cap nhat `parking_slots` neu co slot duoc gan.

2. Xe ra cong:
- Nhan dang bien/hoac RFID -> tim `parking_sessions` dang `in_progress`.
- Tinh phi theo `pricing_policies`.
- Tao `wallet_transactions` (neu thu phi) va cap nhat `paymentStatus`.
- Set `exitAt`, `status=completed`.

3. Nguoi dung nap tien:
- Tao `wallet_transactions` type=`topup`, direction=`credit`.
- Cong `users.walletBalance`.

## 6. Cac collection co the bo sung sau (optional)
- `notifications`: thong bao cho admin/user.
- `audit_logs`: theo doi thao tac admin tren he thong.
- `report_snapshots`: luu du lieu tong hop theo ngay/thang de truy van nhanh.
- `api_keys` hoac `service_integrations`: ket noi cong thanh toan, camera cloud.

## 7. Goi y dat ten model Mongoose
- User
- Vehicle
- RfidCard
- ParkingSlot
- ParkingSession
- WalletTransaction
- PricingPolicy
- UserPackage
- AiScanLog
- GateDevice
- DeviceEvent
- SystemConfig

## 8. Lo trinh trien khai de xai ngay
Phase 1 (bat buoc):
- `users`, `vehicles`, `parking_sessions`, `parking_slots`, `pricing_policies`, `wallet_transactions`.

Phase 2 (tich hop AI + firmware):
- `ai_scan_logs`, `gate_devices`, `device_events`, `rfid_cards`.

Phase 3 (van hanh nang cao):
- `user_packages`, `audit_logs`, `report_snapshots`, `notifications`.

---
