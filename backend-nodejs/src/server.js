import 'dotenv/config'
import dns from 'dns'
import app from './app.js'
import { connectDatabase } from './config/database.js'
import { connectMQTT } from './config/mqtt.js'
import User from '../models/user.js'

dns.setServers(['8.8.8.8', '8.8.4.4'])

const port = Number(process.env.PORT || 4000)

async function startServer() {
    try {
        await connectDatabase()
        // Drop index phone cũ (unique không sparse gây lỗi khi phone=null), rồi recreate đúng
        try { await User.collection.dropIndex('phone_1') } catch (_) {}
        await User.syncIndexes()
        connectMQTT()
        app.listen(port, () => {
            console.log(`Backend listening on http://localhost:${port}`)
        })
    } catch (error) {
        console.error('Failed to start server:', error.message)
        process.exit(1)
    }
}

startServer()
