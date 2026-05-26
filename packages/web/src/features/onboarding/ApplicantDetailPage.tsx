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
  applied: { bg: '#EEF2FF', text: '#6d28d9' },
  interviewing: { bg: '#FFF7ED', text: '#C2410C' },
  interview_complete: { bg: '#F0FDF4', text: '#15803D' },
  under_review: { bg: '#FEF9C3', text: '#A16207' },
  offered: { bg: '#F0F9FF', text: '#0369A1' },
  hired: { bg: '#F0FDF4', text: '#15803D' },
  rejected: { bg: '#FFF1F2', text: '#BE123C' },
  requested: { bg: '#F1F5F9', text: '#475569' },
  submitted: { bg: '#FFF7ED', text: '#C2410C' },
  verified: { bg: '#F0FDF4', text: '#15803D' },
};

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
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
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Loading…</div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#BE123C' }}>{error}</div>
    );
  }

  if (!data) return null;

  const { applicant, interview, documents } = data;
  const statusColor = statusColors[applicant.status] ?? { bg: '#F1F5F9', text: '#475569' };

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
            backgroundColor: 'transparent',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#475569',
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
            color: '#0F172A',
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
              backgroundColor: hiring ? '#BBF7D0' : '#16A34A',
              color: 'white',
              border: 'none',
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
            backgroundColor: '#FFF1F2',
            color: '#BE123C',
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
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Applicant Info
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Email', value: applicant.email },
                { label: 'Phone', value: applicant.phone ?? '—' },
                { label: 'Position', value: applicant.position },
                { label: 'Applied', value: formatDate(applicant.appliedAt) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#94A3B8', flexShrink: 0 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#0F172A', textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status change */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#64748B',
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
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: '#0F172A',
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
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#64748B',
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
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: '#0F172A',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#94A3B8' }}>
              Auto-saved on blur
            </p>
          </div>

          {/* Document checklist */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#64748B',
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
                  ? (statusColors[doc.status] ?? { bg: '#F1F5F9', text: '#475569' })
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
                    <span style={{ fontSize: '0.875rem', color: '#0F172A', flex: 1 }}>
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
                            backgroundColor: docColor?.bg ?? '#F1F5F9',
                            color: docColor?.text ?? '#475569',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}
                        >
                          {formatStatus(doc.status)}
                        </span>
                        {doc.status !== 'verified' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void updateDocStatus(doc.id, 'verified')}
                            style={{
                              padding: '0.2rem 0.5rem',
                              backgroundColor: '#F0FDF4',
                              color: '#15803D',
                              border: '1px solid #BBF7D0',
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
                              backgroundColor: '#FFF1F2',
                              color: '#BE123C',
                              border: '1px solid #FECDD3',
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
                          backgroundColor: '#EEF2FF',
                          color: '#6d28d9',
                          border: '1px solid #C7D2FE',
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

        {/* Right column — Interview transcript + AI summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* AI summary card */}
          {interview?.aiSummary && (
            <div
              style={{
                backgroundColor: '#EEF2FF',
                borderRadius: '10px',
                border: '1px solid #C7D2FE',
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
                    color: '#6d28d9',
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
                          ? '#F0FDF4'
                          : interview.aiScore >= 5
                            ? '#FEF9C3'
                            : '#FFF1F2',
                      color:
                        interview.aiScore >= 7
                          ? '#15803D'
                          : interview.aiScore >= 5
                            ? '#A16207'
                            : '#BE123C',
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
                style={{ margin: 0, fontSize: '0.9rem', color: '#374151', lineHeight: 1.6 }}
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
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #E2E8F0',
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
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Interview Transcript
              </h2>
              {interview && (
                <span
                  style={{
                    backgroundColor: statusColors[interview.status]?.bg ?? '#F1F5F9',
                    color: statusColors[interview.status]?.text ?? '#475569',
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
                  color: '#94A3B8',
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
                  backgroundColor: '#F8FAFC',
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
                        backgroundColor: m.role === 'user' ? '#6d28d9' : 'white',
                        color: m.role === 'user' ? 'white' : '#0F172A',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        border: m.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
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
