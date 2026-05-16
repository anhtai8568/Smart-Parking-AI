import mongoose from 'mongoose'

const userPackageSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            required: true,
        },
        vehicleType: {
            type: String,
            enum: ['car', 'motorbike'],
            default: null,
        },
        packageType: {
            type: String,
            enum: ['monthly'],
            default: 'monthly',
            required: true,
        },
        months: {
            type: Number,
            required: true,
            min: 1,
        },
        pricePerMonth: {
            type: Number,
            required: true,
            min: 0,
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank_transfer', 'sepay'],
            default: 'bank_transfer',
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'paid'],
            default: 'unpaid',
        },
        paymentCode: {
            type: String,
            default: null,
        },
        paymentProvider: {
            type: String,
            default: null,
        },
        paymentQrUrl: {
            type: String,
            default: null,
        },
        paymentTransactionId: {
            type: String,
            default: null,
        },
        paymentReference: {
            type: String,
            default: null,
        },
        paymentReceivedAt: {
            type: Date,
            default: null,
        },
        contactPhone: {
            type: String,
            default: '',
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'active', 'expired', 'cancelled', 'rejected'],
            default: 'pending',
        },
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },
        notes: {
            type: String,
            default: '',
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        renewal: {
            code: {
                type: String,
                default: null,
            },
            months: {
                type: Number,
                default: null,
            },
            amount: {
                type: Number,
                default: null,
            },
            requestedAt: {
                type: Date,
                default: null,
            },
            paidAt: {
                type: Date,
                default: null,
            },
        },
    },
    {
        timestamps: true,
        collection: 'user_packages',
    }
)

userPackageSchema.index({ userId: 1, status: 1 })
userPackageSchema.index({ userId: 1, vehicleType: 1, status: 1 })
userPackageSchema.index({ vehicleId: 1, status: 1 })
userPackageSchema.index({ endDate: 1 })
userPackageSchema.index({ paymentCode: 1 }, { unique: true, partialFilterExpression: { paymentCode: { $type: 'string' } } })
userPackageSchema.index({ 'renewal.code': 1 }, { unique: true, partialFilterExpression: { 'renewal.code': { $type: 'string' } } })

const UserPackage = mongoose.model('UserPackage', userPackageSchema)

export default UserPackage
