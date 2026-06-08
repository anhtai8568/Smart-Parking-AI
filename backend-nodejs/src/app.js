import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes.js'
import vehicleRoutes from './routes/vehicle.routes.js'
import parkingRoutes from './routes/parking.routes.js'
import userRoutes from './routes/user.routes.js'
import pricingRoutes from './routes/pricing.routes.js'
import subscriptionRoutes from './routes/subscription.routes.js'
import sepayRoutes from './routes/sepay.routes.js'
import gateRoutes from './routes/gate.routes.js'
import slotRoutes from './routes/slot.routes.js'

const app = express()

app.use(cors())
app.use(express.json({
    verify: (req, _res, buf) => {
        if (req.originalUrl && req.originalUrl.startsWith('/api/sepay/webhook')) {
            req.rawBody = buf.toString()
        }
    },
}))

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
app.use('/api/pricing', pricingRoutes)
app.use('/api/sepay', sepayRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/users', userRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/parking-history', parkingRoutes)
app.use('/api/gate', gateRoutes)
app.use('/api/slots', slotRoutes)

export default app
