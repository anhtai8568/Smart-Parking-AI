import mqtt from 'mqtt';
import ParkingSession from '../../models/parkingsession.js';
import ParkingSlot from '../../models/parkingslot.js';
import Vehicle from '../../models/vehicle.js';
import UserPackage from '../../models/userpackage.js';

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

// Cập nhật cảnh báo nhận diện tới AI Server để hiển thị trên Dashboard Bảo vệ
async function updateScanWarning(gate, warning) {
    try {
        await fetch(`${AI_SERVER_URL}/api/update-scan-warning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gate, warning }),
        });
    } catch (err) {
        console.error(`[MQTT] Lỗi khi cập nhật cảnh báo tới AI server (gate=${gate}):`, err.message);
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

        // Đồng bộ toàn bộ trạng thái slot hiện tại lên MQTT broker khi mới kết nối
        syncAllSlotsToMQTT();
    });

    // Hàm đồng bộ toàn bộ slot sang MQTT
    async function syncAllSlotsToMQTT() {
        try {
            const slots = await ParkingSlot.find({});
            for (const slot of slots) {
                const statusStr = (slot.status === 'occupied') ? 'CO XE' : 'TRONG';
                const msg = `${slot.code}: ${statusStr}`;
                client.publish('parking/events/slots', msg);
            }
            console.log(`[MQTT Sync] Đã đồng bộ ${slots.length} vị trí đỗ lên broker.`);
        } catch (err) {
            console.error('[MQTT Sync] Lỗi khi đồng bộ slots:', err.message);
        }
    }

    client.on('message', async (topic, message) => {
        const payload = message.toString().trim();
        console.log(`[MQTT Event] Topic: ${topic} | Payload: ${payload}`);

        try {
            // ─── 1. Cảm biến siêu âm kích hoạt (Xe tiến đến rào) ───
            if (topic === 'parking/events/sensor/in') {
                console.log('[MQTT] Sensor cổng VÀO kích hoạt → gọi AI scan...');
                const aiData = await triggerAIScan('in');
                
                // Cơ chế tự động nhận diện xe ô tô tháng bằng AprilTag
                if (aiData && aiData.apriltag != null) {
                    const vehicle = await Vehicle.findOne({ arucoId: aiData.apriltag, vehicleType: 'car' });
                    if (vehicle) {
                        const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
                        if (subscription) {
                            const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                            const cleanScanned = aiData.plate ? aiData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
                            
                            if (cleanRegistered === cleanScanned) {
                                console.log(`[Double Check] Ô tô tháng khớp biển số: ${vehicle.licensePlate}. Tự động mở rào.`);
                                client.publish('parking/commands/gate', 'OPEN');
                                
                                const sessionCode = `PS-IN-CAR-${Date.now()}`;
                                await ParkingSession.create({
                                    sessionCode,
                                    vehicleId: vehicle._id,
                                    userId: subscription.userId,
                                    licensePlate: vehicle.licensePlate,
                                    vehicleType: 'car',
                                    entryAt: new Date(),
                                    entryMethod: 'ai',
                                    isVisitor: false,
                                    status: 'in_progress',
                                    notes: `AprilTag ID: ${aiData.apriltag}`,
                                });
                            } else {
                                console.log(`[Double Check Alert] Lệch biển số ô tô tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData.plate}`);
                                await updateScanWarning('in', `Lệch biển số xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData.plate || 'Không đọc được'}`);
                            }
                        }
                    }
                }
            }

            else if (topic === 'parking/events/sensor/out') {
                console.log('[MQTT] Sensor cổng RA kích hoạt → gọi AI scan...');
                const aiData = await triggerAIScan('out');

                // Cơ chế tự động nhận diện xe ô tô tháng đi ra bằng AprilTag
                if (aiData && aiData.apriltag != null) {
                    const vehicle = await Vehicle.findOne({ arucoId: aiData.apriltag, vehicleType: 'car' });
                    if (vehicle) {
                        const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
                        if (subscription) {
                            const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                            const cleanScanned = aiData.plate ? aiData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
                            
                            if (cleanRegistered === cleanScanned) {
                                const activeSession = await ParkingSession.findOne({ vehicleId: vehicle._id, status: 'in_progress' });
                                if (activeSession) {
                                    console.log(`[Double Check] Ô tô tháng khớp biển số ra: ${vehicle.licensePlate}. Tự động mở rào.`);
                                    client.publish('parking/commands/gate', 'OPEN');
                                    
                                    activeSession.exitAt = new Date();
                                    activeSession.exitMethod = 'ai';
                                    activeSession.status = 'completed';
                                    activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                                    activeSession.feeAmount = 0;
                                    activeSession.paymentStatus = 'paid';
                                    await activeSession.save();
                                }
                            } else {
                                console.log(`[Double Check Alert] Lệch biển số ra ô tô tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData.plate}`);
                                await updateScanWarning('out', `Lệch biển số xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData.plate || 'Không đọc được'}`);
                            }
                        }
                    }
                }
            }

            // ─── 2. Quẹt thẻ đi vào cổng ───
            else if (topic === 'parking/events/gate/in') {
                const cardID = payload;
                let aiData = null;
                try {
                    const res  = await fetch(`${AI_SERVER_URL}/api/latest-scan`);
                    const json = await res.json();
                    aiData = json.data?.in;
                } catch (_) {}

                // Kiểm tra xem thẻ RFID này có thuộc về xe đăng ký tháng nào không
                const vehicle = await Vehicle.findOne({ rfidCard: cardID, status: 'active' });
                if (vehicle) {
                    const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
                    if (subscription) {
                        // Xác thực kép (Double Check) cho xe máy / ô tô tháng quẹt thẻ
                        const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        const cleanScanned = aiData?.plate ? aiData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

                        if (cleanRegistered === cleanScanned) {
                            console.log(`[Double Check] Khớp biển số xe tháng: ${vehicle.licensePlate}. Mở barrier.`);
                            client.publish('parking/commands/gate', 'OPEN');
                            
                            const sessionCode = `PS-IN-${Date.now()}`;
                            await ParkingSession.create({
                                sessionCode,
                                vehicleId: vehicle._id,
                                userId: subscription.userId,
                                licensePlate: vehicle.licensePlate,
                                vehicleType: vehicle.vehicleType,
                                entryAt: new Date(),
                                entryMethod: 'rfid',
                                isVisitor: false,
                                status: 'in_progress',
                                notes: `RFID Tháng: ${cardID}`,
                            });
                        } else {
                            console.log(`[Double Check Alert] Lệch biển số xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData?.plate}`);
                            await updateScanWarning('in', `Lệch biển số xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData?.plate || 'Không thấy'}`);
                        }
                        return; // Hoàn thành xử lý xe tháng
                    }
                }

                // Nếu không phải xe đăng ký tháng -> Xử lý xe vãng lai vào
                const licensePlate = aiData?.plate;
                if (licensePlate) {
                    console.log(`[Visitor In] Nhận diện biển xe vãng lai: ${licensePlate}. Mở barrier.`);
                    client.publish('parking/commands/gate', 'OPEN');
                    
                    const sessionCode = `PS-IN-${Date.now()}`;
                    await ParkingSession.create({
                        sessionCode,
                        licensePlate,
                        vehicleType: 'car', // mặc định
                        entryAt: new Date(),
                        entryMethod: 'rfid',
                        isVisitor: true,
                        status: 'in_progress',
                        notes: `RFID: ${cardID}`,
                    });
                } else {
                    console.log(`[Visitor In Alert] Thẻ vãng lai quẹt nhưng không nhận diện được biển số. Giữ rào.`);
                    await updateScanWarning('in', 'Thẻ vãng lai quẹt nhưng không thấy biển số xe!');
                }
            }

            // ─── 3. Quẹt thẻ đi ra cổng ───
            else if (topic === 'parking/events/gate/out') {
                const cardID = payload;
                let aiData = null;
                try {
                    const res  = await fetch(`${AI_SERVER_URL}/api/latest-scan`);
                    const json = await res.json();
                    aiData = json.data?.out;
                } catch (_) {}

                // Kiểm tra xem thẻ RFID này có thuộc về xe đăng ký tháng nào không
                const vehicle = await Vehicle.findOne({ rfidCard: cardID, status: 'active' });
                if (vehicle) {
                    const subscription = await UserPackage.findOne({ vehicleId: vehicle._id, status: 'active' });
                    if (subscription) {
                        // Xác thực kép (Double Check) lúc ra cho xe tháng
                        const cleanRegistered = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        const cleanScanned = aiData?.plate ? aiData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

                        if (cleanRegistered === cleanScanned) {
                            const activeSession = await ParkingSession.findOne({ vehicleId: vehicle._id, status: 'in_progress' });
                            if (activeSession) {
                                console.log(`[Double Check] Khớp biển số ra xe tháng: ${vehicle.licensePlate}. Mở barrier.`);
                                client.publish('parking/commands/gate', 'OPEN');
                                
                                activeSession.exitAt = new Date();
                                activeSession.exitMethod = 'rfid';
                                activeSession.status = 'completed';
                                activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                                activeSession.feeAmount = 0;
                                activeSession.paymentStatus = 'paid';
                                await activeSession.save();
                            }
                        } else {
                            console.log(`[Double Check Alert] Lệch biển số ra xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData?.plate}`);
                            await updateScanWarning('out', `Lệch biển số xe tháng! Đăng ký: ${vehicle.licensePlate}, AI đọc: ${aiData?.plate || 'Không thấy'}`);
                        }
                        return; // Hoàn thành xử lý xe tháng ra
                    }
                }

                // Xử lý xe vãng lai ra
                const activeSession = await ParkingSession.findOne({
                    notes: { $regex: cardID },
                    status: 'in_progress'
                });

                if (activeSession) {
                    const cleanEntry = activeSession.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const cleanExit = aiData?.plate ? aiData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
                    
                    const isPlaceholder = activeSession.licensePlate.startsWith('RFID-');
                    
                    if (isPlaceholder || cleanEntry === cleanExit) {
                        console.log(`[Visitor Out] Xác thực kép thành công xe vãng lai. Mở barrier.`);
                        client.publish('parking/commands/gate', 'OPEN');
                        
                        activeSession.exitAt          = new Date();
                        activeSession.exitMethod      = 'rfid';
                        activeSession.status          = 'completed';
                        activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000);
                        activeSession.feeAmount       = 10000;
                        activeSession.paymentStatus   = 'paid';
                        if (isPlaceholder && aiData?.plate) {
                            activeSession.licensePlate = aiData.plate; // cập nhật biển số thực tế lúc ra
                        }
                        await activeSession.save();
                    } else {
                        console.log(`[Visitor Out Alert] Lệch biển số ra! Vào: ${activeSession.licensePlate}, Ra: ${aiData?.plate}`);
                        await updateScanWarning('out', `Lệch biển số lúc ra! Vào: ${activeSession.licensePlate}, Ra: ${aiData?.plate || 'Không đọc được'}`);
                    }
                } else {
                    console.log(`[DB Warning] Không tìm thấy lượt vào cho thẻ ${cardID}`);
                    await updateScanWarning('out', 'Thẻ chưa quét lượt vào!');
                }
            }

            // ─── 4. Cập nhật vị trí đỗ xe ───
            else if (topic === 'parking/events/slots') {
                const parts = payload.split(':');
                if (parts.length >= 2) {
                    const slotCode  = parts[0].trim().toUpperCase();
                    const statusStr = parts.slice(1).join(':').trim();
                    
                    let status = 'available';
                    let warningMsg = null;

                    if (statusStr === 'CO XE') {
                        const activeSessionsCount = await ParkingSession.countDocuments({ status: 'in_progress' });
                        if (activeSessionsCount === 0) {
                            // Chưa nhận xe nào vào bãi -> Có tín hiệu ở cảm biến dò line nhưng đó không phải xe vào chỗ đó
                            status = 'available';
                            warningMsg = 'Phát hiện vật cản hoặc lỗi cảm biến (Chưa nhận xe nào vào bãi)!';
                            console.log(`[Anomaly] Slot ${slotCode} phát hiện tín hiệu dò line giả (chưa nhận xe nào vào bãi).`);
                        } else {
                            status = 'occupied';
                            warningMsg = null;
                        }
                    } else {
                        status = 'available';
                        warningMsg = null;
                    }

                    await ParkingSlot.findOneAndUpdate(
                        { code: slotCode },
                        { 
                            status, 
                            lastOccupiedAt: status === 'occupied' ? new Date() : null,
                            warning: warningMsg
                        },
                        { new: true, upsert: true }
                    );

                    console.log(`[DB] Slot ${slotCode} → ${status}${warningMsg ? ` | Warning: ${warningMsg}` : ''}`);
                }
            }
        } catch (error) {
            console.error(`[MQTT Error] Topic ${topic}:`, error.message);
        }
    });

    client.on('error', (err) => {
        console.error('MQTT Client Error:', err);
    });

    // Sự kiện kết nối lại để đồng bộ lại slot status
    client.on('reconnect', () => {
        console.log('Reconnecting to MQTT Broker...');
    });

    return client;
}
