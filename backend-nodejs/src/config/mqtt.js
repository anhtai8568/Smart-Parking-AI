import mqtt from 'mqtt';
import ParkingSession from '../../models/parkingsession.js';
import ParkingSlot from '../../models/parkingslot.js';
import Vehicle from '../../models/vehicle.js';
import UserPackage from '../../models/userpackage.js';

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const AI_SERVER_URL   = process.env.AI_SERVER_URL   || 'http://localhost:8000';

// Thời gian chờ tối đa: cổng vào dài hơn vì người dùng cần thao tác RFID
const IN_TIMEOUT  = 8000;   // 8 giây
const OUT_TIMEOUT = 5000;   // 5 giây

let mqttClient = null;
export function getMQTTClient() { return mqttClient; }

let latestSwipedRfid = null;
export function getLatestSwipedRfid() { return latestSwipedRfid; }

// SePay configurations for VietQR generation
const SEPAY_ACCOUNT = process.env.SEPAY_ACCOUNT || '96247KCHIP';
const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || 'BIDV';
const SEPAY_QR_BASE_URL = process.env.SEPAY_QR_BASE_URL || 'https://qr.sepay.vn/img';

function buildVietQrUrl({ amount, code }) {
    const params = new URLSearchParams();
    params.set('acc', SEPAY_ACCOUNT);
    if (SEPAY_BANK_CODE) params.set('bank', SEPAY_BANK_CODE);
    if (amount) params.set('amount', String(amount));
    if (code) params.set('des', code);
    return `${SEPAY_QR_BASE_URL}?${params.toString()}`;
}


// ─── Session Store ────────────────────────────────────────────────────────────
// Mỗi cổng có một session riêng biệt, in-memory
let _sessionCounter = 0;
function makeSessionId() {
    _sessionCounter++;
    return `sess_${Date.now()}_${_sessionCounter}`;
}

function emptySession(gate) {
    return {
        id:            null,
        gate,
        rfid:          null,
        plate:         null,
        image_b64:     null,
        apriltag:      null,
        // idle → collecting → validating → opening → done
        //                               ↘ timeout
        status:        'idle',
        timer:         null,
        createdAt:     null,
        lastUpdatedAt: null,
    };
}

const sessions = {
    in:  emptySession('in'),
    out: emptySession('out'),
};

// Export để gate.controller.js có thể đọc debug state
export function getSessions() { return sessions; }

// ─── Session Lifecycle ─────────────────────────────────────────────────────────

/**
 * Tạo session mới khi cảm biến HC-SR04 kích hoạt.
 * KHÔNG reset nếu session đang collecting — tránh mất RFID/plate đã thu thập.
 */
function createSession(gate) {
    const sess = sessions[gate];

    if (sess.status === 'collecting' || sess.status === 'validating' || sess.status === 'opening') {
        console.log(`[SESSION ${sess.id}] Sensor fired again while ${sess.status} — ignored (no reset)`);
        return;
    }

    // Hủy timer cũ nếu còn
    if (sess.timer) clearTimeout(sess.timer);

    const id      = makeSessionId();
    const timeout = gate === 'in' ? IN_TIMEOUT : OUT_TIMEOUT;

    sessions[gate] = {
        id,
        gate,
        rfid:          null,
        plate:         null,
        image_b64:     null,
        apriltag:      null,
        status:        'collecting',
        timer:         setTimeout(() => handleSessionTimeout(gate, id), timeout),
        createdAt:     new Date(),
        lastUpdatedAt: new Date(),
    };

    console.log(`[SESSION ${id}] Created — gate=${gate}, timeout=${timeout}ms`);
}

/**
 * Nhận RFID từ MQTT event.
 * Nếu chưa có session (RFID đến trước cảm biến) → tự tạo session.
 */
