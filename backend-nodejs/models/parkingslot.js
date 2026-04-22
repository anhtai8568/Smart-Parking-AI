import mongoose from 'mongoose'

const parkingSlotSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        zone: {
            type: String,
            trim: true,
            default: 'A',
        },
        slotType: {
            type: String,
            enum: ['car', 'motorbike', 'mixed'],
            default: 'mixed',
        },
        status: {
            type: String,
            enum: ['available', 'occupied', 'maintenance'],
            default: 'available',
        },
        currentSessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ParkingSession',
            default: null,
        },
        lastOccupiedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'parking_slots',
    }
)

parkingSlotSchema.index({ code: 1 }, { unique: true })
parkingSlotSchema.index({ status: 1, slotType: 1 })

const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema)

export default ParkingSlot
