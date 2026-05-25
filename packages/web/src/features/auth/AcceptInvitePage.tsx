import React, { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
      <Shell>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your invitation…</p>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <ErrorBox>{loadError}</ErrorBox>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          If you believe this is wrong, contact your coordinator and ask them to resend the invitation.
        </p>
      </Shell>
    );
  }

  if (!info) {
    return (
      <Shell>
        <ErrorBox>Invitation could not be loaded.</ErrorBox>
      </Shell>
    );
  }

  const blockingStatus = statusMessage(info.status);
  if (blockingStatus) {
    return (
      <Shell>
        <h1 style={{ marginBottom: '0.5rem' }}>{info.agencyName}</h1>
        <ErrorBox>{blockingStatus}</ErrorBox>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <h1 style={{ marginBottom: '0.5rem' }}>Welcome to {info.agencyName}</h1>
        <p style={{ color: '#059669' }}>
          Your account is ready. Redirecting you to sign in…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>
          RayHealth <span className="evv-badge" style={badgeStyle}>EVV</span>
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          You've been invited to join <strong>{info.agencyName}</strong> as a {info.role}.
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          Invitation for {info.email}
        </p>
      </div>

      {submitError && <ErrorBox>{submitError}</ErrorBox>}

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Access code" hint="From the email we sent you (format: XXXX-XXXX).">
          <input
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="ABCD-1234"
            required
            style={{ letterSpacing: '2px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </Field>

        <Row>
          <Field label="First name">
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Field>
        </Row>

        <Field label="Phone (optional)">
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
          />
        </Field>

        <Field
          label="Password"
          hint={`Minimum ${PASSWORD_MIN_LENGTH} characters — mix letters, numbers, and symbols.`}
        >
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
        </Field>

        <Field label="Confirm password">
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          style={{ width: '100%', marginTop: '1.5rem', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Setting up your account…' : 'Accept invitation & create account'}
        </button>
      </form>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1.25rem', textAlign: 'center' }}>
        By accepting you agree to the RayHealth EVV terms of service and acknowledge that this
        platform is designed to support HIPAA-grade privacy and EVV compliance for participating agencies.
      </p>
    </Shell>
  );
}

// ----- Sub-components (kept local — this page is the only consumer) -----

const badgeStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-accent)',
  color: 'white',
  padding: '2px 10px',
  borderRadius: '12px',
  fontSize: '0.75rem',
  letterSpacing: '2px',
  fontWeight: 800,
};

interface ShellProps {
  children: React.ReactNode;
}
function Shell({ children }: ShellProps): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '460px', margin: '2rem' }}>
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}
function Field({ label, hint, children }: FieldProps): React.JSX.Element {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.75rem' }}>
      <label htmlFor={id} style={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { id })
        : children}
      {hint && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{hint}</span>
      )}
    </div>
  );
}

interface RowProps {
  children: React.ReactNode;
}
function Row({ children }: RowProps): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>{children}</div>
  );
}

interface ErrorBoxProps {
  children: React.ReactNode;
}
function ErrorBox({ children }: ErrorBoxProps): React.JSX.Element {
  return (
    <div
      style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fca5a5',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        color: '#b91c1c',
        fontSize: '0.875rem',
      }}
    >
      {children}
    </div>
  );
}
