import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson, patchJson, postJson } from '../../lib/api-client.js';

interface ProfileData {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
  createdAt: string;
}

function resizeImageToDataUrl(file: File, maxPx = 200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function getInitials(firstName: string, lastName: string, email: string): string {
  if (firstName || lastName) {
    return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || '?';
  }
  return email.slice(0, 1).toUpperCase() || '?';
}

export function ProfilePage() {
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null | false>(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getJson<ProfileData>('/api/profile');
        setProfile(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setPhone(data.phone);
        setAvatarPreview(data.avatarUrl);
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarPreview(dataUrl);
      setPendingAvatar(dataUrl);
    } catch {
      setError('Failed to process image');
    }
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setPendingAvatar(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const body: Record<string, string | null> = { firstName, lastName, phone };
      if (pendingAvatar !== false) body.avatarUrl = pendingAvatar;
      await patchJson('/api/profile', body);
      setPendingAvatar(false);
      setSaveMsg('Profile saved');
      await refreshUser();
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    setPwError(null);
    try {
      await postJson('/api/profile/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg('Password changed successfully');
      setTimeout(() => setPwMsg(null), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#64748B' }}>Loading profile…</div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ padding: '2rem', color: '#EF4444' }}>{error}</div>
    );
  }

  const initials = profile ? getInitials(firstName, lastName, profile.email) : '?';
  const memberSince = profile ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>
        My Profile
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '2rem' }}>
        Manage your account details and security settings
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left column: avatar + account info */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              margin: '0 auto 1rem',
              overflow: 'hidden',
              background: 'var(--color-primary, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 700,
              color: '#fff',
              border: '3px solid #E2E8F0',
              flexShrink: 0,
            }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'var(--color-primary, #7c3aed)',
                background: 'transparent',
                border: '1px solid var(--color-primary, #7c3aed)',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              Upload photo
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#EF4444',
                  background: 'transparent',
                  border: '1px solid #FECACA',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1.25rem' }}>
            JPG, PNG, GIF up to 300 KB
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', textAlign: 'left' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                Email
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#334155', wordBreak: 'break-all' }}>
                {profile?.email}
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                Role
              </div>
              <span style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--color-primary-bg, #EEF2FF)',
                color: 'var(--color-primary, #7c3aed)',
                borderRadius: '100px',
                padding: '0.15rem 0.6rem',
                textTransform: 'capitalize',
              }}>
                {profile?.role}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                Member since
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
                {memberSince}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: profile form + password form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Personal info */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', marginBottom: '1.25rem' }}>
              Personal Information
            </h2>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>First name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={100}
                  placeholder="First name"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Last name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={100}
                  placeholder="Last name"
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Email address</span>
              <input
                type="email"
                value={profile?.email ?? ''}
                readOnly
                style={{ ...inputStyle, background: '#F8FAFC', color: '#64748B', cursor: 'default' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Email cannot be changed here. Contact support.</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Phone number</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="+1 (555) 000-0000"
                style={inputStyle}
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                style={primaryButtonStyle}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saveMsg && (
                <span style={{ fontSize: '0.875rem', color: '#16A34A' }}>{saveMsg}</span>
              )}
            </div>
          </div>

          {/* Change password */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.25rem' }}>
              Change Password
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '1.25rem' }}>
              Must be at least 12 characters and different from your current password.
            </p>

            {pwError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#DC2626' }}>
                {pwError}
              </div>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                style={{
                  ...inputStyle,
                  ...(confirmPassword && newPassword !== confirmPassword
                    ? { borderColor: '#EF4444', outline: 'none' }
                    : {}),
                }}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Passwords do not match</span>
              )}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                style={{
                  ...primaryButtonStyle,
                  opacity: (pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword) ? 0.5 : 1,
                }}
              >
                {pwSaving ? 'Updating…' : 'Update password'}
              </button>
              {pwMsg && (
                <span style={{ fontSize: '0.875rem', color: '#16A34A' }}>{pwMsg}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  color: '#0F172A',
  background: '#fff',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#fff',
  background: 'var(--color-primary, #7c3aed)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};
