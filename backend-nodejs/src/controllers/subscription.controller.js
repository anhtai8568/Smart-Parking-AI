import PricingPolicy from '../../models/pricingpolicy.js'
import User from '../../models/user.js'
import UserPackage from '../../models/userpackage.js'
import Vehicle from '../../models/vehicle.js'

const VEHICLE_TYPES = ['car', 'motorbike']
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'sepay']
const SEPAY_ACCOUNT = process.env.SEPAY_ACCOUNT || ''
const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || ''
const SEPAY_QR_BASE_URL = process.env.SEPAY_QR_BASE_URL || 'https://qr.sepay.vn/img'
const SEPAY_QR_TEMPLATE = process.env.SEPAY_QR_TEMPLATE || ''
const SEPAY_PAYMENT_PREFIX = (process.env.SEPAY_PAYMENT_PREFIX || 'DH').toUpperCase()
const SEPAY_PAYMENT_CODE_MIN = Number(process.env.SEPAY_PAYMENT_CODE_MIN || 6)
const SEPAY_PAYMENT_CODE_MAX = Number(process.env.SEPAY_PAYMENT_CODE_MAX || 8)
const RENEWAL_WINDOW_DAYS = Number(process.env.RENEWAL_WINDOW_DAYS || 30)

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

function isSepayConfigured() {
    return Boolean(SEPAY_ACCOUNT && SEPAY_BANK_CODE)
}

function buildVietQrUrl({ amount, code }) {
    const params = new URLSearchParams()
    params.set('acc', SEPAY_ACCOUNT)
    if (SEPAY_BANK_CODE) {
        params.set('bank', SEPAY_BANK_CODE)
    }
    if (amount) {
        params.set('amount', String(amount))
    }
    if (code) {
        params.set('des', code)
    }
    if (SEPAY_QR_TEMPLATE) {
        params.set('template', SEPAY_QR_TEMPLATE)
    }

    return `${SEPAY_QR_BASE_URL}?${params.toString()}`
}

function clampPaymentCodeLength() {
    const min = Number.isFinite(SEPAY_PAYMENT_CODE_MIN) ? SEPAY_PAYMENT_CODE_MIN : 6
    const max = Number.isFinite(SEPAY_PAYMENT_CODE_MAX) ? SEPAY_PAYMENT_CODE_MAX : min
    if (min >= max) return min
    return min + Math.floor(Math.random() * (max - min + 1))
}

function generatePaymentCode() {
    const length = clampPaymentCodeLength()
    let digits = ''
    for (let i = 0; i < length; i += 1) {
        digits += Math.floor(Math.random() * 10).toString()
    }
    return `${SEPAY_PAYMENT_PREFIX}${digits}`
}

