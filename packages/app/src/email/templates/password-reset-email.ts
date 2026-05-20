export interface PasswordResetEmailFields {
  resetUrl: string;
  supportEmail?: string;
}

export interface PasswordResetEmailPayload {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPasswordResetEmail(fields: PasswordResetEmailFields): PasswordResetEmailPayload {
  const support = fields.supportEmail?.trim() || 'support@rayhealthevv.com';
  const safeUrl = escapeHtml(fields.resetUrl);
  const safeSupport = escapeHtml(support);

  const subject = 'Reset your RayHealth EVV password';

  const text = [
    'You requested a password reset for your RayHealth EVV account.',
    '',
    'Open this link to set a new password (expires in 1 hour):',
    fields.resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email — your password won't change.",
    '',
    `Questions? Reach us at ${support}.`,
    '',
    '— The RayHealth EVV team',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr>
          <td style="background-color:#0b2a4a;padding:32px 32px 28px;color:#ffffff;">
            <div style="font-size:24px;font-weight:700;letter-spacing:-0.01em;line-height:1.2;">RayHealth EVV</div>
            <div style="margin-top:6px;font-size:14px;color:#fb923c;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">Password reset</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
              You requested a password reset for your RayHealth EVV account.
            </p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#334155;">
              Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" bgcolor="#6366f1" style="border-radius:8px;">
                  <a href="${safeUrl}"
                     style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#6366f1;">
                    Reset password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 12px;font-size:13px;line-height:1.55;color:#64748b;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 24px;font-size:13px;line-height:1.55;word-break:break-all;">
              <a href="${safeUrl}" style="color:#0b2a4a;">${safeUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.55;color:#64748b;">
            If you didn't request a password reset, you can safely ignore this email — your password won't change.
            <br /><br />
            Questions? Reach us at <a href="mailto:${safeSupport}" style="color:#0b2a4a;">${safeSupport}</a>.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
