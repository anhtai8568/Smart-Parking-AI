import { getMQTTClient } from '../config/mqtt.js'
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

        client.publish('parking/commands/gate', 'OPEN')
        console.log('[Gate Control] Bảo vệ mở barrier thủ công!')

        // Tự động hoàn thành session đang chờ nếu có xe ra đang bị lệch biển số
        try {
            const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
            const scanRes = await fetch(`${AI_SERVER_URL}/api/latest-scan`);
            const scanJson = await scanRes.json();
            const lastOut = scanJson.data?.out;
            if (lastOut && lastOut.rfid) {
                const cardID = lastOut.rfid;
                // Tìm session chưa hoàn thành của thẻ này (cho cả xe tháng và vãng lai)
                const activeSession = await ParkingSession.findOne({
                    notes: { $regex: cardID },
                    status: 'in_progress'
                });
                if (activeSession) {
                    activeSession.exitAt          = new Date();
                    activeSession.exitMethod      = 'manual';
                    activeSession.status          = 'completed';
                    activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                    activeSession.feeAmount       = activeSession.isVisitor ? 10000 : 0;
                    activeSession.paymentStatus   = 'paid';
                    if (lastOut.plate) {
                        activeSession.licensePlate = lastOut.plate; // Cập nhật biển số thực tế lúc ra
                    }
                    await activeSession.save();
                    console.log(`[Gate Control] Đã tự động hoàn thành session ${activeSession.sessionCode} cho thẻ ${cardID} khi mở thủ công.`);
                }
            }
        } catch (sessionErr) {
            console.error('[Gate Control] Lỗi khi tự động hoàn thành session khi mở thủ công:', sessionErr.message);
        }

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

// Reprocess card swipe
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
