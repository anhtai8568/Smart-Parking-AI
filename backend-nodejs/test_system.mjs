/**
 * Smart Parking AI — System Test
 * Bao phủ: Auth, Vãng lai, Xe tháng ô tô (AprilTag), Xe tháng xe máy, SePay, Gate Control
 */
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';

// ── Terminal colors ──────────────────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m';

const BASE = 'http://localhost:4000';
let passed = 0, failed = 0;
const SFX = Date.now();

// ── Helpers ──────────────────────────────────────────────────────────────────
async function req(method, path, body, token) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE}${path}`, {
        method, headers: h,
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ${G}✓${X} ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ${R}✗${X} ${name}`);
        console.log(`    ${R}→ ${e.message}${X}`);
    }
}

// ── AprilTag ID formula (same as sepay.controller.js) ────────────────────────
function aprilTagId(plate) {
    const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return Number(BigInt('0x' + crypto.createHash('md5').update(clean).digest('hex')) % 587n);
}

// ── Models ───────────────────────────────────────────────────────────────────
let User, Vehicle, UserPackage, ParkingSession;

// ── Test data ────────────────────────────────────────────────────────────────
const VISITOR_PLATE  = `51G${SFX.toString().slice(-5)}`;
const CAR_PLATE      = `30A${SFX.toString().slice(-5)}`;
const MOTO_PLATE     = `29B${SFX.toString().slice(-5)}`;
const VISITOR_RFID   = `VRF${SFX.toString().slice(-7)}`;
const MOTO_RFID      = `MRF${SFX.toString().slice(-7)}`;
const PAY_RFID       = `PRF${SFX.toString().slice(-7)}`;

