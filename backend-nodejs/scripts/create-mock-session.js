import dotenv from 'dotenv'
import dns from 'dns'
import { connectDatabase } from '../src/config/database.js'
import ParkingSession from '../models/parkingsession.js'

dotenv.config()
dns.setServers(['8.8.8.8', '8.8.4.4'])

async function run() {
    await connectDatabase()

    // Delete existing mock session if any
    await ParkingSession.deleteMany({ sessionCode: 'PS-IN-MOCK-12345' })

    await ParkingSession.create({
        sessionCode: 'PS-IN-MOCK-12345',
        licensePlate: '30A99999',
        vehicleType: 'car',
        entryAt: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'in_progress',
        rfid: '2E5A6403',
        isVisitor: true,
        feeAmount: 0,
        paymentStatus: 'unpaid',
        notes: 'Mock entry session for testing'
    })

    console.log('Mock parking session for RFID 2E5A6403 created successfully!')
    process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
