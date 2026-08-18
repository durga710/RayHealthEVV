import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJson, postJson, patchJson } from '../../lib/api-client.js';

interface Applicant {
  id: string;
  agencyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  status: string;
  appliedAt?: string;
  updatedAt?: string;
  adminNotes?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Interview {
  id: string;
  applicantId: string;
  sessionToken: string;
  messages: ChatMessage[];
  aiSummary?: string;
  aiScore?: number;
  status: string;
  completedAt?: string;
}

interface Document {
  id: string;
  applicantId: string;
  documentType: string;
  status: string;
  requestedAt?: string;
  submittedAt?: string;
  verifiedAt?: string;
  /** Present once the applicant has uploaded through their portal. */
  fileName?: string;
}

interface DetailResponse {
  applicant: Applicant;
  interview: Interview | null;
  documents: Document[];
}

type ApplicantStatus =
  | 'applied'
  | 'interviewing'
  | 'interview_complete'
  | 'under_review'
  | 'offered'
  | 'hired'
  | 'rejected';

const STATUS_OPTIONS: { value: ApplicantStatus; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'interview_complete', label: 'Interview Complete' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'offered', label: 'Offered' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
];

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'photo_id', label: 'Photo ID' },
  { value: 'ssn_card', label: 'SSN Card' },
  { value: 'tb_test', label: 'TB Test' },
  { value: 'cpr_cert', label: 'CPR Certification' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'background_check_consent', label: 'Background Check Consent' },
  { value: 'employment_eligibility', label: 'Employment Eligibility (I-9)' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  applied: { bg: 'var(--color-info-bg)', text: 'var(--color-primary-dark)' },
  interviewing: { bg: 'var(--color-accent-bg)', text: 'var(--color-accent-dark)' },
  interview_complete: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  under_review: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  offered: { bg: 'var(--color-primary-bg)', text: 'var(--color-primary-dark)' },
  hired: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  rejected: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' },
  requested: { bg: 'var(--color-surface-soft)', text: 'var(--color-text-secondary)' },
  submitted: { bg: 'var(--color-accent-bg)', text: 'var(--color-accent-dark)' },
  verified: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
};

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const notesSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [docWorking, setDocWorking] = useState<Record<string, boolean>>({});
  const [portalCopied, setPortalCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const resp = await getJson<DetailResponse>(`/api/admin/onboarding/applicants/${id}`);
      setData(resp);
      setNotesValue(resp.applicant.adminNotes ?? '');
    } catch {
      setError('Failed to load applicant details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (newStatus: ApplicantStatus) => {
    if (!data || !id) return;
    setStatusUpdating(true);
    try {
      const updated = await patchJson<Applicant>(
        `/api/admin/onboarding/applicants/${id}/status`,
        { status: newStatus, adminNotes: notesValue || undefined }
      );
      setData((prev) => (prev ? { ...prev, applicant: updated } : prev));
    } catch {
      void load();
    } finally {
      setStatusUpdating(false);
    }
  };

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!id || !data) return;
      try {
        await patchJson<Applicant>(`/api/admin/onboarding/applicants/${id}/status`, {
          status: data.applicant.status as ApplicantStatus,
          adminNotes: notes,
        });
      } catch {
        // Notes save failure is non-critical
      }
    },
    [id, data]
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotesValue(val);
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
    notesSaveTimeout.current = setTimeout(() => {
      void saveNotes(val);
    }, 1200);
  };

  const handleNotesBlur = () => {
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
    void saveNotes(notesValue);
  };

  const handleHire = async () => {
    if (!id || hiring) return;
    if (!window.confirm('Hire this applicant? This will create a caregiver record.')) return;
    setHiring(true);
    try {
      await postJson<{ success: boolean; caregiverId: string }>(
        `/api/admin/onboarding/applicants/${id}/hire`,
        {}
      );
      void navigate('/admin/staff');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hire failed.';
      setError(msg);
    } finally {
      setHiring(false);
    }
  };

  const requestDocument = async (documentType: string) => {
    if (!id) return;
    setDocWorking((prev) => ({ ...prev, [documentType]: true }));
    try {
      const doc = await postJson<Document>(
        `/api/admin/onboarding/applicants/${id}/documents`,
        { documentType }
      );
      setData((prev) => (prev ? { ...prev, documents: [...prev.documents, doc] } : prev));
    } catch {
      // ignore
    } finally {
      setDocWorking((prev) => ({ ...prev, [documentType]: false }));
    }
  };

  const updateDocStatus = async (docId: string, docStatus: string) => {
    setDocWorking((prev) => ({ ...prev, [docId]: true }));
    try {
      const updated = await patchJson<Document>(
        `/api/admin/onboarding/documents/${docId}/status`,
        { status: docStatus }
      );
      setData((prev) =>
        prev
          ? { ...prev, documents: prev.documents.map((d) => (d.id === docId ? updated : d)) }
          : prev
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update document status.';
      setError(msg);
    } finally {
      setDocWorking((prev) => ({ ...prev, [docId]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-danger-text)' }}>{error}</div>
    );
  }

  if (!data) return null;

  const { applicant, interview, documents } = data;
  const statusColor = statusColors[applicant.status] ?? { bg: 'var(--color-surface-soft)', text: 'var(--color-text-secondary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back + header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void navigate('/admin/onboarding')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            background: 'transparent',
            boxShadow: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: '1.375rem',
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            flex: 1,
          }}
        >
          {applicant.firstName} {applicant.lastName}
        </h1>
        <span
          style={{
            backgroundColor: statusColor.bg,
            color: statusColor.text,
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {formatStatus(applicant.status)}
        </span>
        {applicant.status !== 'hired' && (
          <button
            type="button"
            onClick={() => void handleHire()}
            disabled={hiring}
            style={{
              padding: '0.5rem 1.25rem',
              background: 'var(--color-success)',
              color: 'var(--color-on-brand)',
              opacity: hiring ? 0.55 : 1,
              border: 'none',
              boxShadow: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: hiring ? 'wait' : 'pointer',
            }}
          >
            {hiring ? 'Hiring…' : 'Hire'}
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Applicant info */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Applicant Info
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Email', value: applicant.email },
                { label: 'Phone', value: applicant.phone ?? '-' },
                { label: 'Position', value: applicant.position },
                { label: 'Applied', value: formatDate(applicant.appliedAt) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', flexShrink: 0 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              ))}
              {interview && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', flexShrink: 0 }}>Portal</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/applicant/${interview.sessionToken}`,
                      );
                      setPortalCopied(true);
                      window.setTimeout(() => setPortalCopied(false), 2000);
                    }}
                    style={{
                      padding: '0.25rem 0.6rem',
                      backgroundColor: portalCopied ? 'var(--color-success-bg)' : 'var(--color-surface-soft)',
                      color: portalCopied ? 'var(--color-success-text)' : 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {portalCopied ? 'Copied!' : 'Copy applicant portal link'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status change */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Update Status
            </h2>
            <select
              value={applicant.status}
              disabled={statusUpdating}
              onChange={(e) => void handleStatusChange(e.target.value as ApplicantStatus)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
                cursor: statusUpdating ? 'wait' : 'pointer',
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Admin notes */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Admin Notes
            </h2>
            <textarea
              value={notesValue}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
              rows={4}
              placeholder="Internal notes (auto-saved)…"
              style={{
                width: '100%',
                resize: 'vertical',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-subtle)' }}>
              Auto-saved on blur
            </p>
          </div>

          {/* Document checklist */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Documents
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {DOCUMENT_TYPES.map((dt) => {
                const doc = documents.find((d) => d.documentType === dt.value);
                const busy = !!docWorking[doc?.id ?? dt.value];
                const docColor = doc
                  ? (statusColors[doc.status] ?? { bg: 'var(--color-surface-soft)', text: 'var(--color-text-secondary)' })
                  : null;
                return (
                  <div
                    key={dt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', flex: 1 }}>
                      {dt.label}
                    </span>
                    {doc ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: docColor?.bg ?? 'var(--color-surface-soft)',
                            color: docColor?.text ?? 'var(--color-text-secondary)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}
                        >
                          {formatStatus(doc.status)}
                        </span>
                        {doc.fileName && (
                          <a
                            href={`/api/admin/onboarding/documents/${doc.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            title={doc.fileName}
                            style={{
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'var(--color-info-bg)',
                              color: 'var(--color-primary-dark)',
                              border: '1px solid var(--color-info-border)',
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            View
                          </a>
                        )}
                        {doc.status !== 'verified' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void updateDocStatus(doc.id, 'verified')}
                            style={{
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'var(--color-success-bg)',
                              color: 'var(--color-success-text)',
                              border: '1px solid var(--color-success-border)',
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              cursor: busy ? 'wait' : 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            Verify
                          </button>
                        )}
                        {doc.status !== 'rejected' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void updateDocStatus(doc.id, 'rejected')}
                            style={{
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'var(--color-danger-bg)',
                              color: 'var(--color-danger-text)',
                              border: '1px solid var(--color-danger-border)',
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              cursor: busy ? 'wait' : 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!!docWorking[dt.value]}
                        onClick={() => void requestDocument(dt.value)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          backgroundColor: 'var(--color-info-bg)',
                          color: 'var(--color-primary-dark)',
                          border: '1px solid var(--color-primary-light)',
                          borderRadius: '5px',
                          fontSize: '0.7rem',
                          cursor: docWorking[dt.value] ? 'wait' : 'pointer',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        Request
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column. Interview transcript + AI summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* AI summary card */}
          {interview?.aiSummary && (
            <div
              style={{
                backgroundColor: 'var(--color-info-bg)',
                borderRadius: '10px',
                border: '1px solid var(--color-primary-light)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-primary-dark)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  AI Interview Summary
                </h2>
                {interview.aiScore !== undefined && (
                  <span
                    style={{
                      backgroundColor:
                        interview.aiScore >= 7
                          ? 'var(--color-success-bg)'
                          : interview.aiScore >= 5
                            ? 'var(--color-warning-bg)'
                            : 'var(--color-danger-bg)',
                      color:
                        interview.aiScore >= 7
                          ? 'var(--color-success-text)'
                          : interview.aiScore >= 5
                            ? 'var(--color-warning-text)'
                            : 'var(--color-danger-text)',
                      padding: '0.2rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                    }}
                  >
                    Score: {interview.aiScore}/10
                  </span>
                )}
              </div>
              <p
                style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
              >
                {interview.aiSummary}
              </p>
            </div>
          )}

          {/* Interview transcript */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Interview Transcript
              </h2>
              {interview && (
                <span
                  style={{
                    backgroundColor: statusColors[interview.status]?.bg ?? 'var(--color-surface-soft)',
                    color: statusColors[interview.status]?.text ?? 'var(--color-text-secondary)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  {formatStatus(interview.status)}
                </span>
              )}
            </div>

            {!interview || interview.messages.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--color-text-subtle)',
                  fontSize: '0.875rem',
                }}
              >
                No interview messages yet.
              </div>
            ) : (
              <div
                style={{
                  padding: '1rem',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  backgroundColor: 'var(--color-bg)',
                }}
              >
                {interview.messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '0.6rem 0.875rem',
                        borderRadius:
                          m.role === 'user'
                            ? '12px 12px 3px 12px'
                            : '12px 12px 12px 3px',
                        backgroundColor: m.role === 'user' ? 'var(--color-primary-dark)' : 'white',
                        color: m.role === 'user' ? 'white' : 'var(--color-text)',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        border: m.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
