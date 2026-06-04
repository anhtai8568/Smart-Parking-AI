import mqtt from 'mqtt';
import ParkingSession from '../../models/parkingsession.js';
import ParkingSlot from '../../models/parkingslot.js';

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

export function connectMQTT() {
    console.log(`Connecting to MQTT Broker at ${MQTT_BROKER_URL}...`);
    const client = mqtt.connect(MQTT_BROKER_URL);

    client.on('connect', () => {
        console.log('✅ Connected to MQTT Broker successfully!');
        client.subscribe('parking/events/gate/in');
        client.subscribe('parking/events/gate/out');
        client.subscribe('parking/events/slots');
    });

    client.on('message', async (topic, message) => {
        const payload = message.toString().trim();
        console.log(`[MQTT Event] Topic: ${topic} | Payload: ${payload}`);

        try {
            if (topic === 'parking/events/gate/in') {
                const cardID = payload;
                const sessionCode = `PS-IN-${Date.now()}`;
                
                // Tạo hoặc cập nhật phiên gửi xe cho thẻ cổng vào (xe vãng lai)
                const newSession = await ParkingSession.create({
                    sessionCode,
                    licensePlate: `RFID-${cardID}`,
                    vehicleType: 'car',
                    entryAt: new Date(),
                    entryMethod: 'rfid',
                    isVisitor: true,
                    status: 'in_progress',
                    notes: `Xe vang lai quet the. ID Card: ${cardID}`
                });
                
                console.log(`[Database] Created Parking Session for entry card ${cardID}. SessionCode: ${sessionCode}`);
            } 
            else if (topic === 'parking/events/gate/out') {
                const cardID = payload;
                
                // Tìm phiên gửi xe đang hoạt động của thẻ này
                const activeSession = await ParkingSession.findOne({
                    licensePlate: `RFID-${cardID}`,
                    status: 'in_progress'
                });

                if (activeSession) {
                    activeSession.exitAt = new Date();
                    activeSession.exitMethod = 'rfid';
                    activeSession.status = 'completed';
                    activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                    activeSession.feeAmount = 10000; // Phí gửi xe mẫu
                    activeSession.paymentStatus = 'paid';
                    await activeSession.save();
                    console.log(`[Database] Completed Parking Session for exit card ${cardID}. Fee: ${activeSession.feeAmount} VND`);
                } else {
                    console.log(`[Database Warning] No active session found for card ID ${cardID}`);
                }
            } 
            else if (topic === 'parking/events/slots') {
                // Định dạng: "S1: CO XE" hoặc "S1: TRONG"
                const parts = payload.split(':');
                if (parts.length === 2) {
                    const slotCode = parts[0].trim().toUpperCase();
                    const statusStr = parts[1].trim();
                    const status = (statusStr === 'CO XE') ? 'occupied' : 'available';

                    // Cập nhật trạng thái ô đỗ xe trong Database
                    await ParkingSlot.findOneAndUpdate(
                        { code: slotCode },
                        { status, lastOccupiedAt: status === 'occupied' ? new Date() : null },
                        { new: true, upsert: true }
                    );

                    console.log(`[Database] Updated Parking Slot ${slotCode} status to ${status}`);
                }
            }
        } catch (error) {
            console.error(`[MQTT Error] Failed to process message on ${topic}:`, error.message);
        }
    });

    client.on('error', (err) => {
        console.error('MQTT Client Error:', err);
    });

    return client;
}
