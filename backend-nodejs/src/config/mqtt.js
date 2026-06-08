import mqtt from 'mqtt';
import ParkingSession from '../../models/parkingsession.js';
import ParkingSlot from '../../models/parkingslot.js';

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const AI_SERVER_URL   = process.env.AI_SERVER_URL   || 'http://localhost:8000';

let mqttClient = null;

export function getMQTTClient() {
    return mqttClient;
}

// Gọi AI server chụp ảnh + nhận diện biển số/AprilTag khi cổng kích hoạt
async function triggerAIScan(gate) {
    try {
        const res  = await fetch(`${AI_SERVER_URL}/api/capture-and-scan?gate=${gate}`, { method: 'POST' });
        const json = await res.json();
        if (json.status === 'success') {
            console.log(`[AI Scan] Gate ${gate} → plate: ${json.data.plate}, apriltag: ${json.data.apriltag}`);
        }
        return json.data;
    } catch (err) {
        console.error(`[AI Scan] Lỗi khi gọi AI server (gate=${gate}):`, err.message);
        return null;
    }
}

export function connectMQTT() {
    console.log(`Connecting to MQTT Broker at ${MQTT_BROKER_URL}...`);
    const client = mqtt.connect(MQTT_BROKER_URL);
    mqttClient = client;

    client.on('connect', () => {
        console.log('✅ Connected to MQTT Broker successfully!');
        client.subscribe('parking/events/gate/in');
        client.subscribe('parking/events/gate/out');
        client.subscribe('parking/events/slots');
        client.subscribe('parking/events/sensor/in');   // Cảm biến siêu âm cổng vào kích hoạt
        client.subscribe('parking/events/sensor/out');  // Cảm biến siêu âm cổng ra kích hoạt
    });

    client.on('message', async (topic, message) => {
        const payload = message.toString().trim();
        console.log(`[MQTT Event] Topic: ${topic} | Payload: ${payload}`);

        try {
            // ─── Cảm biến siêu âm kích hoạt → trigger AI chụp ảnh ───
            if (topic === 'parking/events/sensor/in') {
                console.log('[MQTT] Sensor cổng VÀO kích hoạt → gọi AI scan...');
                await triggerAIScan('in');
            }

            else if (topic === 'parking/events/sensor/out') {
                console.log('[MQTT] Sensor cổng RA kích hoạt → gọi AI scan...');
                await triggerAIScan('out');
            }

            // ─── Xe vào (quẹt thẻ thành công) ───
            else if (topic === 'parking/events/gate/in') {
                const cardID = payload;
                // Lấy kết quả scan mới nhất từ AI (đã trigger trước đó bởi sensor)
                let aiData = null;
                try {
                    const res  = await fetch(`${AI_SERVER_URL}/api/latest-scan`);
                    const json = await res.json();
                    aiData = json.data?.in;
                } catch (_) {}

                const licensePlate = aiData?.plate || `RFID-${cardID}`;
                const sessionCode  = `PS-IN-${Date.now()}`;

                await ParkingSession.create({
                    sessionCode,
                    licensePlate,
                    vehicleType: 'car',
                    entryAt: new Date(),
                    entryMethod: 'rfid',
                    isVisitor: true,
                    status: 'in_progress',
                    notes: `RFID: ${cardID}${aiData?.apriltag ? ` | AprilTag: ${aiData.apriltag}` : ''}`,
                });

                console.log(`[DB] Tạo session vào. Biển: ${licensePlate}. RFID: ${cardID}`);
            }

            // ─── Xe ra (quẹt thẻ thành công) ───
            else if (topic === 'parking/events/gate/out') {
                const cardID = payload;

                const activeSession = await ParkingSession.findOne({
                    $or: [
                        { licensePlate: `RFID-${cardID}`, status: 'in_progress' },
                        { notes: { $regex: cardID }, status: 'in_progress' },
                    ],
                });

                if (activeSession) {
                    activeSession.exitAt          = new Date();
                    activeSession.exitMethod      = 'rfid';
                    activeSession.status          = 'completed';
                    activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                    activeSession.feeAmount       = 10000;
                    activeSession.paymentStatus   = 'paid';
                    await activeSession.save();
                    console.log(`[DB] Session ra hoàn thành. Fee: ${activeSession.feeAmount} VND`);
                } else {
                    console.log(`[DB Warning] Không tìm thấy session đang hoạt động cho thẻ ${cardID}`);
                }
            }

            // ─── Cập nhật trạng thái ô đỗ xe ───
            else if (topic === 'parking/events/slots') {
                const parts = payload.split(':');
                if (parts.length >= 2) {
                    const slotCode  = parts[0].trim().toUpperCase();
                    const statusStr = parts.slice(1).join(':').trim();
                    const status    = (statusStr === 'CO XE') ? 'occupied' : 'available';

                    await ParkingSlot.findOneAndUpdate(
                        { code: slotCode },
                        { status, lastOccupiedAt: status === 'occupied' ? new Date() : null },
                        { new: true, upsert: true }
                    );

                    console.log(`[DB] Slot ${slotCode} → ${status}`);
                }
            }
        } catch (error) {
            console.error(`[MQTT Error] Topic ${topic}:`, error.message);
        }
    });

    client.on('error', (err) => {
        console.error('MQTT Client Error:', err);
    });

    return client;
}
