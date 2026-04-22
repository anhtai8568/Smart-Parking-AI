import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['admin', 'user'],
            default: 'user',
            required: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
            default: null,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'blocked'],
            default: 'active',
        },
        walletBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        defaultVehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'users',
    }
)

userSchema.index({ username: 1 }, { unique: true })
userSchema.index({ phone: 1 }, { unique: true, sparse: true })
userSchema.index({ email: 1 }, { unique: true, sparse: true })
userSchema.index({ role: 1, status: 1 })

const User = mongoose.model('User', userSchema)

export default User
