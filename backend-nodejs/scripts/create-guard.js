import dotenv from 'dotenv'
import dns from 'dns'
import bcrypt from 'bcryptjs'
import { connectDatabase } from '../src/config/database.js'
import User from '../models/user.js'

dotenv.config()
dns.setServers(['8.8.8.8', '8.8.4.4'])

async function run() {
    await connectDatabase()

    const existing = await User.findOne({ username: 'guard1' })
    if (existing) {
        console.log('Tài khoản guard1 đã tồn tại')
        process.exit(0)
    }

    const hash = await bcrypt.hash('123456', 10)
    await User.create({
        username: 'guard1',
        email: 'guard1@parking.local',
        passwordHash: hash,
        fullName: 'Bảo Vệ 1',
        role: 'guard',
        status: 'active',
    })

    console.log('Đã tạo tài khoản: guard1 / 123456')
    process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
