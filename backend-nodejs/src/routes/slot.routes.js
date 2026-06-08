import { Router } from 'express'
import { getSlots, resetSlots } from '../controllers/slot.controller.js'

const router = Router()

router.get('/', getSlots)
router.post('/reset', resetSlots)

export default router
