import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { postJson, getJson } from '../../lib/api-client.js';

interface CourseSection {
  title: string;
  content: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface CourseModules {
  objectives: string[];
  sections: CourseSection[];
  note?: string | null;
  videoSearchQuery?: string | null;
  videoUrl?: string | null;
  quiz?: QuizQuestion[] | null;
}

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: string;
  required: boolean;
  durationMinutes: number;
  expiresAfterDays: number | null;
  externalUrl: string | null;
  modules: CourseModules | null;
}

interface Enrollment {
  id: string;
  courseId: string;
  status: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
}

interface ProgressData {
  caregiverId: string;
  enrollments: Array<{ enrollment: Enrollment; course: Course }>;
}

type QuizState = 'active' | 'passed' | 'failed';

const CADENCE_LABEL: Record<string, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  biennial: 'Every 2 years',
  certification: 'Certification',
};

const PASS_THRESHOLD = 0.8;

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const backBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#7c3aed',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  padding: '0 0 1.25rem',
  display: 'block',
};

function VideoPlayer({ videoUrl, onPlay }: { videoUrl: string; onPlay?: () => void }) {
  const [started, setStarted] = useState(false);

  const handleStart = () => {
    setStarted(true);
    onPlay?.();
  };

  // Normalize watch URLs to nocookie embed URLs
  const embedUrl = videoUrl
    .replace('https://www.youtube.com/watch?v=', 'https://www.youtube-nocookie.com/embed/')
    .replace('https://youtu.be/', 'https://www.youtube-nocookie.com/embed/');

  if (!started) {
    return (
      <div
        style={{
          position: 'relative',
          paddingBottom: '56.25%',
          background: '#0F172A',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '1.25rem',
          cursor: 'pointer',
        }}
        onClick={handleStart}
        role="button"
        aria-label="Play training video"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleStart()}
      >
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '0.75rem',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(124, 58, 237,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', fontWeight: 600 }}>
            Play Training Video
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem' }}>
      <iframe
        src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Training video"
      />
    </div>
  );
}

interface QuizProps {
  questions: QuizQuestion[];
  onPass: () => void;
}

function Quiz({ questions, onPass }: QuizProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizState, setQuizState] = useState<QuizState>('active');
  const [wrongIndexes, setWrongIndexes] = useState<Set<number>>(new Set());

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  const handleSubmit = () => {
    let correct = 0;
    const wrong = new Set<number>();
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) {
        correct++;
      } else {
        wrong.add(i);
      }
    });

    const score = correct / questions.length;
    if (score >= PASS_THRESHOLD) {
      setQuizState('passed');
      onPass();
    } else {
      setWrongIndexes(wrong);
      setQuizState('failed');
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setWrongIndexes(new Set());
    setQuizState('active');
  };

  const correctCount = questions.filter((q, i) => answers[i] === q.correct).length;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9375rem' }}>Knowledge Check</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>
              {questions.length} questions · Pass {Math.round(PASS_THRESHOLD * 100)}% to complete this course
            </div>
          </div>
        </div>

        {quizState === 'passed' ? (
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏅</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#15803D', marginBottom: '0.25rem' }}>
              Quiz Passed!
            </div>
            <div style={{ fontSize: '0.875rem', color: '#16A34A' }}>
              {correctCount} of {questions.length} correct — course is now marked complete.
            </div>
          </div>
        ) : (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {quizState === 'failed' && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#DC2626',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span>✗</span>
                <span>
                  {correctCount} of {questions.length} correct — {Math.round(PASS_THRESHOLD * 100)}% required to pass.
                  Review the highlighted questions and try again.
                </span>
              </div>
            )}

            {questions.map((q, qi) => {
              const isWrong = wrongIndexes.has(qi);
              const selected = answers[qi];

              return (
                <div key={qi} style={{
                  background: isWrong ? '#FFF7F7' : 'white',
                  border: `1px solid ${isWrong ? '#FECACA' : '#E2E8F0'}`,
                  borderRadius: '10px', padding: '1rem 1.25rem',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                    <span style={{ color: '#94A3B8', marginRight: '0.4rem' }}>{qi + 1}.</span>
                    {q.question}
                    {isWrong && (
                      <span style={{ marginLeft: '0.5rem', color: '#EF4444', fontSize: '0.8rem', fontWeight: 500 }}>
                        — Correct: {q.options[q.correct]}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {q.options.map((opt, oi) => {
                      const isSelected = selected === oi;
                      const isCorrectOpt = quizState === 'failed' && isWrong && oi === q.correct;
                      const isWrongSelection = quizState === 'failed' && isWrong && isSelected && oi !== q.correct;

                      let optBg = isSelected ? '#EEF2FF' : 'transparent';
                      let optBorder = isSelected ? '#ddd6fe' : '#E2E8F0';
                      let optColor = isSelected ? '#4338CA' : '#334155';

                      if (isCorrectOpt) { optBg = '#F0FDF4'; optBorder = '#BBF7D0'; optColor = '#15803D'; }
                      if (isWrongSelection) { optBg = '#FEF2F2'; optBorder = '#FECACA'; optColor = '#DC2626'; }

                      return (
                        <label
                          key={oi}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                            padding: '0.6rem 0.75rem',
                            background: optBg, border: `1px solid ${optBorder}`,
                            borderRadius: '7px', cursor: quizState === 'active' ? 'pointer' : 'default',
                            fontSize: '0.875rem', color: optColor, lineHeight: 1.4,
                          }}
                        >
                          <input
                            type="radio"
                            name={`q-${qi}`}
                            value={oi}
                            checked={isSelected}
                            disabled={quizState !== 'active'}
                            onChange={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                            style={{ marginTop: '2px', flexShrink: 0, accentColor: '#7c3aed' }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {quizState === 'active' && (
                <button
                  type="button"
                  disabled={!allAnswered}
                  onClick={handleSubmit}
                  style={{
                    padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.9375rem',
                    color: '#fff', background: allAnswered ? '#7c3aed' : '#CBD5E1',
                    border: 'none', borderRadius: '8px', cursor: allAnswered ? 'pointer' : 'not-allowed',
                  }}
                >
                  Submit Answers
                </button>
              )}
              {quizState === 'failed' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.9375rem',
                    color: '#fff', background: '#7c3aed',
                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<{ enrollment: Enrollment; course: Course } | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completedNow, setCompletedNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [quizPassed, setQuizPassed] = useState(false);

  useEffect(() => {
    getJson<{ success: boolean; data: ProgressData }>('/api/learning/progress')
      .then((r) => {
        const found = r.data.enrollments.find((e) => e.course.id === courseId) ?? null;
        setItem(found);
      })
      .catch(() => setError('Failed to load course'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleMarkComplete = async () => {
    if (!item) return;
    setCompleting(true);
    setError(null);
    try {
      await postJson('/api/learning/complete', {
        enrollmentId: item.enrollment.id,
        courseId: item.course.id,
      });
      setCompletedNow(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setCompleting(false);
    }
  };

  const handleQuizPass = () => {
    setQuizPassed(true);
    void handleMarkComplete();
  };

  const trackStarted = () => {
    if (!item) return;
    postJson('/api/learning/start', { enrollmentId: item.enrollment.id }).catch(() => {});
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748B' }}>
        Loading course…
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <button type="button" onClick={() => navigate('/portal/training')} style={backBtnStyle}>
          ← Back to My Training
        </button>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '2rem', color: '#DC2626', textAlign: 'center' }}>
          Course not found or you are not enrolled.
        </div>
      </div>
    );
  }

  const { course, enrollment } = item;
  const mods = course.modules;
  const isCompleted = completedNow || enrollment.status === 'completed';
  const isInProgress = !isCompleted && enrollment.status === 'in_progress';
  const hasQuiz = !!(mods?.quiz && mods.quiz.length > 0);
  const hasVideo = !!mods?.videoUrl;
  const canMarkComplete = !hasQuiz || quizPassed;

  return (
    <div style={{ maxWidth: '720px' }}>
      <button type="button" onClick={() => navigate('/portal/training')} style={backBtnStyle}>
        ← Back to My Training
      </button>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
        borderRadius: '14px',
        padding: '1.75rem 2rem',
        color: '#fff',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {course.required && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
              Required
            </span>
          )}
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(255,255,255,0.15)', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
            {CADENCE_LABEL[course.cadence] ?? course.cadence}
          </span>
          {isCompleted && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(134,239,172,0.3)', color: '#BBF7D0', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
              ✓ Completed
            </span>
          )}
          {isInProgress && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(254,215,170,0.3)', color: '#FED7AA', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
              In Progress
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem', lineHeight: 1.2 }}>{course.title}</h1>
        <p style={{ fontSize: '0.9rem', margin: 0, opacity: 0.85, lineHeight: 1.5 }}>{course.description}</p>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', opacity: 0.75, flexWrap: 'wrap' }}>
          <span>⏱ {course.durationMinutes} min</span>
          {enrollment.dueAt && <span>Due: {formatDate(enrollment.dueAt)}</span>}
          {enrollment.lastCompletedAt && <span>Completed: {formatDate(enrollment.lastCompletedAt)}</span>}
          {enrollment.expiresAt && <span>Cert expires: {formatDate(enrollment.expiresAt)}</span>}
          {course.expiresAfterDays && !enrollment.expiresAt && (
            <span>Valid {course.expiresAfterDays} days after completion</span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Learning objectives */}
      {mods?.objectives && mods.objectives.length > 0 && (
        <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0369A1', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Learning Objectives
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {mods.objectives.map((obj, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: '#0C4A6E', lineHeight: 1.55 }}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Important note */}
      {mods?.note && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '0.85rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#92400E', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
          <span>{mods.note}</span>
        </div>
      )}

      {/* Embedded training video */}
      {hasVideo && (
        <div style={{ marginBottom: '0.25rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748B', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Training Video
          </h2>
          <VideoPlayer videoUrl={mods!.videoUrl!} onPlay={trackStarted} />
        </div>
      )}

      {/* Course sections — accordion */}
      {mods?.sections && mods.sections.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Course Content — {mods.sections.length} Sections
            </h2>
            <button
              type="button"
              onClick={() => setOpenSection(openSection === null ? 0 : null)}
              style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600, cursor: 'pointer' }}
            >
              {openSection !== null ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {mods.sections.map((section, i) => {
              const isOpen = openSection === i;
              return (
                <div key={i} style={{ background: '#fff', border: `1px solid ${isOpen ? '#ddd6fe' : '#E2E8F0'}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? null : i)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '0.75rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: isOpen ? 'var(--color-primary, #7c3aed)' : '#F1F5F9',
                        color: isOpen ? '#fff' : '#64748B',
                        fontSize: '0.75rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>{section.title}</span>
                    </div>
                    <span style={{ color: '#94A3B8', fontSize: '0.875rem', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #F1F5F9' }}>
                      <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.8, margin: '1rem 0 0' }}>
                        {section.content}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Official resource link */}
      {course.externalUrl && (
        <div style={{ marginBottom: '1.5rem' }}>
          <a
            href={course.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackStarted}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.6rem 1.1rem', background: '#F8FAFC', color: '#334155',
              border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 600,
              fontSize: '0.875rem', textDecoration: 'none',
            }}
          >
            📋 Official Course Resource ↗
          </a>
        </div>
      )}

      {/* Knowledge check quiz — required to unlock completion */}
      {!isCompleted && hasQuiz && (
        <Quiz questions={mods!.quiz!} onPass={handleQuizPass} />
      )}

      {/* Completion footer */}
      <div style={{
        background: isCompleted ? '#F0FDF4' : '#F8FAFC',
        border: `1px solid ${isCompleted ? '#BBF7D0' : '#E2E8F0'}`,
        borderRadius: '12px', padding: '1.25rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div>
          {isCompleted ? (
            <>
              <div style={{ fontWeight: 700, color: '#15803D', fontSize: '1rem' }}>🏅 Training Complete</div>
              <div style={{ fontSize: '0.8125rem', color: '#16A34A', marginTop: '0.2rem' }}>
                Completed {formatDate(enrollment.lastCompletedAt)}
                {enrollment.expiresAt && ` · Expires ${formatDate(enrollment.expiresAt)}`}
              </div>
            </>
          ) : hasQuiz && !quizPassed ? (
            <>
              <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9375rem' }}>Pass the knowledge check to complete</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
                Answer all questions above — {Math.round(PASS_THRESHOLD * 100)}% correct required.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9375rem' }}>Ready to mark this course complete?</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
                Review all sections above, then confirm completion.
              </div>
            </>
          )}
        </div>
        {!isCompleted && canMarkComplete && !quizPassed && (
          <button
            type="button"
            disabled={completing}
            onClick={() => void handleMarkComplete()}
            style={{
              padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9375rem',
              color: '#fff', background: completing ? '#94A3B8' : 'var(--color-primary, #7c3aed)',
              border: 'none', borderRadius: '8px', cursor: completing ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {completing ? 'Saving…' : '✓ Mark Complete'}
          </button>
        )}
        {!isCompleted && completing && quizPassed && (
          <span style={{ fontSize: '0.875rem', color: '#64748B' }}>Saving…</span>
        )}
      </div>
    </div>
  );
}
