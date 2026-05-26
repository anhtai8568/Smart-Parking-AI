import { Router } from 'express'
import {
    approveSubscription,
    cancelUnpaidSubscription,
    createSubscription,
    createRenewalPayment,
    issueCard,
    listMySubscriptions,
    listPaymentHistory,
    listSubscriptions,
    rejectSubscription,
    updateSubscription,
} from '../controllers/subscription.controller.js'

const router = Router()

router.get('/', listSubscriptions)
router.get('/me', listMySubscriptions)
router.get('/payment-history', listPaymentHistory)
router.post('/', createSubscription)
router.post('/:id/renew', createRenewalPayment)
router.patch('/:id/approve', approveSubscription)
router.patch('/:id/issue-card', issueCard)
router.patch('/:id/reject', rejectSubscription)
router.patch('/:id', updateSubscription)
router.delete('/:id/cancel-unpaid', cancelUnpaidSubscription)

export default router
