import { useEffect, useMemo, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';

interface LearningCourse {
  id: string;
  code: string;
  title: string;
  cadence: CourseCadence;
  required: boolean;
  expiresAfterDays: number | null;
}

interface Caregiver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface EnrollCaregiverModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided, restricts the caregiver picker to this single caregiver. */
  lockedCaregiverId?: string | null;
}

/**
 * Default due-date offset by cadence — smart defaults that coordinators can override.
 *   one_time / certification: due in 30 days (give them time to schedule it)
 *   annual / biennial:        due in 90 days (lenient, matches typical agency policy)
 */
function defaultDueDateFor(cadence: CourseCadence): string {
  const daysAhead = cadence === 'one_time' || cadence === 'certification' ? 30 : 90;
  const date = new Date(Date.now() + daysAhead * 86400000);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD for <input type="date">
}

export function EnrollCaregiverModal({
  open,
  onClose,
  onSuccess,
  lockedCaregiverId = null,
}: EnrollCaregiverModalProps) {
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedCaregiverIds, setSelectedCaregiverIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<string>('');
  const [caregiverSearch, setCaregiverSearch] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load courses + caregivers when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [coursesResp, staffResp] = await Promise.all([
          getJson<ApiResponse<LearningCourse[]>>('/api/learning/courses'),
          getJson<ApiResponse<Caregiver[]>>('/api/staff'),
        ]);
        if (cancelled) return;
        if (coursesResp.success && coursesResp.data) setCourses(coursesResp.data);
        if (staffResp.success && staffResp.data) {
          setCaregivers(staffResp.data.filter((c) => c.status === 'active'));
        }
        if (!coursesResp.success) setLoadError(coursesResp.error ?? 'Failed to load courses');
        else if (!staffResp.success) setLoadError(staffResp.error ?? 'Failed to load caregivers');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Pre-fill the locked caregiver when modal opens.
  useEffect(() => {
    if (open && lockedCaregiverId) {
      setSelectedCaregiverIds(new Set([lockedCaregiverId]));
    } else if (open) {
      setSelectedCaregiverIds(new Set());
    }
  }, [open, lockedCaregiverId]);

  // When course changes, update the smart due-date default.
  useEffect(() => {
    if (!selectedCourseId) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (course) {
      setDueDate(defaultDueDateFor(course.cadence));
    }
  }, [selectedCourseId, courses]);

  const filteredCaregivers = useMemo(() => {
    if (!caregiverSearch.trim()) return caregivers;
    const needle = caregiverSearch.toLowerCase();
    return caregivers.filter(
      (c) =>
        c.firstName.toLowerCase().includes(needle) ||
        c.lastName.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle),
    );
  }, [caregivers, caregiverSearch]);

  const toggleCaregiver = (id: string): void => {
    setSelectedCaregiverIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitError(null);
    if (!selectedCourseId) {
      setSubmitError('Pick a course first.');
      return;
    }
    if (selectedCaregiverIds.size === 0) {
      setSubmitError('Select at least one caregiver.');
      return;
    }

    setSubmitting(true);
    try {
      const ids = Array.from(selectedCaregiverIds);
      // Sequential enrollment so a single failure doesn't kill the whole batch.
      const failures: string[] = [];
      for (const caregiverId of ids) {
        try {
          await postJson('/api/learning/enroll', {
            caregiverId,
            courseId: selectedCourseId,
            dueAt: dueDate ? new Date(dueDate).toISOString() : null,
          });
        } catch (err) {
          failures.push(`${caregiverId}: ${err instanceof Error ? err.message : 'failed'}`);
        }
      }
      if (failures.length > 0) {
        setSubmitError(`Some enrollments failed: ${failures.join('; ')}`);
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={modalStyle}>
        <header style={headerStyle}>
          <h2 id="enroll-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Enroll caregivers in a course
          </h2>
          <button onClick={onClose} aria-label="Close" style={closeBtnStyle}>×</button>
        </header>

        {loading && <p style={{ padding: '1rem 1.5rem' }}>Loading…</p>}

        {loadError && (
          <div style={errorBoxStyle}>
            <strong>Could not load modal data.</strong> {loadError}
          </div>
        )}

        {!loading && !loadError && (
          <div style={bodyStyle}>
            {/* Course picker */}
            <section style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle} htmlFor="enroll-course">Course</label>
              <select
                id="enroll-course"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select a course —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.required ? '(required)' : ''}
                  </option>
                ))}
              </select>
            </section>

            {/* Due date */}
            <section style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle} htmlFor="enroll-due">
                Due date <span style={mutedStyle}>(smart default; override if needed)</span>
              </label>
              <input
                id="enroll-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle}
              />
            </section>

            {/* Caregiver picker */}
            <section>
              <label style={labelStyle}>
                Caregivers <span style={mutedStyle}>({selectedCaregiverIds.size} selected of {caregivers.length})</span>
              </label>
              {!lockedCaregiverId && (
                <input
                  type="search"
                  placeholder="Search by name or email…"
                  value={caregiverSearch}
                  onChange={(e) => setCaregiverSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '0.5rem' }}
                />
              )}
              <div style={caregiverListStyle}>
                {filteredCaregivers.length === 0 && (
                  <p style={{ padding: '0.75rem', margin: 0, color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
                    No active caregivers match.
                  </p>
                )}
                {filteredCaregivers.map((c) => {
                  const isSelected = selectedCaregiverIds.has(c.id);
                  const isLocked = lockedCaregiverId === c.id;
                  return (
                    <label
                      key={c.id}
                      style={{ ...caregiverRowStyle, backgroundColor: isSelected ? '#E6F1FB' : 'transparent' }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isLocked || submitting}
                        onChange={() => toggleCaregiver(c.id)}
                      />
                      <span style={{ flex: 1, marginLeft: '0.6rem' }}>
                        <strong>{c.firstName} {c.lastName}</strong>
                        <span style={{ color: 'var(--color-text-muted, #64748b)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                          {c.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {submitError && (
              <div style={{ ...errorBoxStyle, margin: '1rem 0 0' }}>{submitError}</div>
            )}
          </div>
        )}

        <footer style={footerStyle}>
          <button onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>Cancel</button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !selectedCourseId || selectedCaregiverIds.size === 0}
            style={primaryButtonStyle}
          >
            {submitting
              ? 'Enrolling…'
              : selectedCaregiverIds.size > 1
                ? `Enroll ${selectedCaregiverIds.size} caregivers`
                : 'Enroll'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: '1rem',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '560px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #e2e8f0',
};

const bodyStyle: React.CSSProperties = {
  padding: '1.5rem',
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  color: 'var(--color-text-muted, #475569)',
  marginBottom: '0.4rem',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const mutedStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #94a3b8)',
  fontWeight: 400,
  fontSize: '0.8rem',
};

const caregiverListStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  maxHeight: '240px',
  overflowY: 'auto',
};

const caregiverRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.55rem 0.75rem',
  borderBottom: '1px solid #f1f5f9',
  cursor: 'pointer',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  color: 'var(--color-text-muted, #64748b)',
  padding: 0,
  lineHeight: 1,
  width: '32px',
  height: '32px',
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#185FA5',
  color: '#ffffff',
  border: 'none',
  padding: '0.55rem 1.1rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#475569',
  border: '1px solid #cbd5e1',
  padding: '0.55rem 1.1rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
  cursor: 'pointer',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  margin: '0 1.5rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
  fontSize: '0.9rem',
};
