import { Router } from 'express'
import { forgotPassword, login, me, register, resetPassword } from '../controllers/auth.controller.js'

const router = Router()

router.get('/login', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Use POST /api/auth/login with JSON body: { username, password }',
    })
})

router.post('/login', login)
router.post('/register', register)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.get('/me', me)

export default router
