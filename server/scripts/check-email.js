import nodemailer from 'nodemailer'
import { config } from '../config/env.js'
if (config.MAIL_TRANSPORT !== 'smtp' || !config.SMTP_USER || !config.SMTP_PASSWORD) {
  console.error('Configure MAIL_TRANSPORT=smtp, SMTP_USER, and SMTP_PASSWORD in server/.env first.')
  process.exitCode = 1
} else {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: config.SMTP_PORT !== 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
  try {
    await transport.verify()
    console.log('SMTP connection and authentication succeeded. No email was sent.')
  } catch {
    console.error(
      'SMTP verification failed. Check Gmail app password, 2-Step Verification, and network access.',
    )
    process.exitCode = 1
  } finally {
    transport.close()
  }
}
