import PricingPolicy from '../../models/pricingpolicy.js'
import User from '../../models/user.js'
import UserPackage from '../../models/userpackage.js'
import Vehicle from '../../models/vehicle.js'

const VEHICLE_TYPES = ['car', 'motorbike']
const PAYMENT_METHODS = ['cash', 'bank_transfer']

function parseMonths(value) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) {
        return null
    }
    return Math.floor(parsed)
}

function addMonths(date, months) {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
}

async function resolveUser({ userId, username }) {
    if (userId) {
        return User.findById(userId)
    }

    if (username) {
        return User.findOne({ username: username.toLowerCase().trim() })
    }

    return null
}

async function resolveVehicle({ vehicleId, licensePlate, vehicleType, brand, color, userId }) {
    if (vehicleId) {
        return Vehicle.findById(vehicleId)
    }

    const plate = typeof licensePlate === 'string' ? licensePlate.trim().toUpperCase() : ''
    if (!plate || !vehicleType) {
        return null
    }

    const existing = await Vehicle.findOne({ licensePlate: plate })
    if (existing) {
        if (existing.userId && userId && existing.userId.toString() !== userId.toString()) {
            throw new Error('Vehicle is already assigned to another user')
        }
        if (!existing.userId && userId) {
            existing.userId = userId
            await existing.save()
        }
        return existing
    }

    return Vehicle.create({
        userId,
        licensePlate: plate,
        vehicleType,
        brand: brand || '',
        color: color || '',
        isVisitor: false,
        status: 'active',
    })
}

async function resolvePackageVehicleType(subscription) {
    if (subscription.vehicleType) {
        return subscription.vehicleType
    }

    if (!subscription.vehicleId) {
        return null
    }

    const vehicle = await Vehicle.findById(subscription.vehicleId)
    return vehicle?.vehicleType || null
}

async function hasPackageForType(userId, vehicleType, statuses, excludeId = null) {
    if (!userId || !vehicleType) {
        return false
    }

    const query = { userId, status: { $in: statuses } }
    if (excludeId) {
        query._id = { $ne: excludeId }
    }

    const packages = await UserPackage.find(query).populate('vehicleId', 'vehicleType')

    return packages.some((item) => {
        const itemType = item.vehicleType || item.vehicleId?.vehicleType
        return itemType === vehicleType
    })
}

