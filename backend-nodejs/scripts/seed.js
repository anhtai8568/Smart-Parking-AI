import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { connectDatabase } from '../src/config/database.js'
import User from '../models/user.js'
import Vehicle from '../models/vehicle.js'
import ParkingSlot from '../models/parkingslot.js'
import ParkingSession from '../models/parkingsession.js'
import PricingPolicy from '../models/pricingpolicy.js'
import WalletTransaction from '../models/wallettransaction.js'

dotenv.config()

async function seed() {
    await connectDatabase()

    await Promise.all([
        User.deleteMany({}),
        Vehicle.deleteMany({}),
        ParkingSlot.deleteMany({}),
        ParkingSession.deleteMany({}),
        PricingPolicy.deleteMany({}),
        WalletTransaction.deleteMany({}),
    ])

    const passwordHash = await bcrypt.hash('123456', 10)

    const [admin, user1, user2] = await User.create([
        {
            username: 'admin',
            passwordHash,
            role: 'admin',
            fullName: 'Quan Tri',
            phone: '0900000001',
            email: 'admin@smartparking.local',
            walletBalance: 0,
        },
        {
            username: 'user1',
            passwordHash,
            role: 'user',
            fullName: 'Nguyen Van A',
            phone: '0912345678',
            email: 'user1@smartparking.local',
            walletBalance: 500000,
        },
        {
            username: 'user2',
            passwordHash,
            role: 'user',
            fullName: 'Tran Thi B',
            phone: '0987654321',
            email: 'user2@smartparking.local',
            walletBalance: 300000,
        },
    ])

    const [vehicle1, vehicle2, visitorVehicle] = await Vehicle.create([
        {
            userId: user1._id,
            licensePlate: '15A-12345',
            vehicleType: 'car',
            brand: 'Toyota',
            color: 'white',
            isVisitor: false,
            status: 'active',
        },
        {
            userId: user2._id,
            licensePlate: '16B-67890',
            vehicleType: 'motorbike',
            brand: 'Honda',
            color: 'black',
            isVisitor: false,
            status: 'active',
        },
        {
            userId: null,
            licensePlate: '29A-11122',
            vehicleType: 'car',
            brand: 'Kia',
            color: 'silver',
            isVisitor: true,
            status: 'active',
        },
    ])

    await User.updateOne({ _id: user1._id }, { defaultVehicleId: vehicle1._id })
    await User.updateOne({ _id: user2._id }, { defaultVehicleId: vehicle2._id })

    const [slot1, slot2, slot3] = await ParkingSlot.create([
        { code: 'S1', zone: 'A', slotType: 'car', status: 'available' },
        { code: 'S2', zone: 'A', slotType: 'mixed', status: 'occupied' },
        { code: 'S3', zone: 'A', slotType: 'motorbike', status: 'available' },
    ])

    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [session1, session2, session3] = await ParkingSession.create([
        {
            sessionCode: 'PS20260422-0001',
            vehicleId: vehicle1._id,
            userId: user1._id,
            licensePlate: vehicle1.licensePlate,
            vehicleType: vehicle1.vehicleType,
            entryAt: fiveHoursAgo,
            exitAt: oneHourAgo,
            durationMinutes: 240,
            entryMethod: 'ai',
            exitMethod: 'ai',
            isVisitor: false,
            feeAmount: 0,
            paymentStatus: 'waived',
            status: 'completed',
            notes: 'Monthly package user',
        },
        {
            sessionCode: 'PS20260422-0002',
            vehicleId: vehicle2._id,
            userId: user2._id,
            licensePlate: vehicle2.licensePlate,
            vehicleType: vehicle2.vehicleType,
            entryAt: twoHoursAgo,
            exitAt: null,
            durationMinutes: null,
            entryMethod: 'rfid',
            exitMethod: null,
            isVisitor: false,
            feeAmount: 0,
            paymentStatus: 'unpaid',
            status: 'in_progress',
        },
        {
            sessionCode: 'PS20260422-0003',
            vehicleId: visitorVehicle._id,
            userId: null,
            licensePlate: visitorVehicle.licensePlate,
            vehicleType: visitorVehicle.vehicleType,
            entryAt: new Date(now.getTime() - 90 * 60 * 1000),
            exitAt: new Date(now.getTime() - 20 * 60 * 1000),
            durationMinutes: 70,
            entryMethod: 'ai',
            exitMethod: 'manual',
            isVisitor: true,
            feeAmount: 30000,
            paymentStatus: 'paid',
            status: 'completed',
        },
    ])

    await ParkingSlot.updateOne(
        { _id: slot2._id },
        { currentSessionId: session2._id, lastOccupiedAt: session2.entryAt }
    )

    await PricingPolicy.create({
        name: 'standard-2026',
        isActive: true,
        monthlyPriceMotorbike: 300000,
        monthlyPriceCar: 700000,
        singlePriceMotorbike: 5000,
        singlePriceCar: 20000,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        updatedBy: admin._id,
    })

    await WalletTransaction.create([
        {
            userId: user1._id,
            type: 'topup',
            direction: 'credit',
            amount: 200000,
            method: 'cash',
            status: 'success',
            description: 'Topup tai quay',
            createdBy: admin._id,
        },
        {
            userId: user2._id,
            sessionId: session3._id,
            type: 'parking_fee',
            direction: 'debit',
            amount: 30000,
            method: 'cash',
            status: 'success',
            description: 'Phi gui xe vang lai',
            createdBy: admin._id,
        },
    ])

    console.log('Seed completed successfully')
    process.exit(0)
}

seed().catch((error) => {
    console.error('Seed failed:', error.message)
    process.exit(1)
})
