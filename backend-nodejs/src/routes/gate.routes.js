import { Router } from 'express'
import { openBarrier, closeBarrier, reprocessSwipe, plateReady, getSessionsStatus } from '../controllers/gate.controller.js'

const router = Router()

router.post('/open',         openBarrier)
router.post('/close',        closeBarrier)
router.post('/reprocess',    reprocessSwipe)
router.post('/plate-ready',  plateReady)
router.get('/sessions',      getSessionsStatus)   // debug endpoint

export default router
