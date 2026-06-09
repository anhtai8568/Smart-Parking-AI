import { Router } from 'express'
import { openBarrier, closeBarrier, reprocessSwipe, plateReady, getSessionsStatus, getLatestRfid } from '../controllers/gate.controller.js'

const router = Router()

router.post('/open',         openBarrier)
router.post('/close',        closeBarrier)
router.post('/reprocess',    reprocessSwipe)
router.post('/plate-ready',  plateReady)
router.get('/sessions',      getSessionsStatus)   // debug endpoint
router.get('/latest-rfid',   getLatestRfid)       // endpoint for auto-detecting card registration

export default router
