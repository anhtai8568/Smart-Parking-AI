import crypto from 'crypto'
import UserPackage from '../../models/userpackage.js'
import WalletTransaction from '../../models/wallettransaction.js'
import Vehicle from '../../models/vehicle.js'
import User from '../../models/user.js'
import { isMailerConfigured, sendMail } from '../utils/mailer.js'

function getAprilTagIdFromLicensePlate(licensePlate) {
    const cleanPlate = licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (!cleanPlate) return 0
    const hash = crypto.createHash('md5').update(cleanPlate).digest('hex')
    const bigIntHash = BigInt('0x' + hash)
    return Number(bigIntHash % 587n)
}

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

        // ─── XỬ LÝ THANH TOÁN PHÍ ĐỖ XE VÃNG LAI QUA SEPAY ───
        const code = typeof payload.code === 'string' ? payload.code.trim() : ''
        const rawContent = typeof payload.content === 'string' ? payload.content.trim().toUpperCase() : ''
        
        let parkingRfid = null
        if (code.startsWith('DX')) {
            parkingRfid = code.slice(2).trim().toUpperCase()
        } else {
            const match = rawContent.match(/DX\s*([A-Z0-9]{4,20})/)
            if (match) {
                parkingRfid = match[1]
            }
        }

        if (parkingRfid) {
            const ParkingSession = (await import('../../models/parkingsession.js')).default
            const activeSession = await ParkingSession.findOne({
                rfid: parkingRfid,
                status: 'in_progress'
            })
            
            if (activeSession) {
                console.log(`[SePay Webhook] Phát hiện thanh toán phí đỗ xe cho thẻ RFID: ${parkingRfid}`)
                activeSession.exitAt          = new Date()
                activeSession.exitMethod      = 'qr'
                activeSession.status          = 'completed'
                activeSession.durationMinutes = Math.round((activeSession.exitAt - activeSession.entryAt) / 60000)
                activeSession.feeAmount       = amount
                activeSession.paymentStatus   = 'paid'
                activeSession.notes += ` | Thanh toán tự động qua SePay Webhook GD: ${transactionId || 'N/A'}`
                await activeSession.save()

                // Tạo WalletTransaction ghi nhận doanh thu phí đỗ xe (chỉ nếu có userId)
                if (activeSession.userId) {
                    await WalletTransaction.create({
                        userId: activeSession.userId,
                        type: 'parking_fee',
                        direction: 'debit',
                        amount: amount,
                        method: 'sepay',
                        status: 'success',
                        description: `Thanh toán phí đỗ xe RFID: ${parkingRfid}`,
                        provider: 'sepay',
                        providerTransactionId: transactionId || null,
                        paymentCode: `DX${parkingRfid}`,
                        referenceCode: payload.referenceCode || null,
                        sessionId: activeSession._id
                    })
                }

                // Gửi lệnh mở barrier qua MQTT
                const { getMQTTClient, getSessions, updateScanInfo } = await import('../config/mqtt.js')
                const mqttClient = getMQTTClient()
                if (mqttClient && mqttClient.connected) {
                    const cmd = `OPEN:${activeSession.licensePlate || 'XE_RA'}`
                    mqttClient.publish('parking/commands/gate', cmd)
                    console.log(`[SePay Webhook] Đã publish lệnh MỞ barrier qua MQTT cho xe: ${activeSession.licensePlate}`)
                }

                // Cập nhật trạng thái 'paid' lên AI server để dashboard của bảo vệ nhận biết ngay
                try {
                    await updateScanInfo('out', null, parkingRfid, activeSession.licensePlate, null, {
                        entryTime: activeSession.entryAt.toLocaleTimeString('vi-VN') + ' ' + activeSession.entryAt.toLocaleDateString('vi-VN'),
                        exitTime: activeSession.exitAt.toLocaleTimeString('vi-VN') + ' ' + activeSession.exitAt.toLocaleDateString('vi-VN'),
                        fee: amount,
                        paymentStatus: 'paid'
                    })
                } catch (updateErr) {
                    console.error('[SePay Webhook] Không thể cập nhật thông tin quét lên AI server:', updateErr.message)
                }

                // Reset in-memory session của cổng ra về idle để đóng phiên
                const sessions = getSessions()
                if (sessions && sessions.out) {
                    if (sessions.out.timer) clearTimeout(sessions.out.timer)
                    sessions.out.status = 'done'
                }

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

        // Tự động kích hoạt (active) cho xe ô tô dùng AprilTag
        if (subscription.vehicleType === 'car') {
            const start = new Date()
            const end = addMonths(start, subscription.months)
            subscription.status = 'active'
            subscription.startDate = start
            subscription.endDate = end
        }

        await subscription.save()

        // Nếu là xe ô tô vừa được kích hoạt, cập nhật Vehicle và gửi Email AprilTag
        if (subscription.vehicleType === 'car' && subscription.status === 'active') {
            try {
                const vehicle = await Vehicle.findById(subscription.vehicleId)
                if (vehicle) {
                    const aprilTagId = getAprilTagIdFromLicensePlate(vehicle.licensePlate)
                    vehicle.arucoId = aprilTagId
                    if (vehicle.userId && vehicle.userId.toString() !== subscription.userId.toString()) {
                        console.log(`[DISPUTE RESOLVED VIA SEPAY] Transferring vehicle ${vehicle.licensePlate} ownership from ${vehicle.userId} to ${subscription.userId}`)
                        vehicle.userId = subscription.userId
                    }
                    await vehicle.save()

                    // Gửi email thông báo tự động kích hoạt thành công
                    const user = await User.findById(subscription.userId)
                    if (user && user.email && isMailerConfigured()) {
                        const directDownloadUrl = `http://localhost:8000/api/aruco/generate/${encodeURIComponent(vehicle.licensePlate)}?size=500&label=true`
                        
                        await sendMail({
                            to: user.email,
                            subject: '[Smart Parking AI] Kích hoạt tự động vé tháng xe ô tô thành công',
                            text: `Chúc mừng! Vé tháng của bạn đã được thanh toán và kích hoạt tự động thành công cho xe ${vehicle.brand || ''} (Biển số: ${vehicle.licensePlate}).\nTải mã AprilTag của bạn tại: ${directDownloadUrl}`,
                            html: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                                    <h3 style="color: #16a34a;">✓ Thanh toán thành công & Vé tháng đã được kích hoạt!</h3>
                                    <p>Hệ thống ghi nhận giao dịch thành công qua SePay cho xe: <strong>${vehicle.brand || 'Xe ô tô'} - Biển số: ${vehicle.licensePlate}</strong></p>
                                    <p>Gói tháng của bạn đã hoạt động. Vui lòng tải mã nhận diện AprilTag dưới đây:</p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${directDownloadUrl}" style="display: inline-block; padding: 12px 28px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 10px rgba(22,163,74,0.3);">📥 TẢI VỀ MÃ APRILTAG</a>
                                    </div>
                                    <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
                                        In mã này ra dán trên kính lái xe hoặc xuất trình trên điện thoại khi đi qua cổng để camera AI tự động mở barrier.
                                    </p>
                                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Hệ thống Smart Parking AI</p>
                                </div>
                            `
                        })
                        console.log(`Automatic activation email sent to ${user.email} for vehicle ${vehicle.licensePlate}`)
                    }
                }
            } catch (err) {
                console.error('Failed to auto-activate AprilTag or send email on webhook:', err.message)
            }
        }

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
