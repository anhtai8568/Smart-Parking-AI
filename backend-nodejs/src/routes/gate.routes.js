import { Router } from 'express'
import { openBarrier, closeBarrier, reprocessSwipe } from '../controllers/gate.controller.js'

const router = Router()

router.post('/open', openBarrier)
router.post('/close', closeBarrier)
router.post('/reprocess', reprocessSwipe)

export default router
