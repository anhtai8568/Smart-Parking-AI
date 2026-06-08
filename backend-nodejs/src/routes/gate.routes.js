import { Router } from 'express'
import { openBarrier, closeBarrier } from '../controllers/gate.controller.js'

const router = Router()

router.post('/open', openBarrier)
router.post('/close', closeBarrier)

export default router
