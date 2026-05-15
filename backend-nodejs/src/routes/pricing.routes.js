import { Router } from 'express'
import { getActivePricing, updatePricing } from '../controllers/pricing.controller.js'

const router = Router()

router.get('/active', getActivePricing)
router.post('/', updatePricing)

export default router
