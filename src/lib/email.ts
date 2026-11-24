/**
 * Sends email through Resend (https://resend.com) when RESEND_API_KEY and
 * EMAIL_FROM are set. Without them, in development the email is printed to
 * the server console instead, so flows like password reset still work locally.
 */
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Email is not configured (RESEND_API_KEY / EMAIL_FROM); an email was not sent.",
      );
      return false;
    }
    console.info(
      `\n──── Email (not sent: no email service configured) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n──────────────────────────────────────────────────────\n`,
    );
    return true;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    console.error(`Email delivery failed with status ${response.status}.`);
    return false;
  }
  return true;
}