async function generateUniquePaymentCode() {
    for (let i = 0; i < 6; i += 1) {
        const code = generatePaymentCode()
        const existing = await UserPackage.findOne({
            $or: [{ paymentCode: code }, { 'renewal.code': code }],
        })
        if (!existing) {
            return code
        }
    }

    throw new Error('Failed to generate payment code')
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
        const shouldUseSepay = method === 'sepay'
        if (shouldUseSepay && !isSepayConfigured()) {
            return res.status(500).json({
                status: 'error',
                message: 'SePay is not configured',
            })
        }

        const paymentCode = shouldUseSepay ? await generateUniquePaymentCode() : null
        const paymentQrUrl = shouldUseSepay
            ? buildVietQrUrl({ amount: totalAmount, code: paymentCode })
            : null

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
            paymentCode: paymentCode || null,
            paymentProvider: shouldUseSepay ? 'sepay' : null,
            paymentQrUrl: paymentQrUrl || null,
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

        const response = {
            status: 'success',
            data: subscription,
        }

        if (shouldUseSepay) {
            response.payment = {
                method: 'sepay',
                code: paymentCode,
                amount: totalAmount,
                qrUrl: paymentQrUrl,
                bank: SEPAY_BANK_CODE,
                account: SEPAY_ACCOUNT,
            }
        }

        return res.status(201).json(response)
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

        const method = subscription.paymentMethod === 'sepay'
            ? 'sepay'
            : PAYMENT_METHODS.includes(paymentMethod)
                ? paymentMethod
                : subscription.paymentMethod

        if (subscription.paymentMethod === 'sepay' && subscription.paymentStatus !== 'paid') {
            return res.status(400).json({
                status: 'error',
                message: 'Chưa nhận được thanh toán SePay, không thể duyệt',
            })
        }

        subscription.status = 'active'
        if (subscription.paymentStatus !== 'paid') {
            subscription.paymentStatus = 'paid'
        }
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

export async function createRenewalPayment(req, res) {
    try {
        const { id } = req.params
        const { userId, username, months, paymentMethod } = req.body

        const renewalMonths = parseMonths(months)
        if (!renewalMonths) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid months',
            })
        }

        const user = await resolveUser({ userId, username })
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'User is required',
            })
        }

        const subscription = await UserPackage.findById(id)
        if (!subscription) {
            return res.status(404).json({
                status: 'error',
                message: 'Subscription not found',
            })
        }

        if (subscription.userId.toString() !== user._id.toString()) {
            return res.status(403).json({
                status: 'error',
                message: 'Not allowed to renew this subscription',
            })
        }

        if (!['active', 'expired'].includes(subscription.status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Subscription is not eligible for renewal',
            })
        }

        if (subscription.renewal?.code && !subscription.renewal?.paidAt) {
            return res.status(409).json({
                status: 'error',
                message: 'A renewal request is already pending',
            })
        }

        const endDate = subscription.endDate ? new Date(subscription.endDate) : null
        if (subscription.status === 'active' && endDate) {
            const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            if (daysLeft > RENEWAL_WINDOW_DAYS) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Renewal is only available within 30 days of expiry',
                })
            }
        }

        const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'sepay'
        if (method !== 'sepay') {
            return res.status(400).json({
                status: 'error',
                message: 'Renewal only supports SePay payments',
            })
        }

        if (!isSepayConfigured()) {
            return res.status(500).json({
                status: 'error',
                message: 'SePay is not configured',
            })
        }

        const vehicleType = await resolvePackageVehicleType(subscription)
        if (!vehicleType) {
            return res.status(400).json({
                status: 'error',
                message: 'Vehicle type is required for renewal',
            })
        }

        const activePolicy = await PricingPolicy.findOne({ isActive: true }).sort({ effectiveFrom: -1 })
        if (!activePolicy) {
            return res.status(400).json({
                status: 'error',
                message: 'Pricing policy is not configured',
            })
        }

        const pricePerMonth = vehicleType === 'motorbike'
            ? activePolicy.monthlyPriceMotorbike
            : activePolicy.monthlyPriceCar
        const totalAmount = pricePerMonth * renewalMonths

        const paymentCode = await generateUniquePaymentCode()
        const paymentQrUrl = buildVietQrUrl({ amount: totalAmount, code: paymentCode })

        subscription.renewal = {
            code: paymentCode,
            months: renewalMonths,
            amount: totalAmount,
            requestedAt: new Date(),
            paidAt: null,
        }

        await subscription.save()

        return res.status(201).json({
            status: 'success',
            data: subscription,
            payment: {
                method: 'sepay',
                code: paymentCode,
                amount: totalAmount,
                qrUrl: paymentQrUrl,
                bank: SEPAY_BANK_CODE,
                account: SEPAY_ACCOUNT,
            },
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function cancelUnpaidSubscription(req, res) {
    try {
        const { id } = req.params
        const { userId, username } = req.body

        const user = await resolveUser({ userId, username })
        if (!user) {
            return res.status(400).json({ status: 'error', message: 'User is required' })
        }

        const subscription = await UserPackage.findById(id)
        if (!subscription) {
            return res.status(404).json({ status: 'error', message: 'Subscription not found' })
        }

        if (subscription.userId.toString() !== user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Not allowed' })
        }

        if (subscription.paymentStatus === 'paid') {
            return res.status(400).json({ status: 'error', message: 'Không thể hủy đơn đã thanh toán' })
        }

        if (subscription.status !== 'pending') {
            return res.status(400).json({ status: 'error', message: 'Chỉ hủy được đơn đang chờ duyệt' })
        }

        subscription.status = 'cancelled'
        await subscription.save()

        return res.json({ status: 'success' })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message })
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
