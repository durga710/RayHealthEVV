/**
 * Provider-agnostic email client used by the invite flow.
 *
 * Provider selection (first match wins):
 *   1. SMTP/Gmail — set GMAIL_USER + GMAIL_APP_PASSWORD in Vercel.
 *   2. Resend — set RESEND_API_KEY in Vercel environment variables.
 *   3. Amazon SES — set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.
 *   4. No-op fallback — returns EMAIL_NOT_CONFIGURED.
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { renderInviteEmail } from './templates/invite-email.js';
import { renderPasswordResetEmail } from './templates/password-reset-email.js';
import { safeError } from '../security/safe-log.js';

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

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface EmailClient {
  sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult>;
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult>;
}

const DEFAULT_FROM = 'RayHealth <onboarding@www.rayhealthevv.com>';

function createSmtpClient(user: string, pass: string): EmailClient {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  const from = `RayHealth <${user}>`;

  async function smtpSend(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
    try {
      const info = await transporter.sendMail({ from, to, subject, html, text });
      return { ok: true, id: info.messageId ?? 'sent' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMTP_ERROR';
      safeError('smtp.send failed', new Error(msg));
      return { ok: false, error: 'SMTP_ERROR' };
    }
  }

  return {
    async sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderInviteEmail({
        to: params.to,
        inviteUrl: params.inviteUrl,
        agencyName: params.agencyName,
        role: params.role,
        expiresAt: params.expiresAt,
        invitedByName: params.invitedByName,
      });
      return smtpSend(params.to, subject, html, text);
    },
    async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderPasswordResetEmail({ resetUrl: params.resetUrl });
      return smtpSend(params.to, subject, html, text);
    },
  };
}

function createNoopClient(): EmailClient {
  return {
    async sendInviteEmail(): Promise<SendEmailResult> {
      return { ok: false, error: 'EMAIL_NOT_CONFIGURED' };
    },
    async sendPasswordResetEmail(): Promise<SendEmailResult> {
      return { ok: false, error: 'EMAIL_NOT_CONFIGURED' };
    },
  };
}

function createResendClient(apiKey: string, from: string): EmailClient {
  const resend = new Resend(apiKey);

  async function resendSend(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
    try {
      const { data, error } = await resend.emails.send({ from, to: [to], subject, html, text });
      if (error) {
        safeError('resend.send failed', new Error(error.name ?? 'RESEND_ERROR'));
        return { ok: false, error: error.name ?? 'RESEND_ERROR' };
      }
      if (!data?.id) {
        safeError('resend.send returned ok without id');
        return { ok: false, error: 'NO_MESSAGE_ID' };
      }
      return { ok: true, id: data.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      safeError('resend.send threw', new Error(msg));
      return { ok: false, error: msg };
    }
  }

  return {
    async sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderInviteEmail({
        to: params.to,
        inviteUrl: params.inviteUrl,
        agencyName: params.agencyName,
        role: params.role,
        expiresAt: params.expiresAt,
        invitedByName: params.invitedByName,
      });
      return resendSend(params.to, subject, html, text);
    },
    async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderPasswordResetEmail({ resetUrl: params.resetUrl });
      return resendSend(params.to, subject, html, text);
    },
  };
}

/**
 * Categorize an SES SDK error into a short, log-safe string. The SDK
 * surfaces a `name` (e.g. `MessageRejected`, `MailFromDomainNotVerified`)
 * and sometimes an HTTP status code on `$metadata.httpStatusCode`. We
 * never include the human-readable `message` because it can echo the
 * recipient address or other request data.
 */
function categorizeSesError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    const status = e.$metadata?.httpStatusCode;
    const name = e.name;
    if (name && status) return `HTTP_${status}:${name}`;
    if (name) return name;
    if (status) return `HTTP_${status}`;
  }
  return 'UNKNOWN_ERROR';
}

function createSesClient(client: SESv2Client, from: string): EmailClient {
  async function sesSend(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
    try {
      const result = await client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: html, Charset: 'UTF-8' },
                Text: { Data: text, Charset: 'UTF-8' },
              },
            },
          },
        })
      );
      const id = result.MessageId;
      if (!id) {
        safeError('ses.send returned ok without MessageId');
        return { ok: false, error: 'NO_MESSAGE_ID' };
      }
      return { ok: true, id };
    } catch (err) {
      const category = categorizeSesError(err);
      safeError('ses.send failed', new Error(category));
      return { ok: false, error: category };
    }
  }

  return {
    async sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderInviteEmail({
        to: params.to,
        inviteUrl: params.inviteUrl,
        agencyName: params.agencyName,
        role: params.role,
        expiresAt: params.expiresAt,
        invitedByName: params.invitedByName,
      });
      return sesSend(params.to, subject, html, text);
    },
    async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderPasswordResetEmail({ resetUrl: params.resetUrl });
      return sesSend(params.to, subject, html, text);
    },
  };
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
export function createEmailClient(): EmailClient {
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (gmailUser && gmailPass) return createSmtpClient(gmailUser, gmailPass);

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) return createResendClient(resendKey, from);

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (accessKeyId && secretAccessKey) {
    const region =
      process.env.AWS_SES_REGION?.trim() ||
      process.env.AWS_REGION?.trim() ||
      'us-east-1';
    const sesClient = new SESv2Client({
      region,
      credentials: { accessKeyId, secretAccessKey }
    });
    return createSesClient(sesClient, from);
  }

  return createNoopClient();
}

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
export function buildInviteUrl(inviteId: string): string {
  const base = (
    process.env.INVITE_URL_BASE ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');
  return `${base}/accept-invite?token=${encodeURIComponent(inviteId)}`;
}

export function buildPasswordResetUrl(token: string): string {
  const base = (
    process.env.APP_URL ||
    process.env.BASE_URL ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');
  return `${base}/reset-password/${encodeURIComponent(token)}`;
}
