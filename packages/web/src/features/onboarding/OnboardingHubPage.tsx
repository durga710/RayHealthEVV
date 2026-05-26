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
  applied: { bg: '#EEF2FF', text: '#6d28d9' },
  interviewing: { bg: '#FFF7ED', text: '#C2410C' },
  interview_complete: { bg: '#F0FDF4', text: '#15803D' },
  under_review: { bg: '#FEF9C3', text: '#A16207' },
  offered: { bg: '#F0F9FF', text: '#0369A1' },
  hired: { bg: '#F0FDF4', text: '#15803D' },
  rejected: { bg: '#FFF1F2', text: '#BE123C' },
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
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            Onboarding Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748B', fontSize: '0.875rem' }}>
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
            backgroundColor: '#EEF2FF',
            color: '#6d28d9',
            border: '1px solid #C7D2FE',
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
              border: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#0F172A',
                letterSpacing: '-0.02em',
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.125rem' }}>
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
          borderBottom: '1px solid #E2E8F0',
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
                  activeTab === tab.value ? '2px solid #6d28d9' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === tab.value ? '#6d28d9' : '#64748B',
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
                    backgroundColor: activeTab === tab.value ? '#EEF2FF' : '#F1F5F9',
                    color: activeTab === tab.value ? '#6d28d9' : '#64748B',
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
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#BE123C' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
            No applicants in this category.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                {['Name', 'Email', 'Position', 'Applied', 'Status', 'Score'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.625rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#64748B',
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
                const colors = statusColors[a.status] ?? { bg: '#F1F5F9', text: '#475569' };
                return (
                  <tr
                    key={a.id}
                    onClick={() => void navigate(`/admin/onboarding/${a.id}`)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#F8FAFC';
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
                        color: '#0F172A',
                      }}
                    >
                      {a.firstName} {a.lastName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#475569' }}>
                      {a.email}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#475569' }}>
                      {a.position}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#64748B' }}>
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
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#64748B' }}>
                      {a.aiScore ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              a.aiScore >= 7
                                ? '#15803D'
                                : a.aiScore >= 5
                                  ? '#A16207'
                                  : '#BE123C',
                          }}
                        >
                          {a.aiScore}/10
                        </span>
                      ) : (
                        '—'
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
