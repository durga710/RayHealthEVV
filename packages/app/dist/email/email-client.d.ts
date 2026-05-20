/**
 * Provider-agnostic email client used by the invite flow.
 *
 * Provider selection (first match wins):
 *   1. SMTP/Gmail — set GMAIL_USER + GMAIL_APP_PASSWORD in Vercel.
 *   2. Resend — set RESEND_API_KEY in Vercel environment variables.
 *   3. Amazon SES — set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.
 *   4. No-op fallback — returns EMAIL_NOT_CONFIGURED.
 */
export interface InviteEmailParams {
    to: string;
    inviteUrl: string;
    agencyName: string;
    role: string;
    /** ISO-8601 timestamp the invite expires. */
    expiresAt: string;
    invitedByName?: string;
}
export interface PasswordResetEmailParams {
    to: string;
    resetUrl: string;
}
export type SendEmailResult = {
    ok: true;
    id: string;
} | {
    ok: false;
    error: string;
};
export interface EmailClient {
    sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult>;
    sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult>;
}
/**
 * Construct the email client from environment variables.
 *
 * Provider selection (first match wins):
 *   RESEND_API_KEY         — Resend (preferred, already set in Vercel)
 *   AWS_ACCESS_KEY_ID +
 *   AWS_SECRET_ACCESS_KEY  — Amazon SES fallback
 *
 * Optional:
 *   EMAIL_FROM     — override sender address
 *   AWS_SES_REGION — override SES region (default: us-east-1)
 */
export declare function createEmailClient(): EmailClient;
/**
 * Build the absolute invite URL the recipient will click.
 *
 * Resolution order:
 *  1. Explicit `INVITE_URL_BASE` env (preferred — set in Vercel to
 *     `https://rayhealthevv.com` or your custom domain).
 *  2. `APP_URL` env (already used elsewhere in the codebase).
 *  3. `BASE_URL` env (last fallback before localhost).
 *  4. `http://localhost:5173` for local dev.
 */
export declare function buildInviteUrl(inviteId: string): string;
export declare function buildPasswordResetUrl(token: string): string;
//# sourceMappingURL=email-client.d.ts.map