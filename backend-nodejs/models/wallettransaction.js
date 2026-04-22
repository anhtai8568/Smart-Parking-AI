import mongoose from 'mongoose'

const walletTransactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ParkingSession',
            default: null,
        },
        type: {
            type: String,
            enum: ['topup', 'parking_fee', 'monthly_package', 'adjustment'],
            required: true,
        },
        direction: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        method: {
            type: String,
            enum: ['cash', 'bank_transfer', 'ewallet', 'system'],
            default: 'system',
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed'],
            default: 'success',
        },
        description: {
            type: String,
            default: '',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'wallet_transactions',
    }
)

walletTransactionSchema.index({ userId: 1, createdAt: -1 })
walletTransactionSchema.index({ sessionId: 1 })
walletTransactionSchema.index({ type: 1, status: 1 })

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)

export default WalletTransaction
