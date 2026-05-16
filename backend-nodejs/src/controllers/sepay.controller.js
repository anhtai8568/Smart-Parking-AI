import crypto from 'crypto'
import UserPackage from '../../models/userpackage.js'
import WalletTransaction from '../../models/wallettransaction.js'

const SEPAY_WEBHOOK_SECRET = process.env.SEPAY_WEBHOOK_SECRET || ''
const SEPAY_WEBHOOK_API_KEY = process.env.SEPAY_WEBHOOK_API_KEY || ''
const SEPAY_WEBHOOK_AUTH_MODE = (process.env.SEPAY_WEBHOOK_AUTH_MODE || '').toLowerCase()

function addMonths(date, months) {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
}

function respondSuccess(res) {
    return res.status(200).json({ success: true })
}

function shouldUseHmac() {
    if (SEPAY_WEBHOOK_AUTH_MODE) {
        return SEPAY_WEBHOOK_AUTH_MODE === 'hmac'
    }
    return Boolean(SEPAY_WEBHOOK_SECRET)
}

function shouldUseApiKey() {
    if (SEPAY_WEBHOOK_AUTH_MODE) {
        return SEPAY_WEBHOOK_AUTH_MODE === 'apikey'
    }
    return Boolean(SEPAY_WEBHOOK_API_KEY)
}

function verifyApiKey(req) {
    if (!SEPAY_WEBHOOK_API_KEY) {
        return false
    }

    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Apikey ')) {
        return false
    }

    const provided = authHeader.slice(7).trim()
    if (provided.length !== SEPAY_WEBHOOK_API_KEY.length) {
        return false
    }

    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(SEPAY_WEBHOOK_API_KEY))
}

function verifyHmac(req) {
    if (!SEPAY_WEBHOOK_SECRET) {
        return false
    }

    const signature = req.headers['x-sepay-signature']
    const timestamp = Number(req.headers['x-sepay-timestamp'])
    if (!signature || !Number.isFinite(timestamp)) {
        return false
    }

    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > 300) {
        return false
    }

    const rawBody = req.rawBody || ''
    const payload = `${timestamp}.${rawBody}`
    const digest = crypto.createHmac('sha256', SEPAY_WEBHOOK_SECRET).update(payload).digest('hex')
    const expected = `sha256=${digest}`

    if (expected.length !== signature.length) {
        return false
    }

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

function verifyWebhook(req) {
    if (shouldUseHmac()) {
        return verifyHmac(req)
    }

    if (shouldUseApiKey()) {
        return verifyApiKey(req)
    }

    return true
}

async function createWalletTransaction({ subscription, amount, code, transactionId, referenceCode, description }) {
    await WalletTransaction.create({
        userId: subscription.userId,
        packageId: subscription._id,
        type: 'monthly_package',
        direction: 'credit',
        amount,
        method: 'sepay',
        status: 'success',
        description,
        provider: 'sepay',
        providerTransactionId: transactionId || null,
        paymentCode: code || null,
        createdBy: null,
        referenceCode: referenceCode || null,
    })
}

export async function handleSePayWebhook(req, res) {
    try {
        if (!verifyWebhook(req)) {
            return res.status(401).json({ success: false })
        }

        const payload = req.body || {}
        if (payload.transferType !== 'in') {
            return respondSuccess(res)
        }

        const code = typeof payload.code === 'string' ? payload.code.trim() : ''
        if (!code) {
            return respondSuccess(res)
        }

        const amount = Number(payload.transferAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            return respondSuccess(res)
        }

        const transactionId = payload.id ? String(payload.id) : null
        if (transactionId) {
            const existing = await WalletTransaction.findOne({
                provider: 'sepay',
                providerTransactionId: transactionId,
            })
            if (existing) {
                return respondSuccess(res)
            }
        }

        let subscription = await UserPackage.findOne({ paymentCode: code })
        let isRenewal = false
        if (!subscription) {
            subscription = await UserPackage.findOne({ 'renewal.code': code })
            isRenewal = Boolean(subscription)
        }

        if (!subscription) {
            return respondSuccess(res)
        }

        if (isRenewal) {
            const renewalMonths = Number(subscription.renewal?.months || 0)
            const expectedAmount = Number(subscription.renewal?.amount || 0)

            if (subscription.renewal?.paidAt) {
                return respondSuccess(res)
            }

            if (expectedAmount && amount !== expectedAmount) {
                return respondSuccess(res)
            }

            if (!renewalMonths) {
                return respondSuccess(res)
            }

            const baseDate = subscription.endDate ? new Date(subscription.endDate) : new Date()
            const newEndDate = addMonths(baseDate, renewalMonths)

            subscription.endDate = newEndDate
            subscription.status = 'active'
            subscription.renewal.paidAt = new Date()

            await subscription.save()

            await createWalletTransaction({
                subscription,
                amount,
                code,
                transactionId,
                referenceCode: payload.referenceCode,
                description: `SePay renewal ${code}`,
            })

            return respondSuccess(res)
        }

        const expectedAmount = Number(subscription.totalAmount || 0)
        if (subscription.paymentStatus === 'paid') {
            return respondSuccess(res)
        }

        if (expectedAmount && amount !== expectedAmount) {
            return respondSuccess(res)
        }

        subscription.paymentStatus = 'paid'
        subscription.paymentProvider = 'sepay'
        subscription.paymentTransactionId = transactionId
        subscription.paymentReference = payload.referenceCode || null
        subscription.paymentReceivedAt = new Date()

        await subscription.save()

        await createWalletTransaction({
            subscription,
            amount,
            code,
            transactionId,
            referenceCode: payload.referenceCode,
            description: `SePay ${code}`,
        })

        return respondSuccess(res)
    } catch (error) {
        return res.status(500).json({ success: false })
    }
}
