/**
 * Staff-invite email template, both HTML and plain-text payloads.
 *
 * Design rules:
 *  - Inline styles only. Outlook, Gmail, Yahoo all strip <style> blocks
 *    aggressively; table-based layout + inline CSS is the lowest common
 *    denominator that renders predictably across them.
 *  - No external resources (no <img src=...>, no remote fonts). The
 *    branded header uses background color + text only so it renders
 *    without "load remote content" approvals in Outlook / Apple Mail.
 *  - Plain-text version includes the URL inline for clients that don't
 *    render HTML (and for screen readers + accessibility).
 *  - Never embed any session token, API key, or PII beyond what the
 *    inviter explicitly typed (recipient email, agency name, role).
 *    The only sensitive value is the time-limited invite URL, which is
 *    the whole point of the email.
 */

export interface InviteEmailFields {
  /** Recipient name displayed in the greeting; falls back to "there" if unset. */
  to: string;
  /** Absolute URL the recipient clicks to accept (already URL-encoded by caller). */
  inviteUrl: string;
  /** Agency display name surfaced in subject + body. */
  agencyName: string;
  /** Role the recipient is being invited as (admin / coordinator / caregiver / family). */
  role: string;
  /** ISO-8601 timestamp the invite expires; the template formats for human display. */
  expiresAt: string;
  /** Optional display name of the inviter for personalization. */
  invitedByName?: string;
  /** Support contact rendered in the footer. */
  supportEmail?: string;
}

export interface InviteEmailPayload {
  subject: string;
  html: string;
  text: string;
}

const ROLE_BLURBS: Record<string, string> = {
  admin: 'manage your agency, invite staff, configure billing, and oversee compliance',
  coordinator: 'schedule visits, manage clients, and coordinate caregivers',
  caregiver: 'log visits, clock in and out at client homes, and view your assigned schedule',
  family: 'view your loved one\'s visit schedule and care updates'
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiration(iso: string): string {
  try {
    const date = new Date(iso);
    // Use a locale-neutral, human-readable format. Mail clients don't
    // run the recipient's locale at render time, so we pick a stable
    // English-language format that's unambiguous globally.
    return date.toUTCString();
  } catch {
    return iso;
  }
}

export function renderInviteEmail(fields: InviteEmailFields): InviteEmailPayload {
  const agencyName = fields.agencyName?.trim() || 'your care agency';
  const role = fields.role?.trim() || 'staff member';
  const roleBlurb = ROLE_BLURBS[role.toLowerCase()] ?? 'access the platform';
  const expires = formatExpiration(fields.expiresAt);
  const invitedByName = fields.invitedByName?.trim();
  const support = fields.supportEmail?.trim() || 'support@rayhealthevv.com';

  const subject = `You're invited to join ${agencyName} on RayHealth EVV`;

  // ---------- Plain text ----------
  const textLines = [
    `Hi ${fields.to},`,
    '',
    invitedByName
      ? `${invitedByName} has invited you to join ${agencyName} on RayHealth EVV as a ${role}.`
      : `You've been invited to join ${agencyName} on RayHealth EVV as a ${role}.`,
    '',
    `As a ${role}, you'll be able to ${roleBlurb}.`,
    '',
    'Accept your invite by opening this link:',
    fields.inviteUrl,
    '',
    `This invite expires on ${expires}. After that you'll need a new invite.`,
    '',
    'If you didn\'t expect this email, you can safely ignore it, your address won\'t be added to anything until you click the link and set a password.',
    '',
    `Questions? Reach us at ${support}.`,
    '',
    ',  The RayHealth EVV team'
  ];
  const text = textLines.join('\n');

  // ---------- HTML ----------
  // Brand colors: navy header, orange CTA button. Table-based for Outlook.
  const safeAgency = escapeHtml(agencyName);
  const safeRole = escapeHtml(role);
  const safeRoleBlurb = escapeHtml(roleBlurb);
  const safeInvitedBy = invitedByName ? escapeHtml(invitedByName) : '';
  const safeUrl = escapeHtml(fields.inviteUrl);
  const safeExpires = escapeHtml(expires);
  const safeSupport = escapeHtml(support);
  const safeTo = escapeHtml(fields.to);

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
            <div style="margin-top:6px;font-size:14px;color:#fb923c;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">Staff invitation</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${safeTo},</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
              ${safeInvitedBy
                ? `<strong>${safeInvitedBy}</strong> has invited you to join`
                : `You've been invited to join`}
              <strong>${safeAgency}</strong> on RayHealth EVV as a <strong>${safeRole}</strong>.
            </p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#334155;">
              As a ${safeRole}, you'll be able to ${safeRoleBlurb}.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" bgcolor="#fb923c" style="border-radius:8px;">
                  <a href="${safeUrl}"
                     style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#fb923c;">
                    Accept invite
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
            <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#64748b;">
              This invite expires on <strong>${safeExpires}</strong>. After that you'll need a new invite.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.55;color:#64748b;">
            If you didn't expect this email, you can safely ignore it, your address won't be added to anything until you click the link and set a password.
            <br /><br />
            Questions? Reach us at
            <a href="mailto:${safeSupport}" style="color:#0b2a4a;">${safeSupport}</a>.
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
