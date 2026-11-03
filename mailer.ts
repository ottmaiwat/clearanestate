import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter(): nodemailer.Transporter | null {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      // Fail fast on a wrong port/SSL combination instead of hanging the request.
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

// Best-effort send: returns true if an email was actually dispatched, false if mail isn't
// configured or the send failed. Callers should not treat a false return as a hard error -
// the request itself should still succeed as long as it was stored in the database.
export async function sendMail(opts: { to: string; replyTo?: string; subject: string; text: string }): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}

// Admin diagnostic: which mail settings are present (never their values) and the exact
// SMTP error, if any, so a broken setup can be fixed without access to the server logs.
export async function sendTestMail(to: string): Promise<{ ok: boolean; error?: string; settings: Record<string, string> }> {
  const settings = {
    SMTP_HOST: process.env.SMTP_HOST || '(missing)',
    SMTP_PORT: process.env.SMTP_PORT || '(missing, using 587)',
    SMTP_SECURE: process.env.SMTP_SECURE || '(missing, using false)',
    SMTP_USER: process.env.SMTP_USER || '(missing)',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '(set)' : '(missing)',
    SMTP_FROM: process.env.SMTP_FROM || '(missing, using SMTP_USER)',
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || '(missing, no admin notifications are sent)',
  };

  const mailer = getTransporter();
  if (!mailer) {
    return { ok: false, error: 'Email is switched off: SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set.', settings };
  }

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'ClearAnEstate test email',
      text: 'This is a test email from the ClearAnEstate admin portal. If you can read it, email sending works.',
    });
    return { ok: true, settings };
  } catch (err: any) {
    console.error('Test email failed:', err);
    return { ok: false, error: [err?.code, err?.response || err?.message].filter(Boolean).join(': '), settings };
  }
}
