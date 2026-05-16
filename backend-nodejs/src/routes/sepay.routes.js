import { Router } from 'express'
import { handleSePayWebhook } from '../controllers/sepay.controller.js'

const router = Router()

router.post('/webhook', handleSePayWebhook)

export default router