function addRfidToSession(gate, cardID) {
    const normalizedRfid = String(cardID).trim().toUpperCase();
    latestSwipedRfid = {
        rfid: normalizedRfid,
        timestamp: new Date()
    };
    if (sessions[gate].status === 'idle') {
        console.log(`[SESSION] RFID arrived before sensor on gate=${gate} — auto-creating session`);
        createSession(gate);
    }

    const sess = sessions[gate];
    if (sess.status !== 'collecting' && sess.status !== 'timeout') {
        console.log(`[SESSION ${sess.id}] RFID ignored — status=${sess.status}`);
        // Cập nhật dashboard ngay cả khi bị bỏ qua để bảo vệ thấy mã thẻ vừa quét
        updateScanInfo(gate, null, normalizedRfid, sess.plate, sess.image_b64)
            .catch(e => console.error(`[SESSION ${sess.id}] updateScanInfo(rfid) error:`, e.message));
        return;
    }

    sess.rfid = normalizedRfid;
    sess.lastUpdatedAt = new Date();
    console.log(`[SESSION ${sess.id}] RFID received: ${normalizedRfid}`);

    // Cập nhật dashboard ngay lập tức (fire-and-forget, không block)
    updateScanInfo(gate, null, normalizedRfid, sess.plate, sess.image_b64)
        .catch(e => console.error(`[SESSION ${sess.id}] updateScanInfo(rfid) error:`, e.message));

    // Nếu session đang bị timeout, khôi phục lại để thực hiện validate và mở cổng
    if (sess.status === 'timeout') {
        console.log(`[SESSION ${sess.id}] Session recovered from timeout via RFID scan`);
        sess.status = 'collecting';
    }

    // Proactive Scan: Nếu chưa có biển số, gọi AI chụp và quét ngay lập tức
    if (!sess.plate) {
        console.log(`[SESSION ${sess.id}] RFID swiped but no plate in session — triggering proactive AI scan`);
        triggerAIScan(gate)
            .then(aiData => handleAprilTagAutoEntry(gate, aiData))
            .then(handledByTag => {
                const updatedSess = sessions[gate];
                // Lấy lại dữ liệu scan mới nhất từ AI server nếu có
                const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
                return fetch(`${AI_SERVER_URL}/api/latest-scan`)
                    .then(res => res.json())
                    .then(json => {
                        const gateData = json.data?.[gate];
                        if (!handledByTag && gateData && gateData.plate) {
                            addPlateToSession(gate, gateData.plate, gateData.image_b64, gateData.apriltag);
                        } else {
                            tryValidate(gate);
                        }
                    });
            })
            .catch(scanErr => {
                console.error(`[SESSION ${sess.id}] Proactive AI scan failed:`, scanErr.message);
                tryValidate(gate);
            });
    } else {
        tryValidate(gate);
    }
}

/**
 * Nhận plate từ AI server (POST /api/gate/plate-ready) hoặc từ capture-and-scan response.
 * Guard chặn duplicate call nếu session đã vượt qua collecting.
 */
export function addPlateToSession(gate, plate, image_b64, apriltag) {
    if (sessions[gate].status === 'idle') {
        console.log(`[SESSION] Plate arrived before sensor on gate=${gate} — auto-creating session`);
        createSession(gate);
    }

    const sess = sessions[gate];
    if (sess.status !== 'collecting' && sess.status !== 'timeout') {
        console.log(`[SESSION ${sess.id || 'N/A'}] Plate ignored — status=${sess.status}`);
        return;
    }

    sess.plate         = plate;
    sess.image_b64     = image_b64  || null;
    sess.apriltag      = apriltag != null ? apriltag : sess.apriltag;
    sess.lastUpdatedAt = new Date();
    console.log(`[SESSION ${sess.id}] Plate received: ${plate}${apriltag != null ? ` | AprilTag: ${apriltag}` : ''}`);

    // Cập nhật dashboard ngay lập tức (fire-and-forget, không block)
    updateScanInfo(gate, null, sess.rfid, plate, image_b64)
        .catch(e => console.error(`[SESSION ${sess.id}] updateScanInfo(plate) error:`, e.message));

    // Nếu session đang bị timeout, khôi phục lại để thực hiện validate và mở cổng
    if (sess.status === 'timeout') {
        console.log(`[SESSION ${sess.id}] Session recovered from timeout via plate detection`);
        sess.status = 'collecting';
    }

    tryValidate(gate);
}

