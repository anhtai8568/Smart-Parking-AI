import PricingPolicy from '../../models/pricingpolicy.js'

function parsePrice(value) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null
    }
    return parsed
}

export async function getActivePricing(_req, res) {
    try {
        const policy = await PricingPolicy.findOne({ isActive: true }).sort({ effectiveFrom: -1 })
        if (!policy) {
            return res.status(404).json({
                status: 'error',
                message: 'No active pricing policy found',
            })
        }

        return res.json({
            status: 'success',
            data: policy,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function updatePricing(req, res) {
    try {
        const monthlyPriceMotorbike = parsePrice(req.body.monthlyPriceMotorbike)
        const monthlyPriceCar = parsePrice(req.body.monthlyPriceCar)
        const singlePriceMotorbike = parsePrice(req.body.singlePriceMotorbike)
        const singlePriceCar = parsePrice(req.body.singlePriceCar)

        if (
            monthlyPriceMotorbike === null ||
            monthlyPriceCar === null ||
            singlePriceMotorbike === null ||
            singlePriceCar === null
        ) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid pricing values',
            })
        }

        const now = new Date()
        const name = typeof req.body.name === 'string' && req.body.name.trim()
            ? req.body.name.trim()
            : `standard-${now.getFullYear()}`

        const current = await PricingPolicy.findOne({ isActive: true }).sort({ effectiveFrom: -1 })
        if (current) {
            current.isActive = false
            current.effectiveTo = now
            await current.save()
        }

        const policy = await PricingPolicy.create({
            name,
            isActive: true,
            monthlyPriceMotorbike,
            monthlyPriceCar,
            singlePriceMotorbike,
            singlePriceCar,
            effectiveFrom: now,
            updatedBy: null,
        })

        return res.json({
            status: 'success',
            data: policy,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}
