import bcrypt from 'bcryptjs'
import User from '../../models/user.js'

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