/**
 * Kiểm tra điều kiện đủ dữ liệu, chỉ validate 1 lần duy nhất.
 */
function tryValidate(gate) {
    const sess = sessions[gate];

    if (sess.status !== 'collecting') return;   // Guard: tránh validate nhiều lần
    if (!sess.rfid || !sess.plate)   return;    // Chưa đủ dữ liệu

    // Đổi status ngay lập tức trước khi async để tránh race condition
    sess.status        = 'validating';
    sess.lastUpdatedAt = new Date();
    if (sess.timer) {
        clearTimeout(sess.timer);
        sess.timer = null;
    }

    console.log(`[SESSION ${sess.id}] RFID + Plate ready → starting validation`);

    // Chạy validate bất đồng bộ, không block MQTT thread
    validateAndOpen(gate, { ...sess }).catch(err => {
        console.error(`[SESSION ${sess.id}] Validation error:`, err.message);
        sessions[gate].status = 'done';
    });
}

/**
 * Xử lý khi hết thời gian chờ mà chưa đủ dữ liệu.
 */
async function handleSessionTimeout(gate, sessionId) {
    const sess = sessions[gate];

    // Bỏ qua nếu đây không còn là session hiện tại hoặc đã không còn collecting
    if (sess.id !== sessionId)         return;
    if (sess.status !== 'collecting')  return;

    sess.status        = 'timeout';
    sess.lastUpdatedAt = new Date();

    let warningMsg;
    if (!sess.rfid && !sess.plate) {
        warningMsg = 'Không phát hiện phương tiện hợp lệ!';
    } else if (!sess.rfid) {
        warningMsg = `Chưa quẹt thẻ RFID! (Biển số đọc được: ${sess.plate})`;
    } else {
        warningMsg = `Không nhận diện được biển số xe! (RFID: ${sess.rfid})`;
    }

    console.log(`[SESSION ${sessionId}] TIMEOUT — ${warningMsg}`);
    await updateScanInfo(gate, warningMsg, sess.rfid, sess.plate, sess.image_b64);
}

// ─── Core Validation + Barrier Control ────────────────────────────────────────

/**
 * Toàn bộ business logic validate xe tháng / xe vãng lai, vào / ra.
 * Chỉ được gọi 1 lần sau khi session có đủ rfid + plate.
 */
async function validateAndOpen(gate, session) {
    const { id, rfid, plate, image_b64, apriltag } = session;

    console.log(`[SESSION ${id}] validateAndOpen: gate=${gate}, rfid=${rfid}, plate=${plate}`);

    // Cập nhật dashboard bảo vệ ngay lập tức
    await updateScanInfo(gate, null, rfid, plate, image_b64);

    let shouldOpen = false;

    try {
        if (gate === 'in') {
            shouldOpen = await handleEntryValidation(id, rfid, plate, image_b64);
        } else {
            shouldOpen = await handleExitValidation(id, rfid, plate, image_b64);
        }
    } catch (err) {
        console.error(`[SESSION ${id}] Error during validation:`, err.message);
    }

    // Cập nhật status session
    sessions[gate].status        = shouldOpen ? 'opening' : 'done';
    sessions[gate].lastUpdatedAt = new Date();

    if (shouldOpen) {
        openBarrierMQTT(gate, plate);
        sessions[gate].status = 'done';
        scheduleSessionCleanup(gate, id, 5000);
        console.log(`[SESSION ${id}] Barrier OPENED. Cleanup in 5s.`);
    }
}

