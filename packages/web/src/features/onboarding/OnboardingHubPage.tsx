import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson } from '../../lib/api-client.js';

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
  adminNotes?: string;
  aiScore?: number;
}

type TabStatus =
  | 'all'
  | 'applied'
  | 'interviewing'
  | 'interview_complete'
  | 'under_review'
  | 'offered'
  | 'hired'
  | 'rejected';

const TABS: { label: string; value: TabStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Applied', value: 'applied' },
  { label: 'Interviewing', value: 'interviewing' },
  { label: 'Interview Complete', value: 'interview_complete' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Offered', value: 'offered' },
  { label: 'Hired', value: 'hired' },
  { label: 'Rejected', value: 'rejected' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  applied: { bg: 'var(--color-info-bg)', text: 'var(--color-primary-dark)' },
  interviewing: { bg: 'var(--color-accent-bg)', text: 'var(--color-accent-dark)' },
  interview_complete: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  under_review: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  offered: { bg: 'var(--color-primary-bg)', text: 'var(--color-primary-dark)' },
  hired: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  rejected: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' },
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

function thisMonthCount(applicants: Applicant[]): number {
  const now = new Date();
  return applicants.filter((a) => {
    if (!a.appliedAt) return false;
    const d = new Date(a.appliedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

export function OnboardingHubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabStatus>('all');
  const [copyMsg, setCopyMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getJson<Applicant[]>('/api/admin/onboarding/applicants');
      setApplicants(data);
    } catch {
      setError('Failed to load applicants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyApplicationLink = () => {
    if (!user?.agencyId) return;
    const link = `${window.location.origin}/apply/${user.agencyId}`;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopyMsg('Copied!');
        setTimeout(() => setCopyMsg(''), 2000);
      },
      () => {
        setCopyMsg('Could not copy');
        setTimeout(() => setCopyMsg(''), 2000);
      }
    );
  };

  const filtered =
    activeTab === 'all' ? applicants : applicants.filter((a) => a.status === activeTab);

  const hiredThisMonth = applicants.filter((a) => {
    if (a.status !== 'hired' || !a.appliedAt) return false;
    const d = new Date(a.appliedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const interviewsCompleted = applicants.filter((a) =>
    ['interview_complete', 'under_review', 'offered', 'hired', 'rejected'].includes(a.status)
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Onboarding Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Manage caregiver applications and hiring pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={copyApplicationLink}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-info-bg)',
            color: 'var(--color-primary-dark)',
            border: '1px solid var(--color-primary-light)',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.875rem',
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
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copyMsg || 'Copy Application Link'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Applied This Month', value: thisMonthCount(applicants) },
          { label: 'Interviews Completed', value: interviewsCompleted },
          { label: 'Hired This Month', value: hiredThisMonth },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'white',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          borderBottom: '1px solid var(--color-border)',
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? applicants.length
              : applicants.filter((a) => a.status === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: '0.5rem 0.875rem',
                border: 'none',
                borderBottom:
                  activeTab === tab.value ? '2px solid var(--color-primary-dark)' : '2px solid transparent',
                background: 'transparent',
                boxShadow: 'none',
                color: activeTab === tab.value ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                fontWeight: activeTab === tab.value ? 600 : 400,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    backgroundColor: activeTab === tab.value ? 'var(--color-info-bg)' : 'var(--color-surface-soft)',
                    color: activeTab === tab.value ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                    borderRadius: '9999px',
                    padding: '0 0.4rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    lineHeight: '1.4',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-danger-text)' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-subtle)' }}>
            No applicants in this category.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {['Name', 'Email', 'Position', 'Applied', 'Status', 'Score'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.625rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const colors = statusColors[a.status] ?? { bg: 'var(--color-surface-soft)', text: 'var(--color-text-secondary)' };
                return (
                  <tr
                    key={a.id}
                    onClick={() => void navigate(`/admin/onboarding/${a.id}`)}
                    style={{
                      borderBottom: '1px solid var(--color-surface-soft)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--color-bg)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: 'var(--color-text)',
                      }}
                    >
                      {a.firstName} {a.lastName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {a.email}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {a.position}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(a.appliedAt)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {formatStatus(a.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {a.aiScore ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              a.aiScore >= 7
                                ? 'var(--color-success-text)'
                                : a.aiScore >= 5
                                  ? 'var(--color-warning-text)'
                                  : 'var(--color-danger-text)',
                          }}
                        >
                          {a.aiScore}/10
                        </span>
                      ) : (
                        ', '
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
