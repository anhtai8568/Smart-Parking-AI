import { Router } from 'express'
import {
    approveSubscription,
    createSubscription,
    listMySubscriptions,
    listSubscriptions,
    rejectSubscription,
} from '../controllers/subscription.controller.js'

const router = Router()

router.get('/', listSubscriptions)
router.get('/me', listMySubscriptions)
router.post('/', createSubscription)
router.patch('/:id/approve', approveSubscription)
router.patch('/:id/reject', rejectSubscription)

export default router
