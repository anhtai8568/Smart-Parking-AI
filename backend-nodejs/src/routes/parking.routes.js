import { Router } from 'express'
import { getParkingHistory } from '../controllers/parking.controller.js'

const router = Router()

router.get('/', getParkingHistory)

export default router
