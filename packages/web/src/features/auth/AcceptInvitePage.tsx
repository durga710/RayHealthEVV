import React, { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Caregiver invite acceptance page.
 *
 * Lands the caregiver from the magic link in the invite email. Reads the
 * `:token` segment, calls `GET /api/invites/accept/:token` to fetch the
 * invite info, then collects access code + password + name and posts to
 * `POST /api/invites/accept/:token`.
 *
 * The endpoints are mounted before `authContext` on the backend, so this
 * page is fully public — no session required to reach it. On success the
 * response carries a bearer token; we stash it in localStorage so the
 * mobile/web app can pick it up.
 */

type InviteStatus = 'pending' | 'expired' | 'revoked' | 'accepted';

interface InvitePublicInfo {
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  agencyName: string;
  expiresAt: string;
  status: InviteStatus;
}

const PASSWORD_MIN_LENGTH = 12;

function statusMessage(status: InviteStatus): string | null {
  if (status === 'pending') return null;
  if (status === 'expired') {
    return 'This invitation has expired. Ask your coordinator to send a new one.';
  }
  if (status === 'revoked') {
    return 'This invitation has been revoked. Please contact your coordinator.';
  }
  if (status === 'accepted') {
    return 'This invitation has already been used. You can sign in with your existing credentials.';
  }
  return 'This invitation is no longer valid.';
}

export function AcceptInvitePage(): React.JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InvitePublicInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accessCode, setAccessCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run(): Promise<void> {
      if (!token) {
        setLoadError('No invite token in the URL.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/invites/accept/${encodeURIComponent(token)}`, {
          headers: { accept: 'application/json' },
        });
        if (cancelled) return;
        if (res.status === 404) {
          setLoadError('Invitation not found. Please double-check the link in your email.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setLoadError(`Could not load invitation (HTTP ${res.status}).`);
          setLoading(false);
          return;
        }
        const body = (await res.json()) as { success: boolean; data?: InvitePublicInfo; error?: string };
        if (!body.success || !body.data) {
          setLoadError(body.error ?? 'Could not load invitation.');
          setLoading(false);
          return;
        }
        setInfo(body.data);
        setFirstName(body.data.firstName ?? '');
        setLastName(body.data.lastName ?? '');
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Could not load invitation.');
        setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitError(null);

    if (!token) {
      setSubmitError('Missing invite token.');
      return;
    }
    if (!accessCode.trim()) {
      setSubmitError('Please enter the access code from your invitation email.');
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setSubmitError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError('Please enter your first and last name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/accept/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          accessCode: accessCode.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        setSubmitError(
          'That access code does not match. Please re-check the code in your invitation email.',
        );
        setSubmitting(false);
        return;
      }
      if (res.status === 410) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(body.error ?? 'This invitation is no longer valid.');
        setSubmitting(false);
        return;
      }
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(body.error ?? 'An account already exists for this email.');
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(body.error ?? `Could not accept invitation (HTTP ${res.status}).`);
        setSubmitting(false);
        return;
      }

      // Deliberately do not stash the bearer token in browser storage —
      // the web app uses HttpOnly cookie sessions, and storing auth in
      // localStorage is forbidden by the security-surface-scan regression
      // rule. The caregiver re-authenticates at /login (their account is
      // now provisioned and accepts the password they just set). The
      // mobile Capacitor app, when deep-link support ships, will consume
      // the POST response's `token` directly into Keychain/Keystore.
      await res.json(); // drain the body
      setSuccess(true);
      setSubmitting(false);
      // Brief delay so the success state is visible before navigating.
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not accept invitation.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell description="Loading your invitation…">
        <p className="text-center text-sm text-muted-foreground">Loading your invitation…</p>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell description="Invitation">
        <ErrorBox>{loadError}</ErrorBox>
        <p className="mt-4 text-sm text-muted-foreground">
          If you believe this is wrong, contact your coordinator and ask them to resend the invitation.
        </p>
      </Shell>
    );
  }

  if (!info) {
    return (
      <Shell description="Invitation">
        <ErrorBox>Invitation could not be loaded.</ErrorBox>
      </Shell>
    );
  }

  const blockingStatus = statusMessage(info.status);
  if (blockingStatus) {
    return (
      <Shell description={info.agencyName}>
        <ErrorBox>{blockingStatus}</ErrorBox>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell description={`Welcome to ${info.agencyName}`}>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your account is ready. Redirecting you to sign in…
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      description={
        <>
          You&apos;ve been invited to join <strong>{info.agencyName}</strong> as a {info.role}.
          <br />
          <span className="text-xs">Invitation for {info.email}</span>
        </>
      }
    >
      {submitError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="accessCode">Access code</Label>
          <Input
            id="accessCode"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="ABCD-1234"
            required
            className="font-mono tracking-[2px]"
          />
          <p className="text-xs text-muted-foreground">
            From the email we sent you (format: XXXX-XXXX).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <p className="text-xs text-muted-foreground">
            Minimum {PASSWORD_MIN_LENGTH} characters — mix letters, numbers, and symbols.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
        </div>

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? 'Setting up your account…' : 'Accept invitation & create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        By accepting you agree to the RayHealth EVV terms of service and acknowledge that this
        platform is designed to support HIPAA-grade privacy and EVV compliance for participating agencies.
      </p>
    </Shell>
  );
}

// ----- Sub-components (kept local — this page is the only consumer) -----

interface ShellProps {
  description: ReactNode;
  children: ReactNode;
}
function Shell({ description, children }: ShellProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_12%_8%,rgba(249,115,22,0.10),transparent_28rem),linear-gradient(180deg,#f6fbff_0%,#eef5fb_40%,#f8fbfd_100%)] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" aria-hidden />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            RayHealth
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold tracking-[0.18em] text-accent-foreground">
              EVV
            </span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

interface ErrorBoxProps {
  children: ReactNode;
}
function ErrorBox({ children }: ErrorBoxProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
