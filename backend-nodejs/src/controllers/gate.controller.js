import { getMQTTClient } from '../config/mqtt.js'

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
