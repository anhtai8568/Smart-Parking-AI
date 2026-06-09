import { getMQTTClient } from '../config/mqtt.js'
import { addPlateToSession, getSessions } from '../config/mqtt.js'
import ParkingSession from '../../models/parkingsession.js'
import Vehicle from '../../models/vehicle.js'

// Mở barrier thủ công
export async function openBarrier(req, res) {
    try {
        const client = getMQTTClient()
        if (!client || !client.connected) {
            return res.status(503).json({
                status: 'error',
                message: 'MQTT broker chưa kết nối. Không thể gửi lệnh.',
            })
        }

        let plate = '';
        const sessions = getSessions();
        const inSess = sessions.in;
        const outSess = sessions.out;
        
        // Nhận gate chỉ định từ request body (nếu có)
        const { gate: reqGate } = req.body || {}
        let activeGate = (reqGate === 'in' || reqGate === 'out') ? reqGate : null;
        
        if (!activeGate) {
            // Tự động xác định cổng đang cần xử lý thủ công (ưu tiên cổng nào vừa cập nhật gần nhất)
            if (inSess.status !== 'idle' && outSess.status !== 'idle') {
                activeGate = inSess.lastUpdatedAt > outSess.lastUpdatedAt ? 'in' : 'out';
            } else if (inSess.status !== 'idle') {
                activeGate = 'in';
            } else if (outSess.status !== 'idle') {
                activeGate = 'out';
            }
        }

        try {
            const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
            const scanRes = await fetch(`${AI_SERVER_URL}/api/latest-scan`);
            const scanJson = await scanRes.json();
            const lastOut = scanJson.data?.out;
            const lastIn = scanJson.data?.in;

            // 1. Trường hợp mở cổng RA thủ công
            if (activeGate === 'out' || (!activeGate && lastOut?.rfid)) {
                const gateSess = sessions.out;
                const rfidVal = String(gateSess.rfid || lastOut?.rfid || '').trim().toUpperCase();
                plate = gateSess.plate || lastOut?.plate || '';

                if (rfidVal) {
                    const activeSession = await ParkingSession.findOne({
                        rfid: rfidVal,
                        status: 'in_progress'
                    });
                    if (activeSession) {
                        const exitNow = new Date();
                        const durationMs = exitNow - activeSession.entryAt;
                        const durationSeconds = Math.round(durationMs / 1000);
                        const FEE_PER_SECOND = parseFloat(process.env.FEE_PER_SECOND || '3');
                        const fee = activeSession.isVisitor
                            ? Math.max(Math.round(durationSeconds * FEE_PER_SECOND), 2000)
                            : 0;
                        activeSession.exitAt          = exitNow;
                        activeSession.exitMethod      = 'manual';
                        activeSession.status          = 'completed';
                        activeSession.durationMinutes = Math.round(durationMs / 60000);
                        activeSession.feeAmount       = fee;
                        activeSession.paymentStatus   = activeSession.isVisitor ? 'unpaid' : 'waived';
                        if (plate) {
                            activeSession.licensePlate = plate;
                        }
                        await activeSession.save();
                        console.log(`[Gate Control] Đã hoàn thành session ${activeSession.sessionCode} (Exit) thủ công.`);
                    }
                }
                
                // Reset in-memory session của cổng ra về idle
                if (gateSess.timer) clearTimeout(gateSess.timer);
                sessions.out.status = 'done';
            }
            // 2. Trường hợp mở cổng VÀO thủ công
            else if (activeGate === 'in' || (!activeGate && lastIn?.rfid)) {
                const gateSess = sessions.in;
                const rfidVal = String(gateSess.rfid || lastIn?.rfid || '').trim().toUpperCase();
                plate = gateSess.plate || lastIn?.plate || 'MANUAL';

                // Đăng ký lượt xe vào thủ công để lúc ra có dữ liệu đối chiếu
                const sessionCode = `PS-IN-MANUAL-${Date.now()}`;
                await ParkingSession.create({
                    sessionCode,
                    licensePlate: plate.toUpperCase(),
                    vehicleType:  'car',
                    entryAt:      new Date(),
                    entryMethod:  'manual',
                    isVisitor:    true,
                    status:       'in_progress',
                    rfid:         rfidVal || null,
                    notes:        `Bảo vệ mở thủ công | RFID: ${rfidVal || 'Không có'}`,
                });
                console.log(`[Gate Control] Đã tạo session vào thủ công ${sessionCode} thành công.`);

                // Reset in-memory session của cổng vào về idle
                if (gateSess.timer) clearTimeout(gateSess.timer);
                sessions.in.status = 'done';
            } else {
                plate = lastOut?.plate || lastIn?.plate || '';
            }
        } catch (sessionErr) {
            console.error('[Gate Control] Lỗi khi tự động hoàn thành session khi mở thủ công:', sessionErr.message);
        }

        const plateSuffix = plate ? `:${plate}` : '';
        client.publish('parking/commands/gate', `OPEN${plateSuffix}`);
        console.log(`[Gate Control] Bảo vệ mở barrier thủ công! (Biển số gửi đi: ${plate || 'Không có'})`);

        // Dọn dẹp AI scan kết quả trên AI server sau khi đã giải quyết xong
        try {
            const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
            await fetch(`${AI_SERVER_URL}/api/clear-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gate: activeGate || 'all' })
            });
        } catch (_) {}

        return res.json({
            status: 'success',
            message: 'Đã gửi lệnh MỞ barrier thành công.',
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

// Đóng barrier thủ công
export async function closeBarrier(req, res) {
    try {
        const client = getMQTTClient()
        if (!client || !client.connected) {
            return res.status(503).json({
                status: 'error',
                message: 'MQTT broker chưa kết nối. Không thể gửi lệnh.',
            })
        }

        client.publish('parking/commands/gate', 'CLOSE')
        console.log('[Gate Control] Bảo vệ đóng barrier thủ công!')

        return res.json({
            status: 'success',
            message: 'Đã gửi lệnh ĐÓNG barrier thành công.',
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

// Reprocess card swipe (manual override by guard)
export async function reprocessSwipe(req, res) {
    try {
        const { gate, rfid } = req.body
        if (!gate || !rfid) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu gate hoặc rfid trong body.',
            })
        }

        const { processCardSwipe } = await import('../config/mqtt.js')
        await processCardSwipe(gate, rfid)

        return res.json({
            status: 'success',
            message: 'Đã xử lý lại quẹt thẻ thành công.',
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

/**
 * POST /api/gate/plate-ready
 * Được AI server gọi khi livestream nhận diện được biển số.
 * Thay thế /api/gate/reprocess để tách biệt OCR khỏi business logic.
 * Body: { gate, plate, image_b64?, apriltag? }
 */
export async function plateReady(req, res) {
    try {
        const { gate, plate, image_b64, apriltag } = req.body

        if (!gate || !plate) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu gate hoặc plate.',
            })
        }
        if (!['in', 'out'].includes(gate)) {
            return res.status(400).json({
                status: 'error',
                message: "gate phải là 'in' hoặc 'out'.",
            })
        }

        addPlateToSession(gate, plate, image_b64 || null, apriltag ?? null)

        return res.json({
            status:  'success',
            message: `Plate '${plate}' received for gate '${gate}'`,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

/**
 * GET /api/gate/sessions (debug)
 * Trả về trạng thái hiện tại của 2 session (in/out).
 */
export async function getSessionsStatus(req, res) {
    const sess = getSessions()
    // Không trả về image_b64 vì quá lớn
    const sanitized = {}
    for (const gate of ['in', 'out']) {
        const { image_b64, timer, ...rest } = sess[gate]
        sanitized[gate] = {
            ...rest,
            hasImage: !!image_b64,
            hasTimer: !!timer,
        }
    }
    return res.json({ status: 'success', data: sanitized })
}