async function handleEntryValidation(sessionId, rfid, plate, image_b64) {
    const normalizedRfid = String(rfid).trim().toUpperCase();

    // Nếu cùng RFID đang có session in_progress → xe chưa ra, cảm biến không detect được → chuyển sang xử lý lượt RA
    try {
        const sameRfidSess = await ParkingSession.findOne({ rfid: normalizedRfid, status: 'in_progress' });
        if (sameRfidSess) {
            console.log(`[SESSION ${sessionId}] RFID ${normalizedRfid} đang có session in_progress (${sameRfidSess._id}) → cảm biến OUT không detect → chuyển sang handleExitValidation`);
            return handleExitValidation(sessionId, rfid, plate, image_b64);
        }
        // Kiểm tra trùng biển số (khác thẻ RFID)
        const duplicateSess = await ParkingSession.findOne({
            licensePlate: plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
            status: 'in_progress'
        });
        if (duplicateSess) {
            duplicateSess.status = 'cancelled';
            duplicateSess.notes += ` | Tự động hủy do phát hiện lượt xe vào mới trùng lặp tại ${new Date().toISOString()}`;
            await duplicateSess.save();
            console.log(`[SESSION ${sessionId}] Tự động đóng phiên trùng lặp cũ: ${duplicateSess._id}`);
        }
    } catch (e) {
        console.error(`[SESSION ${sessionId}] Lỗi khi kiểm tra session trùng lặp:`, e.message);
    }

    // Kiểm tra xe đăng ký tháng theo RFID
    const vehicle = await Vehicle.findOne({ rfidCard: normalizedRfid, status: 'active' });

    if (vehicle) {
        const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
        if (subscription) {
            const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const cleanScanned    = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            if (cleanRegistered !== cleanScanned) {
                console.log(`[SESSION ${sessionId}] Monthly IN license plate changed from ${vehicle.licensePlate} to ${plate}. Updating vehicle record...`);
                vehicle.licensePlate = plate;
                await vehicle.save();
            }

            console.log(`[SESSION ${sessionId}] Monthly IN matched: ${vehicle.licensePlate}`);
            // Bug fix: sessionCode dùng counter + random suffix để tránh duplicate key khi 2 xe vào cùng millisecond
            const sessionCode = `PS-IN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            try {
                const ps = await ParkingSession.create({
                    sessionCode,
                    vehicleId:    vehicle._id,
                    userId:       subscription.userId,
                    licensePlate: vehicle.licensePlate,
                    vehicleType:  vehicle.vehicleType,
                    entryAt:      new Date(),
                    entryMethod:  'rfid',
                    isVisitor:    false,
                    status:       'in_progress',
                    rfid:         normalizedRfid,
                    notes:        `RFID: ${normalizedRfid} | Session: ${sessionId}`,
                });
                console.log(`[SESSION ${sessionId}] DB entry session created: ${ps._id}`);
            } catch (dbErr) {
                console.error(`[SESSION ${sessionId}] FAILED to create monthly entry session:`, dbErr.message);
                throw dbErr;   // re-throw để validateAndOpen biết lỗi
            }
            return true;
        } else {
            // Bug fix: vehicle tồn tại nhưng không có gói active → xử lý như xe vãng lai
            console.log(`[SESSION ${sessionId}] Vehicle ${normalizedRfid} found but no active subscription — treating as visitor`);
        }
    }

    // Xe vãng lai vào
    console.log(`[SESSION ${sessionId}] Visitor IN: plate=${plate}, rfid=${normalizedRfid}`);
    // Bug fix: sessionCode dùng counter + random suffix để tránh duplicate key
    const sessionCode = `PS-IN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
        const ps = await ParkingSession.create({
            sessionCode,
            licensePlate: plate,
            vehicleType:  'car',
            entryAt:      new Date(),
            entryMethod:  'rfid',
            isVisitor:    true,
            status:       'in_progress',
            rfid:         normalizedRfid,
            notes:        `RFID: ${normalizedRfid} | Session: ${sessionId}`,
        });
        console.log(`[SESSION ${sessionId}] DB visitor entry session created: ${ps._id}`);
    } catch (dbErr) {
        console.error(`[SESSION ${sessionId}] FAILED to create visitor entry session:`, dbErr.message);
        throw dbErr;   // re-throw để validateAndOpen biết lỗi
    }
    return true;
}

async function handleExitValidation(sessionId, rfid, plate, image_b64) {
    const normalizedRfid = String(rfid).trim().toUpperCase();
    const vehicle = await Vehicle.findOne({ rfidCard: normalizedRfid, status: 'active' });

    if (vehicle) {
        const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
        if (subscription) {
            const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const cleanScanned    = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            if (cleanRegistered !== cleanScanned) {
                console.log(`[SESSION ${sessionId}] Monthly OUT license plate changed from ${vehicle.licensePlate} to ${plate}. Updating vehicle record...`);
                vehicle.licensePlate = plate;
                await vehicle.save();
            }

            const activeSession = await ParkingSession.findOne({
                vehicleId: vehicle._id,
                status:    'in_progress',
            });
            if (activeSession) {
                console.log(`[SESSION ${sessionId}] Monthly OUT matched: ${vehicle.licensePlate}`);
                activeSession.licensePlate    = plate; // Đồng bộ biển số mới vào session
                activeSession.exitAt          = new Date();
                activeSession.exitMethod      = 'rfid';
                activeSession.status          = 'completed';
                activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                activeSession.feeAmount       = 0;
                activeSession.paymentStatus   = 'paid';
                await activeSession.save();

                // Gửi thông tin thành công lên AI server
                await updateScanInfo('out', null, normalizedRfid, plate, image_b64, {
                    entryTime: activeSession.entryAt.toLocaleTimeString('vi-VN') + ' ' + activeSession.entryAt.toLocaleDateString('vi-VN'),
                    exitTime: activeSession.exitAt.toLocaleTimeString('vi-VN') + ' ' + activeSession.exitAt.toLocaleDateString('vi-VN'),
                    fee: 0,
                    paymentStatus: 'paid'
                });
                return true;
            } else {
                console.log(`[SESSION ${sessionId}] Monthly OUT: no active session!`);
                await updateScanInfo('out', 'Xe tháng chưa quét lượt vào!', normalizedRfid, plate, image_b64);
                return false;
            }
        } else {
            // Bug fix: vehicle tồn tại nhưng không có gói active → xử lý như xe vãng lai
            console.log(`[SESSION ${sessionId}] Vehicle ${normalizedRfid} found but no active subscription — treating as visitor exit`);
        }
    }

    // Xe vãng lai ra — tìm session vào theo trường rfid trực tiếp
    console.log(`[SESSION ${sessionId}] Visitor OUT: looking for entry session with RFID=${normalizedRfid}`);
    const activeSession = await ParkingSession.findOne({
        rfid:   normalizedRfid,
        status: 'in_progress',
    });
    console.log(`[SESSION ${sessionId}] Entry session lookup: ${activeSession ? `FOUND _id=${activeSession._id}` : 'NOT FOUND'}`);

    if (activeSession) {
        const cleanEntry = activeSession.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanExit  = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const now = new Date();
        const durationMs      = now - activeSession.entryAt;
        const durationSeconds = Math.round(durationMs / 1000);
        const FEE_PER_SECOND  = parseFloat(process.env.FEE_PER_SECOND || '3'); // VND/giây (~10,800đ/giờ)
        const fee = Math.max(Math.round(durationSeconds * FEE_PER_SECOND), 2000); // tối thiểu 2,000đ
        const entryTimeStr = activeSession.entryAt.toLocaleTimeString('vi-VN') + ' ' + activeSession.entryAt.toLocaleDateString('vi-VN');
        const exitTimeStr  = now.toLocaleTimeString('vi-VN') + ' ' + now.toLocaleDateString('vi-VN');
        const qrUrl = buildVietQrUrl({ amount: fee, code: `DX${normalizedRfid}` });

        if (cleanEntry === cleanExit) {
            console.log(`[SESSION ${sessionId}] Visitor OUT matched — vào: ${entryTimeStr}, ra: ${exitTimeStr}, thời gian: ${durationSeconds}s, phí: ${fee}đ`);
            activeSession.exitAt          = now;
            activeSession.exitMethod      = 'rfid';
            activeSession.status          = 'completed';
            activeSession.durationMinutes = Math.round(durationMs / 60000);
            activeSession.feeAmount       = fee;
            activeSession.paymentStatus   = 'unpaid';
            await activeSession.save();

            // Gửi thông tin lên AI server để hiển thị trên màn hình bảo vệ
            await updateScanInfo('out', null, normalizedRfid, plate, image_b64, {
                entryTime: entryTimeStr,
                exitTime: exitTimeStr,
                durationSeconds,
                fee,
                paymentStatus: 'unpaid',
                qrUrl
            });
            return true;
          } else {
              console.log(`[SESSION ${sessionId}] Visitor OUT mismatch: entry=${activeSession.licensePlate}, exit=${plate} — duration=${durationSeconds}s, fee=${fee}đ`);
              // Lệch biển số xe vãng lai lúc ra: Gửi cảnh báo kèm giờ vào/ra, phí, qrUrl để bảo vệ thấy
              await updateScanInfo('out',
                  `Lệch biển số lúc ra! Vào: ${activeSession.licensePlate}, Ra: ${plate}`,
                  normalizedRfid, plate, image_b64, {
                      entryTime: entryTimeStr,
                      exitTime: exitTimeStr,
                      durationSeconds,
                      fee,
                      paymentStatus: 'unpaid',
                      qrUrl
                  }
              );
              return false;
          }
    } else {
        console.log(`[SESSION ${sessionId}] Visitor OUT: RFID=${normalizedRfid} — no entry session found in DB!`);
        await updateScanInfo('out', 'Thẻ chưa quét lượt vào!', normalizedRfid, plate, image_b64);
        return false;
    }
}

// ─── AprilTag Auto-Entry (xe ô tô tháng, không cần RFID) ──────────────────────
async function handleAprilTagAutoEntry(gate, aiData) {
    if (!aiData || aiData.apriltag == null) return false;

    const vehicle = await Vehicle.findOne({ arucoId: aiData.apriltag, vehicleType: 'car' });
    if (!vehicle) return false;

    const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
    if (!subscription) return false;

    const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanScanned    = aiData.plate ? aiData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

    if (cleanRegistered === cleanScanned) {
        console.log(`[AprilTag] Car monthly matched: ${vehicle.licensePlate} → auto-open gate=${gate}`);
        openBarrierMQTT(gate, vehicle.licensePlate);

        if (gate === 'in') {
            const sessionCode = `PS-IN-CAR-${Date.now()}`;
            await ParkingSession.create({
                sessionCode,
                vehicleId:    vehicle._id,
                userId:       subscription.userId,
                licensePlate: vehicle.licensePlate,
                vehicleType:  'car',
                entryAt:      new Date(),
                entryMethod:  'ai',
                isVisitor:    false,
                status:       'in_progress',
                rfid:         vehicle.rfidCard ? vehicle.rfidCard.toUpperCase().trim() : null, // Đồng bộ rfid từ vehicle để đối soát lúc ra
                notes:        `AprilTag ID: ${aiData.apriltag}`,
            });
        } else {
            const activeSession = await ParkingSession.findOne({
                vehicleId: vehicle._id,
                status:    'in_progress',
            });
            if (activeSession) {
                activeSession.exitAt          = new Date();
                activeSession.exitMethod      = 'ai';
                activeSession.status          = 'completed';
                activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                activeSession.feeAmount       = 0;
                activeSession.paymentStatus   = 'paid';
                await activeSession.save();
            }
        }

        // Đánh dấu session done vì AprilTag đã xử lý xong
        const sess = sessions[gate];
        if (sess.status === 'collecting') {
            if (sess.timer) clearTimeout(sess.timer);
            sessions[gate].status = 'done';
            console.log(`[SESSION ${sess.id}] Completed via AprilTag auto-entry`);
        }
        return true;
    } else {
        console.log(`[AprilTag] Mismatch: registered=${vehicle.licensePlate}, scanned=${aiData.plate}`);
        await updateScanInfo(gate,
            `Lệch biển số xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData.plate || 'Không đọc được'}`
        );
        return false;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function triggerAIScan(gate) {
    try {
        const res  = await fetch(`${AI_SERVER_URL}/api/capture-and-scan?gate=${gate}`, { method: 'POST' });
        const json = await res.json();
        if (json.status === 'success') {
            console.log(`[AI Scan] gate=${gate} → plate=${json.data.plate}, apriltag=${json.data.apriltag}`);
        }
        return json.data;
    } catch (err) {
        console.error(`[AI Scan] Error (gate=${gate}):`, err.message);
        return null;
    }
}

export async function updateScanInfo(gate, warning, rfid, plate, image_b64, extraData = {}) {
    try {
        const body = { gate, ...extraData };
        // Chỉ truyền các tham số khác null/undefined để tránh ghi đè dữ liệu AI đã nhận dạng trên FastAPI
        if (warning    !== undefined && warning   !== null) body.warning    = warning;
        if (rfid       !== undefined && rfid      !== null) body.rfid       = rfid;
        if (plate      !== undefined && plate     !== null) body.plate      = plate;
        if (image_b64  !== undefined && image_b64 !== null) body.image_b64  = image_b64;

        await fetch(`${AI_SERVER_URL}/api/update-scan-warning`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
    } catch (err) {
        console.error(`[MQTT] updateScanInfo error (gate=${gate}):`, err.message);
    }
}

function openBarrierMQTT(gate, plate) {
    const client = getMQTTClient();
    if (!client) return;
    const cmd = `OPEN${plate ? `:${plate}` : ''}`;
    client.publish('parking/commands/gate', cmd);
    console.log(`[MQTT] Published: ${cmd} for gate=${gate}`);
}

function scheduleSessionCleanup(gate, sessionId, delayMs) {
    setTimeout(async () => {
        const sess = sessions[gate];
        if (sess.id !== sessionId) return;     // session đã được thay thế bởi xe mới

        // Xóa AI scan cache
        try {
            await fetch(`${AI_SERVER_URL}/api/clear-scan`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ gate }),
            });
        } catch (_) {}

        sessions[gate] = emptySession(gate);
        console.log(`[SESSION ${sessionId}] Cleaned up`);
    }, delayMs);
}

async function handleSlotUpdate(payload) {
    const parts = payload.split(':');
    if (parts.length < 2) return;

    const slotCode  = parts[0].trim().toUpperCase();
    const statusStr = parts.slice(1).join(':').trim();

    let status     = 'available';
    let warningMsg = null;

    if (statusStr === 'CO XE') {
        const activeCnt = await ParkingSession.countDocuments({ status: 'in_progress' });
        if (activeCnt === 0) {
            status     = 'available';
            warningMsg = 'Phát hiện vật cản hoặc lỗi cảm biến (Chưa nhận xe nào vào bãi)!';
            console.log(`[Anomaly] Slot ${slotCode}: false positive sensor`);
        } else {
            status = 'occupied';
        }
    }

    await ParkingSlot.findOneAndUpdate(
        { code: slotCode },
        { status, lastOccupiedAt: status === 'occupied' ? new Date() : null, warning: warningMsg },
        { new: true, upsert: true }
    );
    console.log(`[DB] Slot ${slotCode} → ${status}${warningMsg ? ` | ${warningMsg}` : ''}`);
}

// ─── MQTT Connect ─────────────────────────────────────────────────────────────
export function connectMQTT() {
    console.log(`Connecting to MQTT Broker at ${MQTT_BROKER_URL}...`);
    const client = mqtt.connect(MQTT_BROKER_URL);
    mqttClient = client;

    client.on('connect', () => {
        console.log('Connected to MQTT Broker!');
        client.subscribe('parking/events/gate/in');
        client.subscribe('parking/events/gate/out');
        client.subscribe('parking/events/slots');
        client.subscribe('parking/events/sensor/in');
        client.subscribe('parking/events/sensor/out');
        syncAllSlotsToMQTT();
    });

    async function syncAllSlotsToMQTT() {
        try {
            const slots = await ParkingSlot.find({});
            for (const slot of slots) {
                const statusStr = slot.status === 'occupied' ? 'CO XE' : 'TRONG';
                client.publish('parking/events/slots', `${slot.code}: ${statusStr}`);
            }
            console.log(`[MQTT Sync] Synced ${slots.length} slots`);
        } catch (err) {
            console.error('[MQTT Sync] Error:', err.message);
        }
    }

    client.on('message', async (topic, message) => {
        const payload = message.toString().trim();
        console.log(`[MQTT] ${topic} | ${payload}`);

        try {
            if (topic === 'parking/events/sensor/in') {
                // Nếu cổng ra đang bận (xe đang ra) -> Bỏ qua cảm biến vào để tránh nhiễu chéo
                if (sessions.out.status !== 'idle') {
                    console.log(`[SENSOR IN] Ignored because exit gate is active (status=${sessions.out.status})`);
                    return;
                }
                createSession('in');
                const aiData = await triggerAIScan('in');
                // Xe ô tô tháng nhận diện qua AprilTag (ưu tiên cao nhất, không cần RFID)
                const handledByTag = await handleAprilTagAutoEntry('in', aiData);
                // Nếu không phải AprilTag, feed plate vào session (nếu AI đọc được)
                if (!handledByTag && aiData?.plate) {
                    addPlateToSession('in', aiData.plate, aiData.image_b64, aiData.apriltag);
                }
            }
            else if (topic === 'parking/events/sensor/out') {
                // Nếu cổng vào đang bận (xe đang vào) -> Bỏ qua cảm biến ra để tránh nhiễu chéo
                if (sessions.in.status !== 'idle') {
                    console.log(`[SENSOR OUT] Ignored because entry gate is active (status=${sessions.in.status})`);
                    return;
                }
                createSession('out');
                const aiData = await triggerAIScan('out');
                const handledByTag = await handleAprilTagAutoEntry('out', aiData);
                if (!handledByTag && aiData?.plate) {
                    addPlateToSession('out', aiData.plate, aiData.image_b64, aiData.apriltag);
                }
            }
            else if (topic === 'parking/events/gate/in') {
                addRfidToSession('in', payload);
            }
            else if (topic === 'parking/events/gate/out') {
                addRfidToSession('out', payload);
            }
            else if (topic === 'parking/events/slots') {
                await handleSlotUpdate(payload);
            }
        } catch (error) {
            console.error(`[MQTT Error] Topic ${topic}:`, error.message);
        }
    });

    client.on('error',     (err) => console.error('MQTT Error:', err));
    client.on('reconnect', ()    => console.log('Reconnecting to MQTT...'));

    return client;
}

// Export để /api/gate/reprocess và manual override vẫn hoạt động
export async function processCardSwipe(gate, cardID) {
    addRfidToSession(gate, cardID);
}
