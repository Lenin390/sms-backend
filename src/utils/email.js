const RESEND_API_URL = "https://api.resend.com/emails";

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev] Body: ${html}`);
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "SMS <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }
}

async function sendResetEmail(toEmail, resetLink) {
  await sendEmail({
    to: toEmail,
    subject: "Reset your SMS password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your password. This link expires in 30 minutes.</p>
        <p><a href="${resetLink}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Reset Password</a></p>
        <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

async function sendAccessGrantedEmail(toEmail, tempPassword, loginUrl) {
  await sendEmail({
    to: toEmail,
    subject: "Your SMS login access is ready",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You now have login access</h2>
        <p>Email: <strong>${toEmail}</strong></p>
        ${tempPassword ? `<p>Temporary password: <strong>${tempPassword}</strong></p>` : ""}
        <p><a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Log In</a></p>
      </div>
    `,
  });
}

module.exports = { sendEmail, sendResetEmail, sendAccessGrantedEmail };
