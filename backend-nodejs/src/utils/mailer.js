import nodemailer from 'nodemailer'

let cachedTransport = null

function readMailerConfig() {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const from = process.env.SMTP_FROM || user

    return {
        host,
        port,
        secure,
        user,
        pass,
        from,
    }
}

export function isMailerConfigured() {
    const { host, port, user, pass, from } = readMailerConfig()
    return Boolean(host && port && user && pass && from)
}

export function getMailerFrom() {
    const { from } = readMailerConfig()
    return from
}

function getTransport() {
    if (cachedTransport) {
        return cachedTransport
    }

    const { host, port, secure, user, pass } = readMailerConfig()

    cachedTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    })

    return cachedTransport
}

export async function sendMail({ to, subject, text, html }) {
    if (!isMailerConfigured()) {
        throw new Error('SMTP is not configured')
    }

    const transporter = getTransport()
    return transporter.sendMail({
        from: getMailerFrom(),
        to,
        subject,
        text,
        html,
    })
}
