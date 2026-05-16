import 'dotenv/config'
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

async function fixIndexes() {
    await mongoose.connect(MONGODB_URI)
    const db = mongoose.connection.db
    const col = db.collection('user_packages')

    const indexes = await col.indexes()
    const toFix = ['renewal.code_1', 'paymentCode_1']

    for (const name of toFix) {
        if (indexes.find((i) => i.name === name)) {
            await col.dropIndex(name)
            console.log(`Dropped index: ${name}`)
        } else {
            console.log(`Index not found (skipped): ${name}`)
        }
    }

    await mongoose.disconnect()
    console.log('Done. Restart the server to recreate indexes correctly.')
}

fixIndexes().catch((err) => { console.error(err); process.exit(1) })
