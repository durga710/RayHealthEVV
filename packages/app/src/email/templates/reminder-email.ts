/**
 * Caregiver reminder email. HTML + plain-text.
 *
 * Sent when an admin/coordinator confirms a copilot `send_reminder` action.
 * The body is the human-authored reminder message (escaped); RayHealth only
 * wraps it in branded chrome. No PHI is added by the template.
 */

export interface ReminderEmailFields {
  caregiverName: string;
  /** The reminder body the admin confirmed sending. */
  message: string;
  agencyName: string;
  supportEmail?: string;
}

export interface ReminderEmailPayload {
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

export function renderReminderEmail(fields: ReminderEmailFields): ReminderEmailPayload {
  const support = fields.supportEmail?.trim() || 'support@rayhealthevv.com';
  const agency = fields.agencyName?.trim() || 'Your agency';
  const safeName = escapeHtml(fields.caregiverName);
  const safeAgency = escapeHtml(agency);
  const safeSupport = escapeHtml(support);
  // Preserve author line breaks in HTML.
  const safeMessageHtml = escapeHtml(fields.message).replace(/\n/g, '<br />');

  const subject = `A reminder from ${agency}`;

  const text = [
    `Hi ${fields.caregiverName},`,
    '',
    fields.message,
    '',
    `,  ${agency} (via RayHealth EVV)`,
    '',
    `Questions? Reach us at ${support}.`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0f0d;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f4;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(12,93,102,0.10);">
        <tr>
          <td style="background-color:#0c5d66;padding:32px 32px 28px;color:#ffffff;">
            <div style="font-size:24px;font-weight:700;letter-spacing:-0.01em;line-height:1.2;">RayHealth EVV</div>
            <div style="margin-top:6px;font-size:13px;color:#ee6c2c;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">Reminder from ${safeAgency}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${safeName},</p>
            <div style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#334155;">${safeMessageHtml}</div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.55;color:#64748b;">
            Sent by ${safeAgency} via RayHealth EVV.
            <br /><br />
            Questions? Reach us at <a href="mailto:${safeSupport}" style="color:#0c5d66;">${safeSupport}</a>.
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
