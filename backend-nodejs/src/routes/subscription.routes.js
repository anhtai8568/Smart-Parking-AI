import { Router } from 'express'
import {
    approveSubscription,
    cancelUnpaidSubscription,
    createSubscription,
    createRenewalPayment,
    listMySubscriptions,
    listSubscriptions,
    rejectSubscription,
} from '../controllers/subscription.controller.js'

const router = Router()

router.get('/', listSubscriptions)
router.get('/me', listMySubscriptions)
router.post('/', createSubscription)
router.post('/:id/renew', createRenewalPayment)
router.patch('/:id/approve', approveSubscription)
router.patch('/:id/reject', rejectSubscription)
router.delete('/:id/cancel-unpaid', cancelUnpaidSubscription)

export default router
