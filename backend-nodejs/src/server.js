import dotenv from 'dotenv'
import app from './app.js'
import { connectDatabase } from './config/database.js'

dotenv.config()

const port = Number(process.env.PORT || 4000)

async function startServer() {
    try {
        await connectDatabase()
        app.listen(port, () => {
            console.log(`Backend listening on http://localhost:${port}`)
        })
    } catch (error) {
        console.error('Failed to start server:', error.message)
        process.exit(1)
    }
}

startServer()
