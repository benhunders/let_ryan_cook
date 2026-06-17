import { Resend } from "resend";

// Transactional email via Resend. Configured with two env vars:
//   RESEND_API_KEY — your Resend API key
//   EMAIL_FROM     — verified sender, e.g. "Let Him Cook <hi@yourdomain.com>"
// When the key is absent (e.g. local dev), sends are skipped with a log line
// so the app keeps working without email configured.

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Let Him Cook <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok?: true; skipped?: true; error?: unknown }> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping: ${opts.subject}`);
    return { skipped: true };
  }
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    console.error("[email] send failed:", error);
    return { error };
  }
  return { ok: true };
}

// Minimal shared wrapper so all our emails look consistent.
export function emailLayout(heading: string, bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${heading}</h1>
    ${bodyHtml}
    <p style="font-size: 12px; color: #888; margin-top: 24px;">Let Him Cook 🍳</p>
  </div>`;
}
