
import 'dotenv/config'

// ==========================================
// LOYCE DAIRIES PLATFORM
// TRANSACTIONAL EMAIL SERVICE
// RESEND HTTPS API
// ==========================================

type EmailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

const RESEND_API_URL =
  'https://api.resend.com/emails'

const REQUEST_TIMEOUT_MS = 15_000

// ==========================================
// SEND TRANSACTIONAL EMAIL
// ==========================================

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: EmailMessage): Promise<void> {

  const apiKey = process.env.RESEND_API_KEY

  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    throw new Error(
      'Resend email configuration is incomplete.',
    )
  }

  let response: Response

  try {
    response = await fetch(
      RESEND_API_URL,
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
          html,
        }),

        signal: AbortSignal.timeout(
          REQUEST_TIMEOUT_MS,
        ),
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to the email delivery service.',
    )
  }

  // Do not expose credentials, email contents
  // or verification tokens in error logs.

  if (!response.ok) {
    throw new Error(
      `Resend rejected the email request (HTTP ${response.status}).`,
    )
  }

  // Verify that Resend accepted the message.

  const result: unknown =
    await response.json().catch(() => null)

  if (
    result === null ||
    typeof result !== 'object' ||
    !('id' in result) ||
    typeof result.id !== 'string'
  ) {
    throw new Error(
      'Resend did not confirm email acceptance.',
    )
  }

  // A successful response confirms acceptance
  // by Resend, not final inbox delivery.
}
