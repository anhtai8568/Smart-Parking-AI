import mongoose from 'mongoose'

const pricingPolicySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        monthlyPriceMotorbike: {
            type: Number,
            required: true,
            min: 0,
        },
        monthlyPriceCar: {
            type: Number,
            required: true,
            min: 0,
        },
        singlePriceMotorbike: {
            type: Number,
            required: true,
            min: 0,
        },
        singlePriceCar: {
            type: Number,
            required: true,
            min: 0,
        },
        effectiveFrom: {
            type: Date,
            required: true,
        },
        effectiveTo: {
            type: Date,
            default: null,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'pricing_policies',
    }
)

pricingPolicySchema.index({ isActive: 1, effectiveFrom: -1 })

const PricingPolicy = mongoose.model('PricingPolicy', pricingPolicySchema)

export default PricingPolicy
