import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import User from '../../models/user.js'
import { isMailerConfigured, sendMail } from '../utils/mailer.js'

function buildDemoToken(userId) {
    return `demo-${userId}-${Date.now()}`
}

function extractUserIdFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.slice(7)
    const parts = token.split('-')
    if (parts.length < 3 || parts[0] !== 'demo') {
        return null
    }

    return parts[1]
}

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15)
const RESET_TOKEN_TTL_MS = Number.isFinite(RESET_TOKEN_TTL_MINUTES)
    ? RESET_TOKEN_TTL_MINUTES * 60 * 1000
    : 15 * 60 * 1000
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173'

function buildResetToken() {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    return { token, tokenHash }
}

function buildResetUrl(token) {
    const normalizedBase = FRONTEND_BASE_URL.replace(/\/$/, '')
    return `${normalizedBase}/reset-password?token=${encodeURIComponent(token)}`
}

function buildResetEmail({ fullName, resetUrl }) {
    const displayName = fullName || 'ban'
    const subject = 'Dat lai mat khau Smart Parking AI'
    const text =
        `Xin chao ${displayName},\n\n` +
        `Ban vua yeu cau dat lai mat khau.\n` +
        `Vui long mo lien ket sau de tiep tuc: ${resetUrl}\n\n` +
        `Lien ket se het han sau ${Math.round(RESET_TOKEN_TTL_MS / 60000)} phut.\n` +
        `Neu ban khong yeu cau, hay bo qua email nay.\n`

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2>Dat lai mat khau Smart Parking AI</h2>
            <p>Xin chao <strong>${displayName}</strong>,</p>
            <p>Ban vua yeu cau dat lai mat khau. Bam vao nut duoi day de tiep tuc:</p>
            <p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
                    Dat lai mat khau
                </a>
            </p>
            <p>Hoac sao chep lien ket nay vao trinh duyet:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>Lien ket se het han sau ${Math.round(RESET_TOKEN_TTL_MS / 60000)} phut.</p>
            <p>Neu ban khong yeu cau, hay bo qua email nay.</p>
        </div>
    `

    return { subject, text, html }
}

export async function login(req, res) {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'username and password are required',
            })
        }

        const user = await User.findOne({ username: username.toLowerCase().trim() })

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials',
            })
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials',
            })
        }

        return res.json({
            status: 'success',
            data: {
                token: buildDemoToken(user._id.toString()),
                user: {
                    id: user._id,
                    username: user.username,
                    fullName: user.fullName,
                    role: user.role,
                },
            },
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function register(req, res) {
    try {
        const { username, password, fullName, email, phone } = req.body

        const normalizedUsername = typeof username === 'string' ? username.toLowerCase().trim() : ''
        const normalizedFullName = typeof fullName === 'string' ? fullName.trim() : ''
        const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
        const normalizedPhone = typeof phone === 'string' ? phone.trim() : ''

        if (!normalizedUsername || !normalizedFullName || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'username, fullName, and password are required',
            })
        }

        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters',
            })
        }

        const existingUser = await User.findOne({ username: normalizedUsername })
        if (existingUser) {
            return res.status(409).json({
                status: 'error',
                message: 'Username already exists',
            })
        }

        if (normalizedEmail) {
            const existingEmail = await User.findOne({ email: normalizedEmail })
            if (existingEmail) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Email already exists',
                })
            }
        }

        if (normalizedPhone) {
            const existingPhone = await User.findOne({ phone: normalizedPhone })
            if (existingPhone) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Phone number already exists',
                })
            }
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const user = await User.create({
            username: normalizedUsername,
            passwordHash,
            role: 'user',
            fullName: normalizedFullName,
            email: normalizedEmail || null,
            phone: normalizedPhone || null,
        })

        return res.status(201).json({
            status: 'success',
            data: {
                token: buildDemoToken(user._id.toString()),
                user: {
                    id: user._id,
                    username: user.username,
                    fullName: user.fullName,
                    role: user.role,
                },
            },
        })
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                status: 'error',
                message: 'User information already exists',
            })
        }

        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function forgotPassword(req, res) {
    try {
        const { username, email } = req.body

        const normalizedUsername = typeof username === 'string' ? username.toLowerCase().trim() : ''
        const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''

        if (!normalizedUsername && !normalizedEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'username or email is required',
            })
        }

        if (!isMailerConfigured()) {
            return res.status(500).json({
                status: 'error',
                message: 'SMTP is not configured',
            })
        }

        const query = []
        if (normalizedUsername) {
            query.push({ username: normalizedUsername })
        }
        if (normalizedEmail) {
            query.push({ email: normalizedEmail })
        }

        const user = await User.findOne(query.length > 1 ? { $or: query } : query[0])
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            })
        }

        if (!user.email) {
            return res.status(400).json({
                status: 'error',
                message: 'User does not have an email configured',
            })
        }

        const { token, tokenHash } = buildResetToken()
        user.resetPasswordTokenHash = tokenHash
        user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
        await user.save()

        const resetUrl = buildResetUrl(token)
        const { subject, text, html } = buildResetEmail({
            fullName: user.fullName,
            resetUrl,
        })

        await sendMail({
            to: user.email,
            subject,
            text,
            html,
        })

        return res.json({
            status: 'success',
            message: 'Reset link sent successfully',
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function resetPassword(req, res) {
    try {
        const { token, password } = req.body

        if (!token) {
            return res.status(400).json({
                status: 'error',
                message: 'reset token is required',
            })
        }

        if (!password) {
            return res.status(400).json({
                status: 'error',
                message: 'password is required',
            })
        }

        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters',
            })
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpiresAt: { $gt: new Date() },
        })
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'Reset token is invalid or expired',
            })
        }

        user.passwordHash = await bcrypt.hash(password, 10)
        user.resetPasswordTokenHash = null
        user.resetPasswordExpiresAt = null
        await user.save()

        return res.json({
            status: 'success',
            message: 'Password updated successfully',
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}

export async function me(req, res) {
    try {
        const userId = extractUserIdFromToken(req.headers.authorization)

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized',
            })
        }

        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            })
        }

        return res.json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    fullName: user.fullName,
                    role: user.role,
                },
            },
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}
