import mongoose from 'mongoose'

const vehicleSchema = new mongoose.Schema(
    {
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
        brand: {
            type: String,
            trim: true,
            default: '',
        },
        color: {
            type: String,
            trim: true,
            default: '',
        },
        isVisitor: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    {
        timestamps: true,
        collection: 'vehicles',
    }
)

vehicleSchema.index({ licensePlate: 1 }, { unique: true })
vehicleSchema.index({ userId: 1, status: 1 })

const Vehicle = mongoose.model('Vehicle', vehicleSchema)

export default Vehicle
