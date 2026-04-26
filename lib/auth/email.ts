import { Resend } from "resend";

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  return new Resend(key);
}

const FROM_FALLBACK = "Legal Research <onboarding@resend.dev>";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const from = process.env.EMAIL_FROM ?? FROM_FALLBACK;
  const resend = client();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Your sign-in code: ${code}`,
    text:
      `Your sign-in code for the Legal Research Cross-Verifier is:\n\n` +
      `    ${code}\n\n` +
      `It expires in 10 minutes. If you didn't try to sign in, ignore this email.`,
    html:
      `<p>Your sign-in code for the Legal Research Cross-Verifier is:</p>` +
      `<p style="font-size:24px;font-weight:600;letter-spacing:4px;font-family:monospace">${code}</p>` +
      `<p>It expires in 10 minutes. If you didn't try to sign in, ignore this email.</p>`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message ?? "unknown"}`);
  }
}
