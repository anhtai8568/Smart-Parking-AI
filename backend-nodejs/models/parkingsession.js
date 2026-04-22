import mongoose from 'mongoose'

const parkingSessionSchema = new mongoose.Schema(
    {
        sessionCode: {
            type: String,
            required: true,
            trim: true,
        },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            default: null,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        licensePlate: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        vehicleType: {
            type: String,
            enum: ['car', 'motorbike'],
            required: true,
        },
        entryAt: {
            type: Date,
            required: true,
        },
        exitAt: {
            type: Date,
            default: null,
        },
        durationMinutes: {
            type: Number,
            default: null,
        },
        entryMethod: {
            type: String,
            enum: ['ai', 'rfid', 'qr', 'manual'],
            default: 'manual',
        },
        exitMethod: {
            type: String,
            enum: ['ai', 'rfid', 'qr', 'manual', null],
            default: null,
        },
        isVisitor: {
            type: Boolean,
            default: false,
        },
        feeAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'paid', 'waived'],
            default: 'unpaid',
        },
        status: {
            type: String,
            enum: ['in_progress', 'completed', 'cancelled'],
            default: 'in_progress',
        },
        notes: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
        collection: 'parking_sessions',
    }
)

parkingSessionSchema.index({ sessionCode: 1 }, { unique: true })
parkingSessionSchema.index({ licensePlate: 1, status: 1 })
parkingSessionSchema.index({ userId: 1, entryAt: -1 })
parkingSessionSchema.index({ status: 1, entryAt: -1 })

const ParkingSession = mongoose.model('ParkingSession', parkingSessionSchema)

export default ParkingSession