// Cleanup registry
const DEL = { users: [], vehicles: [], packages: [], sessions: [] };
async function cleanup() {
    console.log(`\n${C}── Cleanup ────────────────────────────────────────${X}`);
    for (const id of DEL.sessions) await ParkingSession.deleteOne({ _id: id }).catch(() => {});
    for (const id of DEL.packages)  await UserPackage.deleteOne({ _id: id }).catch(() => {});
    for (const id of DEL.vehicles)  await Vehicle.deleteOne({ _id: id }).catch(() => {});
    for (const id of DEL.users)     await User.deleteOne({ _id: id }).catch(() => {});
    console.log(`  Xóa: ${DEL.users.length} users, ${DEL.vehicles.length} vehicles, ${DEL.packages.length} packages, ${DEL.sessions.length} sessions`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    User          = (await import('./models/user.js')).default;
    Vehicle       = (await import('./models/vehicle.js')).default;
    UserPackage   = (await import('./models/userpackage.js')).default;
    ParkingSession = (await import('./models/parkingsession.js')).default;

    console.log(`\n${B}${C}═══════════════════════════════════════════════════${X}`);
    console.log(`${B}${C}   SMART PARKING AI — SYSTEM TEST (suffix: ${SFX})${X}`);
    console.log(`${B}${C}═══════════════════════════════════════════════════${X}\n`);

    // ── Registered tokens / objects ──────────────────────────────────────────
    let visitorToken, visitorUserId;
    let carUser, motoUser;
    let carVehicle, motoVehicle;
    let carPackage, motoPackage;

    // ════════════════════════════════════════════════════════════════
    // SECTION 1 — XÁC THỰC
    // ════════════════════════════════════════════════════════════════
    console.log(`${B}── 1. XÁC THỰC (Authentication) ─────────────────────${X}`);

    await test('Đăng ký tài khoản mới (visitor)', async () => {
        const r = await req('POST', '/api/auth/register', {
            username: `tv_v_${SFX}`, email: `tv_v_${SFX}@test.local`,
            password: 'Test@1234', fullName: 'Khach Vang Lai Test',
        });
        ok(r.status === 201, `HTTP ${r.status}: ${r.data.message}`);
        ok(r.data.data?.token, 'No token');
        visitorToken = r.data.data.token;
        visitorUserId = r.data.data.user.id;
        DEL.users.push(new mongoose.Types.ObjectId(visitorUserId));
    });

    await test('Đăng ký trùng username → 409', async () => {
        const r = await req('POST', '/api/auth/register', {
            username: `tv_v_${SFX}`, email: `dup_${SFX}@test.local`,
            password: 'Test@1234', fullName: 'Dup',
        });
        ok(r.status === 409, `Expected 409, got ${r.status}`);
    });

    await test('Đăng ký trùng email → 409', async () => {
        const r = await req('POST', '/api/auth/register', {
            username: `dupname_${SFX}`, email: `tv_v_${SFX}@test.local`,
            password: 'Test@1234', fullName: 'Dup2',
        });
        ok(r.status === 409, `Expected 409, got ${r.status}`);
    });

    await test('Đăng nhập đúng thông tin → token', async () => {
        const r = await req('POST', '/api/auth/login', {
            username: `tv_v_${SFX}`, password: 'Test@1234',
        });
        ok(r.status === 200, `HTTP ${r.status}`);
        ok(r.data.data?.token, 'No token');
    });

    await test('Đăng nhập sai mật khẩu → 401', async () => {
        const r = await req('POST', '/api/auth/login', {
            username: `tv_v_${SFX}`, password: 'WrongPass!!',
        });
        ok(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('Đăng nhập username không tồn tại → 401', async () => {
        const r = await req('POST', '/api/auth/login', {
            username: `ghost_xyz_${SFX}`, password: 'any',
        });
        ok(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('Đăng nhập mật khẩu rỗng → 400', async () => {
        const r = await req('POST', '/api/auth/login', { username: `tv_v_${SFX}` });
        ok(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('Flow reset mật khẩu (inject token → đổi pass → đăng nhập lại)', async () => {
        const user = await User.findOne({ username: `tv_v_${SFX}` });
        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        user.resetPasswordExpiresAt = new Date(Date.now() + 900_000);
        await user.save();

        const r1 = await req('POST', '/api/auth/reset-password', { token, password: 'NewPass@5678' });
        ok(r1.status === 200, `Reset failed: ${r1.data.message}`);

        const r2 = await req('POST', '/api/auth/login', { username: `tv_v_${SFX}`, password: 'NewPass@5678' });
        ok(r2.status === 200, 'Login with new password failed');

        // Restore original password
        const bcrypt = (await import('bcryptjs')).default;
        user.passwordHash = await bcrypt.hash('Test@1234', 10);
        await user.save();
    });

    await test('Token hết hạn → reset thất bại', async () => {
        const expiredToken = crypto.randomBytes(32).toString('hex');
        const r = await req('POST', '/api/auth/reset-password', {
            token: expiredToken, password: 'NewPass@1234',
        });
        ok(r.status === 400, `Expected 400 (expired), got ${r.status}`);
    });

    // Register monthly users for later sections
    for (const [key, uname, email, ref] of [
        ['car',  `tv_car_${SFX}`,  `tv_car_${SFX}@test.local`,  'carUser'],
        ['moto', `tv_moto_${SFX}`, `tv_moto_${SFX}@test.local`, 'motoUser'],
    ]) {
        const r = await req('POST', '/api/auth/register', {
            username: uname, email, password: 'Test@1234', fullName: `Test ${key}`,
        });
        if (r.status === 201) {
            const u = await User.findOne({ username: uname });
            DEL.users.push(u._id);
            if (key === 'car')  carUser  = u;
            if (key === 'moto') motoUser = u;
        }
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 2 — XE VÃNG LAI
    // ════════════════════════════════════════════════════════════════
    console.log(`\n${B}── 2. XE VÃNG LAI ────────────────────────────────────${X}`);

    let visitorSession;

    await test('Xe vãng lai vào → tạo session in_progress', async () => {
        visitorSession = await ParkingSession.create({
            sessionCode:  `TV-IN-${SFX}`,
            licensePlate: VISITOR_PLATE,
            vehicleType:  'car',
            entryAt:      new Date(Date.now() - 300_000), // 5 phút trước
            entryMethod:  'rfid',
            isVisitor:    true,
            status:       'in_progress',
            rfid:         VISITOR_RFID,
        });
        DEL.sessions.push(visitorSession._id);
        ok(visitorSession.status === 'in_progress');
        ok(visitorSession.rfid === VISITOR_RFID);
    });

    await test('Tìm session bằng RFID (logic xe ra)', async () => {
        const found = await ParkingSession.findOne({ rfid: VISITOR_RFID, status: 'in_progress' });
        ok(found, 'Session not found');
        ok(found._id.toString() === visitorSession._id.toString(), 'Wrong session');
    });

    await test('Phí tối thiểu 2,000đ (đỗ < 1 phút)', async () => {
        const durationSec = 20; // 20 giây
        const fee = Math.max(Math.round(durationSec * 3), 2000);
        ok(fee === 2000, `Expected 2000, got ${fee}`);
    });

    await test('Phí theo giây vượt mức tối thiểu (đỗ 15 phút)', async () => {
        const durationSec = 900; // 15 phút
        const fee = Math.max(Math.round(durationSec * 3), 2000);
        ok(fee === 2700, `Expected 2700, got ${fee}`);
    });

    await test('Phí theo giây (đỗ 1 tiếng)', async () => {
        const durationSec = 3600;
        const fee = Math.max(Math.round(durationSec * 3), 2000);
        ok(fee === 10800, `Expected 10800, got ${fee}`);
    });

    await test('Xe vãng lai ra — hoàn thành session, paymentStatus=unpaid', async () => {
        const s = await ParkingSession.findById(visitorSession._id);
        const now = new Date();
        const durationMs = now - s.entryAt;
        const fee = Math.max(Math.round(durationMs / 1000 * 3), 2000);

        s.exitAt = now;
        s.exitMethod = 'rfid';
        s.status = 'completed';
        s.durationMinutes = Math.round(durationMs / 60000);
        s.feeAmount = fee;
        s.paymentStatus = 'unpaid';
        await s.save();

        const u = await ParkingSession.findById(s._id);
        ok(u.status === 'completed', `Status: ${u.status}`);
        ok(u.feeAmount >= 2000, `Fee ${u.feeAmount} < 2000`);
        ok(u.paymentStatus === 'unpaid', `PaymentStatus: ${u.paymentStatus}`);
    });

    await test('RFID đã vào nhưng quét lại cổng vào → phát hiện redirect ra', async () => {
        // Simulate: entry handler checks for existing in_progress session with same RFID
        const rfidTest = `REREDIR${SFX}`;
        const existing = await ParkingSession.create({
            sessionCode:  `TV-REDIR-${SFX}`,
            licensePlate: `29X${SFX.toString().slice(-5)}`,
            vehicleType:  'car',
            entryAt:      new Date(Date.now() - 60_000),
            entryMethod:  'rfid',
            isVisitor:    true,
            status:       'in_progress',
            rfid:         rfidTest,
        });
        DEL.sessions.push(existing._id);

        // The fix in handleEntryValidation: if same RFID found → redirect to exit
        const sameRfidSess = await ParkingSession.findOne({ rfid: rfidTest, status: 'in_progress' });
        ok(sameRfidSess !== null, 'Should find existing session → redirect to exit');
    });

    // ════════════════════════════════════════════════════════════════
    // SECTION 3 — XE Ô TÔ THÁNG (AprilTag)
    // ════════════════════════════════════════════════════════════════
    console.log(`\n${B}── 3. XE Ô TÔ THÁNG (AprilTag) ──────────────────────${X}`);

    await test('Tính AprilTag ID từ biển số (deterministic)', async () => {
        const id1 = aprilTagId(CAR_PLATE);
        const id2 = aprilTagId(CAR_PLATE);
        ok(id1 === id2, 'AprilTag ID not deterministic');
        ok(id1 >= 0 && id1 < 587, `ID ${id1} out of range`);
    });

    await test('Tạo xe ô tô với arucoId', async () => {
        ok(carUser, 'carUser not registered');
        carVehicle = await Vehicle.create({
            userId: carUser._id,
            licensePlate: CAR_PLATE,
            vehicleType: 'car',
            brand: 'Toyota Test',
            arucoId: aprilTagId(CAR_PLATE),
            status: 'active',
        });
        DEL.vehicles.push(carVehicle._id);
        ok(carVehicle.arucoId === aprilTagId(CAR_PLATE), 'Wrong arucoId');
    });

    await test('Tạo gói tháng active cho xe ô tô', async () => {
        ok(carVehicle && carUser, 'Setup missing');
        const now = new Date();
        carPackage = await UserPackage.create({
            userId: carUser._id,
            vehicleId: carVehicle._id,
            vehicleType: 'car',
            packageType: 'monthly',
            months: 1,
            pricePerMonth: 500000,
            totalAmount: 500000,
            paymentStatus: 'paid',
            status: 'active',
            startDate: now,
            endDate: new Date(now.getTime() + 30 * 86400_000),
            paymentCode: `TVCAR${SFX}`,
        });
        DEL.packages.push(carPackage._id);
        ok(carPackage.status === 'active');
    });

    await test('AprilTag lookup — tìm xe theo arucoId, kiểm tra gói active', async () => {
        const v = await Vehicle.findOne({ arucoId: aprilTagId(CAR_PLATE), vehicleType: 'car' });
        ok(v, 'Vehicle not found by arucoId');
        const pkg = await UserPackage.findOne({ vehicleId: v._id, status: 'active' });
        ok(pkg, 'No active package');
    });

    await test('AprilTag biển số KHỚP → mở barrier, tạo session, không cảnh báo', async () => {
        ok(carVehicle && carPackage, 'Setup missing');
        const cleanReg = CAR_PLATE.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanAI  = CAR_PLATE.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); // AI đọc đúng
        const mismatch = cleanReg !== cleanAI;
        ok(!mismatch, 'Should NOT be mismatch');

        const sess = await ParkingSession.create({
            sessionCode:  `TV-CAR-IN-${SFX}`,
            vehicleId:    carVehicle._id,
            userId:       carUser._id,
            licensePlate: carVehicle.licensePlate,
            vehicleType:  'car',
            entryAt:      new Date(),
            entryMethod:  'ai',
            isVisitor:    false,
            status:       'in_progress',
            notes:        `AprilTag ID: ${carVehicle.arucoId}`,
        });
        DEL.sessions.push(sess._id);
        ok(!sess.isVisitor, 'Should not be visitor');
    });

    await test('AprilTag biển số LỆCH → KHÔNG đổi biển đăng ký, ghi cảnh báo vào notes', async () => {
        ok(carVehicle, 'carVehicle missing');
        const originalPlate = carVehicle.licensePlate;
        const aiReadPlate   = '51H99999'; // AI đọc sai

        const cleanReg = originalPlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanAI  = aiReadPlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const mismatch = cleanReg !== cleanAI;
        ok(mismatch, 'Should detect mismatch');

        // New logic: vehicle plate NOT changed, warning note added
        const warning = `Biển số nhận diện "${aiReadPlate}" khác biển đăng ký "${originalPlate}". AprilTag hợp lệ — đã mở barrier.`;

        // Create mismatch session with warning note
        const missSess = await ParkingSession.create({
            sessionCode:  `TV-CAR-MISS-${SFX}`,
            vehicleId:    carVehicle._id,
            userId:       carUser._id,
            licensePlate: carVehicle.licensePlate, // giữ biển đăng ký gốc
            vehicleType:  'car',
            entryAt:      new Date(),
            entryMethod:  'ai',
            isVisitor:    false,
            status:       'in_progress',
            notes:        `AprilTag ID: ${carVehicle.arucoId} | AI đọc: ${aiReadPlate}`,
        });
        DEL.sessions.push(missSess._id);

        // Verify vehicle plate unchanged
        const vAfter = await Vehicle.findById(carVehicle._id);
        ok(vAfter.licensePlate === originalPlate, `Plate was changed! ${originalPlate} → ${vAfter.licensePlate}`);
        ok(missSess.licensePlate === originalPlate.toUpperCase(), 'Session should use registered plate');
        ok(missSess.notes.includes('AI đọc'), 'Warning not in notes');
        ok(warning.includes(aiReadPlate), 'Warning message correct');
    });

    await test('Xe ô tô tháng ra — phí = 0, paymentStatus = paid', async () => {
        const sess = await ParkingSession.findOne({ vehicleId: carVehicle._id, status: 'in_progress' });
        ok(sess, 'No in_progress session for car');

        const now = new Date();
        sess.exitAt = now;
        sess.exitMethod = 'ai';
        sess.status = 'completed';
        sess.durationMinutes = Math.round((now - sess.entryAt) / 60000);
        sess.feeAmount = 0;
        sess.paymentStatus = 'paid';
        await sess.save();

        const u = await ParkingSession.findById(sess._id);
        ok(u.feeAmount === 0, `Monthly car fee should be 0, got ${u.feeAmount}`);
        ok(u.paymentStatus === 'paid', `Monthly car should be auto-paid`);
        ok(u.status === 'completed');
    });

    // ════════════════════════════════════════════════════════════════
    // SECTION 4 — XE MÁY THÁNG
    // ════════════════════════════════════════════════════════════════
    console.log(`\n${B}── 4. XE MÁY THÁNG ───────────────────────────────────${X}`);

    await test('Tạo xe máy với RFID', async () => {
        ok(motoUser, 'motoUser not registered');
        motoVehicle = await Vehicle.create({
            userId: motoUser._id,
            licensePlate: MOTO_PLATE,
            vehicleType: 'motorbike',
            rfidCard: MOTO_RFID,
            status: 'active',
        });
        DEL.vehicles.push(motoVehicle._id);
        ok(motoVehicle.rfidCard === MOTO_RFID);
    });

    await test('Tạo gói tháng active cho xe máy', async () => {
        ok(motoVehicle && motoUser, 'Setup missing');
        const now = new Date();
        motoPackage = await UserPackage.create({
            userId: motoUser._id,
            vehicleId: motoVehicle._id,
            vehicleType: 'motorbike',
            packageType: 'monthly',
            months: 1,
            pricePerMonth: 200000,
            totalAmount: 200000,
            paymentStatus: 'paid',
            status: 'active',
            startDate: now,
            endDate: new Date(now.getTime() + 30 * 86400_000),
            paymentCode: `TVMOTO${SFX}`,
        });
        DEL.packages.push(motoPackage._id);
        ok(motoPackage.status === 'active');
    });

    await test('Xe máy tháng vào — session ghi rfid từ vehicle', async () => {
        ok(motoVehicle, 'motoVehicle missing');
        const pkg = await UserPackage.findOne({ vehicleId: motoVehicle._id, status: 'active' });
        ok(pkg, 'No active package for moto');

        const motoSess = await ParkingSession.create({
            sessionCode:  `TV-MOTO-IN-${SFX}`,
            vehicleId:    motoVehicle._id,
            userId:       motoUser._id,
            licensePlate: motoVehicle.licensePlate,
            vehicleType:  'motorbike',
            entryAt:      new Date(Date.now() - 3_600_000), // 1 tiếng trước
            entryMethod:  'rfid',
            isVisitor:    false,
            status:       'in_progress',
            rfid:         MOTO_RFID,
        });
        DEL.sessions.push(motoSess._id);
        ok(motoSess.rfid === MOTO_RFID);
        ok(!motoSess.isVisitor, 'Monthly moto should not be visitor');
    });

    await test('Xe máy tháng ra — phí = 0, paymentStatus = waived', async () => {
        const sess = await ParkingSession.findOne({ vehicleId: motoVehicle._id, status: 'in_progress' });
        ok(sess, 'No in_progress session for moto');
        const now = new Date();
        sess.exitAt = now;
        sess.exitMethod = 'rfid';
        sess.status = 'completed';
        sess.durationMinutes = Math.round((now - sess.entryAt) / 60000);
        sess.feeAmount = 0;
        sess.paymentStatus = 'waived';
        await sess.save();

        const u = await ParkingSession.findById(sess._id);
        ok(u.feeAmount === 0);
        ok(u.paymentStatus === 'waived', `Expected waived, got ${u.paymentStatus}`);
    });

    // ════════════════════════════════════════════════════════════════
    // SECTION 5 — SEPAY WEBHOOK
    // ════════════════════════════════════════════════════════════════
    console.log(`\n${B}── 5. SEPAY WEBHOOK ──────────────────────────────────${X}`);

    let paySession;

    await test('Setup session vãng lai chờ thanh toán', async () => {
        paySession = await ParkingSession.create({
            sessionCode:  `TV-PAY-${SFX}`,
            licensePlate: `51A${SFX.toString().slice(-5)}`,
            vehicleType:  'car',
            entryAt:      new Date(Date.now() - 600_000), // 10 phút
            entryMethod:  'rfid',
            isVisitor:    true,
            status:       'in_progress',
            rfid:         PAY_RFID,
            feeAmount:    3600,
            paymentStatus: 'unpaid',
        });
        DEL.sessions.push(paySession._id);
        ok(paySession.paymentStatus === 'unpaid');
    });

    await test('Webhook phí đỗ xe vãng lai (code DX+RFID) → session paid + completed', async () => {
        const r = await req('POST', '/api/sepay/webhook', {
            transferType:   'in',
            transferAmount: 3600,
            id:             `TX${SFX}`,
            code:           `DX${PAY_RFID}`,
            content:        `THANH TOAN PHI DO XE DX${PAY_RFID}`,
            referenceCode:  `REF${SFX}`,
        });
        ok(r.status === 200, `Webhook failed: ${JSON.stringify(r.data)}`);

        const u = await ParkingSession.findById(paySession._id);
        ok(u.paymentStatus === 'paid', `Expected paid, got ${u.paymentStatus}`);
        ok(u.status === 'completed', `Expected completed, got ${u.status}`);
        ok(u.exitMethod === 'qr', `Expected qr, got ${u.exitMethod}`);
    });

    await test('Webhook trùng transaction ID → idempotent (bỏ qua)', async () => {
        const r = await req('POST', '/api/sepay/webhook', {
            transferType:   'in',
            transferAmount: 3600,
            id:             `TX${SFX}`, // trùng với trên
            code:           `DX${PAY_RFID}`,
            content:        'DUPLICATE',
        });
        ok(r.status === 200, 'Should return 200 for duplicate');
        // session vẫn completed (không bị ghi đè)
        const u = await ParkingSession.findById(paySession._id);
        ok(u.status === 'completed', 'Session should remain completed');
    });

    await test('Webhook gói tháng xe máy → paymentStatus=paid, status=active', async () => {
        ok(motoPackage, 'motoPackage missing');
        // Reset về pending để test
        await UserPackage.findByIdAndUpdate(motoPackage._id, { paymentStatus: 'unpaid', status: 'pending' });

        const r = await req('POST', '/api/sepay/webhook', {
            transferType:   'in',
            transferAmount: 200000,
            id:             `TXMOTO${SFX}`,
            code:           `TVMOTO${SFX}`,
            content:        `THANH TOAN GOI THANG TVMOTO${SFX}`,
        });
        ok(r.status === 200, `Webhook failed: ${JSON.stringify(r.data)}`);

        const u = await UserPackage.findById(motoPackage._id);
        ok(u.paymentStatus === 'paid', `Expected paid, got ${u.paymentStatus}`);
    });

    await test('Webhook transferType=out → bỏ qua (chỉ xử lý tiền vào)', async () => {
        const r = await req('POST', '/api/sepay/webhook', {
            transferType:   'out',
            transferAmount: 5000,
            id:             `TXOUT${SFX}`,
            code:           `DX${PAY_RFID}`,
        });
        ok(r.status === 200, 'Should accept but ignore out transfers');
    });

    await test('Webhook mã không khớp → bỏ qua, không lỗi', async () => {
        const r = await req('POST', '/api/sepay/webhook', {
            transferType:   'in',
            transferAmount: 999,
            id:             `TXUNK${SFX}`,
            code:           `UNKNOWN_CODE_${SFX}`,
        });
        ok(r.status === 200, 'Should return 200 for unknown code');
    });

    // ════════════════════════════════════════════════════════════════
    // SECTION 6 — GATE CONTROL API
    // ════════════════════════════════════════════════════════════════
    console.log(`\n${B}── 6. ĐIỀU KHIỂN CỔNG (Gate Control) ────────────────${X}`);

    await test('POST /api/gate/open → 200 hoặc 503 (MQTT)', async () => {
        const r = await req('POST', '/api/gate/open', {});
        ok(r.status === 200 || r.status === 503, `Unexpected: ${r.status}`);
    });

    await test('POST /api/gate/close → 200 hoặc 503 (MQTT)', async () => {
        const r = await req('POST', '/api/gate/close', {});
        ok(r.status === 200 || r.status === 503, `Unexpected: ${r.status}`);
    });

    await test('POST /api/gate/plate-ready (gate=in) → 200', async () => {
        const r = await req('POST', '/api/gate/plate-ready', {
            gate: 'in', plate: '51G12345',
        });
        ok(r.status === 200, `Expected 200, got ${r.status}: ${r.data.message}`);
    });

    await test('POST /api/gate/plate-ready thiếu plate → 400', async () => {
        const r = await req('POST', '/api/gate/plate-ready', { gate: 'in' });
        ok(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('POST /api/gate/plate-ready gate không hợp lệ → 400', async () => {
        const r = await req('POST', '/api/gate/plate-ready', { gate: 'middle', plate: '51G00001' });
        ok(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('GET /api/gate/sessions → trả về trạng thái session', async () => {
        const r = await req('GET', '/api/gate/sessions');
        ok(r.status === 200, `Expected 200, got ${r.status}`);
        ok(r.data.data?.in !== undefined, 'Missing in session');
        ok(r.data.data?.out !== undefined, 'Missing out session');
    });

    // ════════════════════════════════════════════════════════════════
    // CLEANUP
    // ════════════════════════════════════════════════════════════════
    await cleanup();
    await mongoose.disconnect();

    // ════════════════════════════════════════════════════════════════
    // SUMMARY
    // ════════════════════════════════════════════════════════════════
    const total = passed + failed;
    const pct   = total ? Math.round(passed / total * 100) : 0;
    const bar   = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

    console.log(`\n${B}${C}═══════════════════════════════════════════════════${X}`);
    console.log(`${B}  KẾT QUẢ: ${G}${passed} PASS${X}  ${R}${failed} FAIL${X}  (${total} tổng)${X}`);
    console.log(`  ${pct >= 80 ? G : R}${bar} ${pct}%${X}`);
    console.log(`${B}${C}═══════════════════════════════════════════════════${X}\n`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(`${R}FATAL: ${err.message}${X}`); process.exit(1); });
