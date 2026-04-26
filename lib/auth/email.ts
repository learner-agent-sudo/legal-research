import { Resend } from "resend";
import { requireAscii } from "./sanitize";

function client(): Resend {
  const key = requireAscii(process.env.RESEND_API_KEY, "RESEND_API_KEY");
  return new Resend(key);
}

const FROM_FALLBACK = "Legal Research <onboarding@resend.dev>";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const from = requireAscii(
    process.env.EMAIL_FROM ?? FROM_FALLBACK,
    "EMAIL_FROM"
  );
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
