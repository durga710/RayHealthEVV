import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AgencyMark, PublicBrandStyles } from './public-brand.js';

interface PortalDocument {
  id: string;
  documentType: string;
  status: 'requested' | 'submitted' | 'verified' | 'rejected';
  fileName: string | null;
  submittedAt: string | null;
}

interface PortalState {
  applicant: { firstName: string; lastName: string; position: string; status: string };
  agencyName: string;
  interview: { status: 'pending' | 'in_progress' | 'completed'; questionsRemaining: number };
  documents: PortalDocument[];
}

const DOC_LABELS: Record<string, string> = {
  photo_id: 'Photo ID',
  ssn_card: 'SSN Card',
  tb_test: 'TB Test',
  cpr_cert: 'CPR Certification',
  drivers_license: "Driver's License",
  background_check_consent: 'Background Check Consent',
  employment_eligibility: 'Employment Eligibility (I-9)',
};

const STATUS_STYLE: Record<PortalDocument['status'], { label: string; color: string; bg: string }> = {
  requested: { label: 'Needed', color: '#8A4B12', bg: '#FBEFE0' },
  submitted: { label: 'Submitted — under review', color: '#1D4ED8', bg: '#EFF6FF' },
  verified: { label: 'Verified', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: 'Rejected — please re-upload', color: '#96222E', bg: '#F8ECE8' },
};

const ACCEPTED = '.jpg,.jpeg,.png,.webp,.pdf';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The applicant's own portal (token = their interview session token): finish
 * the AI interview and upload every requested onboarding document. This page
 * is what makes the admin-side "request document" flow real. Styled with the
 * shared public agency brand shell (public-brand.tsx).
 */
export function ApplicantPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalState | null>(null);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/portal/${token ?? ''}`);
      if (!res.ok) {
        setError('This portal link is not valid. Please use the link from your application.');
        return;
      }
      setPortal((await res.json()) as PortalState);
    } catch {
      setError('Network error. Please refresh to try again.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (doc: PortalDocument, file: File) => {
    setRowError((prev) => ({ ...prev, [doc.id]: '' }));
    if (file.size > MAX_BYTES) {
      setRowError((prev) => ({ ...prev, [doc.id]: 'File is larger than 5 MB.' }));
      return;
    }
    setUploadingId(doc.id);
    try {
      const res = await fetch(
        `/api/onboarding/portal/${token ?? ''}/documents/${doc.id}?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        },
      );
      if (!res.ok) {
        let msg = 'Upload failed. Please try again.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) msg = body.message;
        } catch { /* keep default */ }
        setRowError((prev) => ({ ...prev, [doc.id]: msg }));
        return;
      }
      await load();
    } catch {
      setRowError((prev) => ({ ...prev, [doc.id]: 'Network error. Please try again.' }));
    } finally {
      setUploadingId(null);
    }
  };

  if (error) {
    return (
      <div className="pub-root" style={{ display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
        <PublicBrandStyles />
        <div className="pub-panel" style={{ maxWidth: 420, textAlign: 'center', color: 'var(--pub-body-c)' }}>{error}</div>
      </div>
    );
  }
  if (!portal) {
    return (
      <div className="pub-root" style={{ display: 'grid', placeItems: 'center' }}>
        <PublicBrandStyles />
        <span style={{ color: 'var(--pub-faint, #8A7B74)' }}>Loading your portal…</span>
      </div>
    );
  }

  const interviewDone = portal.interview.status === 'completed';

  return (
    <div className="pub-root">
      <PublicBrandStyles />

      <nav className="pub-nav" aria-label="Main">
        <span className="pub-nav-name">
          <AgencyMark size={30} />
          <span>{portal.agencyName}</span>
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--pub-faint)' }}>Applicant portal</span>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.25rem, 4vw, 2rem) 3rem' }}>
        <p className="pub-eyebrow">Your application</p>
        <h1 className="pub-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>
          Welcome, {portal.applicant.firstName}.
        </h1>
        <p style={{ margin: '0.7rem 0 0', color: 'var(--pub-body-c)', fontSize: '0.95rem' }}>
          {portal.applicant.position} ·{' '}
          <strong style={{ textTransform: 'capitalize', color: 'var(--pub-ink)' }}>
            {portal.applicant.status.replace(/_/g, ' ')}
          </strong>
        </p>

        <section className="pub-panel" style={{ marginTop: '1.8rem' }}>
          <h2 className="pub-display" style={{ fontSize: '1.25rem', marginBottom: '0.6rem' }}>
            <span style={{ color: 'var(--pub-brand)', fontStyle: 'italic', fontWeight: 500 }}>01</span> · Your interview
          </h2>
          {interviewDone ? (
            <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>
              ✓ Interview complete. Thanks — the team will review your responses.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 1rem', color: 'var(--pub-body-c)', fontSize: '0.93rem', lineHeight: 1.6 }}>
                A short guided interview ({portal.interview.questionsRemaining} question
                {portal.interview.questionsRemaining === 1 ? '' : 's'} remaining). It takes about ten minutes.
              </p>
              <Link to={`/interview/${token}`} className="pub-btn pub-btn-primary" style={{ padding: '0.65rem 1.35rem', fontSize: '0.88rem' }}>
                {portal.interview.status === 'pending' ? 'Start interview' : 'Continue interview'}
              </Link>
            </>
          )}
        </section>

        <section className="pub-panel" style={{ marginTop: '1.1rem' }}>
          <h2 className="pub-display" style={{ fontSize: '1.25rem', marginBottom: '0.6rem' }}>
            <span style={{ color: 'var(--pub-brand)', fontStyle: 'italic', fontWeight: 500 }}>02</span> · Your documents
          </h2>
          <p style={{ margin: '0 0 1.1rem', color: 'var(--pub-body-c)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Upload a clear photo or PDF of each item (max 5 MB). You can re-upload anything that gets rejected.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {portal.documents.map((doc) => {
              const style = STATUS_STYLE[doc.status];
              const canUpload = doc.status === 'requested' || doc.status === 'rejected';
              return (
                <div key={doc.id} style={{ border: '1px solid var(--pub-line)', borderRadius: 14, padding: '0.9rem 1.05rem', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--pub-ink)' }}>{DOC_LABELS[doc.documentType] ?? doc.documentType}</div>
                      {doc.fileName && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--pub-faint)' }}>Uploaded: {doc.fileName}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="pub-pill" style={{ color: style.color, background: style.bg }}>
                        {style.label}
                      </span>
                      {canUpload && (
                        <>
                          <input
                            ref={(el) => { fileInputs.current[doc.id] = el; }}
                            type="file"
                            accept={ACCEPTED}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void upload(doc, f);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingId === doc.id}
                            onClick={() => fileInputs.current[doc.id]?.click()}
                            className="pub-btn pub-btn-ghost"
                            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', opacity: uploadingId === doc.id ? 0.6 : 1 }}
                          >
                            {uploadingId === doc.id ? 'Uploading…' : doc.status === 'rejected' ? 'Re-upload' : 'Upload'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {rowError[doc.id] && (
                    <div role="alert" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--pub-brand)' }}>
                      {rowError[doc.id]}
                    </div>
                  )}
                </div>
              );
            })}
            {portal.documents.length === 0 && (
              <p style={{ margin: 0, color: 'var(--pub-faint)' }}>No documents have been requested yet.</p>
            )}
          </div>
        </section>

        <p style={{ textAlign: 'center', marginTop: '1.9rem', fontSize: '0.75rem', color: 'var(--pub-faint)' }}>
          Keep this page's link private — it is your access to this application.
        </p>
      </div>
    </div>
  );
}
