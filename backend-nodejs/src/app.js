import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes.js'
import vehicleRoutes from './routes/vehicle.routes.js'
import parkingRoutes from './routes/parking.routes.js'
import userRoutes from './routes/user.routes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'Smart Parking backend is running',
        endpoints: {
            health: '/api/health',
            login: 'POST /api/auth/login',
            users: 'GET /api/users',
            vehicles: 'GET /api/vehicles',
            parkingHistory: 'GET /api/parking-history',
        },
    })
})

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Smart Parking backend is running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/parking-history', parkingRoutes)

export default app
