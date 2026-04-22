import User from '../../models/user.js'

export async function listUsers(req, res) {
    try {
        const { q = '', limit = 100 } = req.query

        const query = { role: 'user' }
        if (q.trim()) {
            query.$or = [
                { fullName: { $regex: q.trim(), $options: 'i' } },
                { username: { $regex: q.trim(), $options: 'i' } },
                { phone: { $regex: q.trim(), $options: 'i' } },
            ]
        }

        const users = await User.find(query)
            .sort({ updatedAt: -1 })
            .limit(Math.min(Number(limit) || 100, 500))
            .populate('defaultVehicleId', 'licensePlate')

        return res.json({
            status: 'success',
            data: users,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}
