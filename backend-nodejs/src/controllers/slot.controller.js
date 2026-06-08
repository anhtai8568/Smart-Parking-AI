import ParkingSlot from '../../models/parkingslot.js'

const SLOT_CODES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']

// Đảm bảo 6 slot tồn tại trong DB (upsert lần đầu)
async function ensureSlots() {
    for (const code of SLOT_CODES) {
        await ParkingSlot.findOneAndUpdate(
            { code },
            { $setOnInsert: { code, status: 'available', zone: 'A', slotType: 'mixed' } },
            { upsert: true, new: true }
        )
    }
}

// GET /api/slots — trả về trạng thái 6 chỗ đỗ thực tế từ DB
export async function getSlots(req, res) {
    try {
        await ensureSlots()
        const slots = await ParkingSlot.find({ code: { $in: SLOT_CODES } })
            .sort({ code: 1 })
            .lean()
        return res.json({ status: 'success', data: slots })
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}

// POST /api/slots/reset — đặt lại tất cả slot về available (dùng khi cảm biến lỗi)
export async function resetSlots(req, res) {
    try {
        await ParkingSlot.updateMany(
            { code: { $in: SLOT_CODES } },
            { status: 'available', lastOccupiedAt: null }
        )
        return res.json({ status: 'success', message: 'Đã reset tất cả slot về trống.' })
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
