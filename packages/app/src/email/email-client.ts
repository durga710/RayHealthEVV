/**
 * Provider-agnostic email client used by the invite flow.
 *
 * Currently backed by Amazon SES via `@aws-sdk/client-sesv2`. The route
 * layer talks to `EmailClient`, not the underlying provider, so swapping
 * providers later is a one-file change.
 *
 * Failure model — by design we NEVER throw:
 *  - If AWS credentials are unset, `createEmailClient()` returns a no-op
 *    implementation that resolves with `{ ok: false, error: 'EMAIL_NOT_CONFIGURED' }`.
 *    This keeps local dev / unconfigured preview deploys functional —
 *    the admin can still copy the invite URL from the response and share
 *    it manually.
 *  - If the SES call throws (network, throttling, unverified sender, etc.)
 *    we catch the error, log it (scrubbed by `safeError`), and return
 *    `{ ok: false, error: '<category>' }`. The route layer surfaces this
 *    as `emailDelivery: 'failed'`.
 *
 * Why the SDK and not raw HTTP — SES requires AWS SigV4 signing on every
 * request, which is non-trivial to implement correctly. `@aws-sdk/client-sesv2`
 * handles signing, retries, and region resolution for us.
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { renderInviteEmail } from './templates/invite-email.js';
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

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface EmailClient {
  sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult>;
}

const DEFAULT_FROM = 'RayHealth <onboarding@rayhealthevv.com>';
const DEFAULT_REGION = 'us-west-2';

/**
 * Returns a no-op client. Used when AWS credentials are unset so callers
 * don't have to branch — they always get a working `sendInviteEmail` that
 * resolves with a "not configured" outcome.
 */
function createNoopClient(): EmailClient {
  return {
    async sendInviteEmail(): Promise<SendEmailResult> {
      return { ok: false, error: 'EMAIL_NOT_CONFIGURED' };
    }
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
  return {
    async sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult> {
      const { subject, html, text } = renderInviteEmail({
        to: params.to,
        inviteUrl: params.inviteUrl,
        agencyName: params.agencyName,
        role: params.role,
        expiresAt: params.expiresAt,
        invitedByName: params.invitedByName
      });

      try {
        const result = await client.send(
          new SendEmailCommand({
            FromEmailAddress: from,
            Destination: { ToAddresses: [params.to] },
            Content: {
              Simple: {
                Subject: { Data: subject, Charset: 'UTF-8' },
                Body: {
                  Html: { Data: html, Charset: 'UTF-8' },
                  Text: { Data: text, Charset: 'UTF-8' }
                }
              }
            }
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
  };
}

/**
 * Construct the appropriate `EmailClient` for the current environment.
 *
 * Reads env vars at call time (not at module load) so test setup can
 * mutate `process.env` between cases. Credentials may come from:
 *  - Explicit `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` env vars
 *    (the path Vercel will use — set these in project env).
 *  - The default AWS provider chain (IAM role, ~/.aws/credentials, etc.)
 *    when running locally / on EC2. The SDK handles that natively if the
 *    explicit env vars are absent but the chain has creds.
 *
 * To disable email entirely (no-op fallback), unset
 * `AWS_ACCESS_KEY_ID` AND `AWS_SECRET_ACCESS_KEY`. The route layer will
 * return `emailDelivery: 'not_configured'` and the admin's manual-copy
 * fallback still works.
 */
export function createEmailClient(): EmailClient {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  // Treat "no AWS creds at all" as not-configured. Don't probe the
  // ambient AWS provider chain unless the operator has set at least one
  // of the explicit env vars — otherwise local dev would pick up the
  // dev's personal AWS profile and start sending real emails on every
  // invite create.
  if (!accessKeyId || !secretAccessKey) return createNoopClient();

  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
  const region = process.env.AWS_SES_REGION?.trim() || process.env.AWS_REGION?.trim() || DEFAULT_REGION;

  const client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
  });

  return createSesClient(client, from);
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