export async function createSubscription(req, res) {
    try {
        const { userId, username, vehicleId, licensePlate, vehicleType, brand, color, paymentMethod, phone } = req.body

        const normalizedPhone = typeof phone === 'string' ? phone.trim() : ''

        const user = await resolveUser({ userId, username })
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'User is required',
            })
        }

        if (!normalizedPhone) {
            return res.status(400).json({
                status: 'error',
                message: 'Phone number is required',
            })
        }

        const resolvedVehicleType = vehicleType || null
        if (resolvedVehicleType && !VEHICLE_TYPES.includes(resolvedVehicleType)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid vehicle type',
            })
        }

        const months = parseMonths(req.body.months)
        if (!months) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid months',
            })
        }

        const activePolicy = await PricingPolicy.findOne({ isActive: true }).sort({ effectiveFrom: -1 })
        if (!activePolicy) {
            return res.status(400).json({
                status: 'error',
                message: 'Pricing policy is not configured',
            })
        }

        const vehicle = await resolveVehicle({
            vehicleId,
            licensePlate,
            vehicleType: resolvedVehicleType,
            brand,
            color,
            userId: user._id,
        })

        if (!vehicle) {
            return res.status(400).json({
                status: 'error',
                message: 'Vehicle information is required',
            })
        }

        const actualVehicleType = vehicle.vehicleType
        if (!VEHICLE_TYPES.includes(actualVehicleType)) {
            return res.status(400).json({
                status: 'error',
                message: 'Unsupported vehicle type',
            })
        }

        const existingActive = await UserPackage.findOne({
            vehicleId: vehicle._id,
            status: 'active',
        })
        if (existingActive) {
            return res.status(409).json({
                status: 'error',
                message: 'Vehicle already has an active monthly package',
            })
        }

        const existingPending = await UserPackage.findOne({
            vehicleId: vehicle._id,
            status: 'pending',
        })
        if (existingPending) {
            return res.status(409).json({
                status: 'error',
                message: 'Vehicle already has a pending request',
            })
        }

        const hasExistingType = await hasPackageForType(user._id, actualVehicleType, ['pending', 'active'])
        if (hasExistingType) {
            return res.status(409).json({
                status: 'error',
                message: 'User already has a monthly package for this vehicle type',
            })
        }

        const pricePerMonth = actualVehicleType === 'motorbike'
            ? activePolicy.monthlyPriceMotorbike
            : activePolicy.monthlyPriceCar
        const totalAmount = pricePerMonth * months

        const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'bank_transfer'

        const subscription = await UserPackage.create({
            userId: user._id,
            vehicleId: vehicle._id,
            vehicleType: actualVehicleType,
            packageType: 'monthly',
            months,
            pricePerMonth,
            totalAmount,
            paymentMethod: method,
            paymentStatus: 'unpaid',
            contactPhone: normalizedPhone,
            status: 'pending',
            startDate: null,
            endDate: null,
        })

        if (!user.defaultVehicleId) {
            user.defaultVehicleId = vehicle._id
        }

        if (!user.phone) {
            const existingPhone = await User.findOne({
                phone: normalizedPhone,
                _id: { $ne: user._id },
            })
            if (!existingPhone) {
                user.phone = normalizedPhone
            }
        }

        if (user.isModified()) {
            await user.save()
        }

        return res.status(201).json({
            status: 'success',
            data: subscription,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function listSubscriptions(req, res) {
    try {
        const { status, limit = 100 } = req.query
        const query = {}
        if (status) {
            query.status = status
        }

        const items = await UserPackage.find(query)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit) || 100, 300))
            .populate('userId', 'fullName username phone')
            .populate('vehicleId', 'licensePlate vehicleType')

        return res.json({
            status: 'success',
            data: items,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function listMySubscriptions(req, res) {
    try {
        const { userId, username, status, limit = 50 } = req.query

        const user = await resolveUser({ userId, username })
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'User is required',
            })
        }

        const query = { userId: user._id }
        if (status) {
            query.status = status
        }

        const items = await UserPackage.find(query)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit) || 50, 200))
            .populate('vehicleId', 'licensePlate vehicleType brand color')

        return res.json({
            status: 'success',
            data: items,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function approveSubscription(req, res) {
    try {
        const { id } = req.params
        const { paymentMethod, startDate } = req.body

        const subscription = await UserPackage.findById(id)
        if (!subscription) {
            return res.status(404).json({
                status: 'error',
                message: 'Subscription not found',
            })
        }

        const subscriptionVehicleType = await resolvePackageVehicleType(subscription)
        if (!subscriptionVehicleType) {
            return res.status(400).json({
                status: 'error',
                message: 'Vehicle type is required for approval',
            })
        }

        if (subscription.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: 'Only pending subscriptions can be approved',
            })
        }

        const activeExisting = await UserPackage.findOne({
            vehicleId: subscription.vehicleId,
            status: 'active',
        })
        if (activeExisting) {
            return res.status(409).json({
                status: 'error',
                message: 'Vehicle already has an active package',
            })
        }

        const hasSameTypeActive = await hasPackageForType(
            subscription.userId,
            subscriptionVehicleType,
            ['active'],
            subscription._id
        )
        if (hasSameTypeActive) {
            return res.status(409).json({
                status: 'error',
                message: 'User already has an active package for this vehicle type',
            })
        }

        const start = startDate ? new Date(startDate) : new Date()
        const end = addMonths(start, subscription.months)

        const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : subscription.paymentMethod

        subscription.status = 'active'
        subscription.paymentStatus = 'paid'
        subscription.paymentMethod = method
        subscription.startDate = start
        subscription.endDate = end
        subscription.vehicleType = subscriptionVehicleType

        await subscription.save()

        return res.json({
            status: 'success',
            data: subscription,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function rejectSubscription(req, res) {
    try {
        const { id } = req.params
        const { reason } = req.body

        const subscription = await UserPackage.findById(id)
        if (!subscription) {
            return res.status(404).json({
                status: 'error',
                message: 'Subscription not found',
            })
        }

        if (subscription.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: 'Only pending subscriptions can be rejected',
            })
        }

        subscription.status = 'rejected'
        subscription.notes = reason ? String(reason).trim() : ''

        await subscription.save()

        return res.json({
            status: 'success',
            data: subscription,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}
