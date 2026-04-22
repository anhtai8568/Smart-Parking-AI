import Vehicle from '../../models/vehicle.js'

export async function listVehicles(req, res) {
    try {
        const { plate, status, limit = 100 } = req.query

        const query = {}
        if (status) {
            query.status = status
        }
        if (plate) {
            query.licensePlate = { $regex: plate.trim(), $options: 'i' }
        }

        const vehicles = await Vehicle.find(query)
            .sort({ updatedAt: -1 })
            .limit(Math.min(Number(limit) || 100, 500))
            .populate('userId', 'fullName username phone')

        return res.json({
            status: 'success',
            data: vehicles,
        })
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
        })
    }
}
