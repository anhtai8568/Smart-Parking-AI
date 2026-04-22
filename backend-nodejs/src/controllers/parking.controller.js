import ParkingSession from '../../models/parkingsession.js'
import User from '../../models/user.js'

export async function getParkingHistory(req, res) {
    try {
        const { username, userId, status, limit = 50 } = req.query

        let resolvedUserId = userId || null

        if (!resolvedUserId && username) {
            const user = await User.findOne({ username: username.toLowerCase().trim() })
            if (!user) {
                return res.json({ status: 'success', data: [] })
            }
            resolvedUserId = user._id
        }

        const query = {}
        if (resolvedUserId) {
            query.userId = resolvedUserId
        }
        if (status) {
            query.status = status
        }

        const sessions = await ParkingSession.find(query)
            .sort({ entryAt: -1 })
            .limit(Math.min(Number(limit) || 50, 500))

        return res.json({
            status: 'success',
            data: sessions,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}
