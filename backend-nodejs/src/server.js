import 'dotenv/config'
import dns from 'dns'
import app from './app.js'
import { connectDatabase } from './config/database.js'
import { connectMQTT } from './config/mqtt.js'

dns.setServers(['8.8.8.8', '8.8.4.4'])

const port = Number(process.env.PORT || 4000)

async function startServer() {
    try {
        await connectDatabase()
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
