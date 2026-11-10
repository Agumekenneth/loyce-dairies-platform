
import 'dotenv/config'
import nodemailer from 'nodemailer'

type EmailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: EmailMessage): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT)
  const from = process.env.SMTP_FROM

  if (!host || !from || !Number.isInteger(port) ||
      port < 1 || port > 65535) {
    throw new Error(
      'SMTP environment configuration is incomplete.',
    )
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
  })

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  })
}
