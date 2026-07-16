import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getJson, postJson, patchJson } from '../../lib/api-client.js';

/**
 * Admin course authoring, create or edit a learning course, including the
 * in-app content (objectives, lesson sections, training video) and the
 * knowledge-check quiz that gates completion. Mounted at
 *   /admin/learning/courses/new      (create)
 *   /admin/learning/courses/:id/edit (edit an agency-owned course)
 *
 * The shape written here matches the CourseModules domain type and the
 * caregiver-facing player in features/caregiver/CourseDetailPage.tsx, so any
 * content authored here renders for caregivers and its quiz auto-records
 * completion when passed.
 */

type Cadence = 'one_time' | 'semi_annual' | 'annual' | 'biennial' | 'certification';

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface Section {
  title: string;
  content: string;
}

interface CourseModules {
  objectives: string[];
  sections: Section[];
  note?: string;
  videoUrl?: string | null;
  quiz?: QuizQuestion[] | null;
}

interface Course {
  id: string;
  agencyId: string | null;
  code: string;
  title: string;
  description: string;
  cadence: Cadence;
  required: boolean;
  durationMinutes: number;
  expiresAfterDays: number | null;
  externalUrl: string | null;
  modules: CourseModules | null;
}

const CADENCES: Array<{ value: Cadence; label: string }> = [
  { value: 'one_time', label: 'One-time' },
  { value: 'annual', label: 'Annual' },
  { value: 'semi_annual', label: 'Every 6 months' },
  { value: 'biennial', label: 'Every 2 years' },
  { value: 'certification', label: 'Certification (expires)' },
];

const labelStyle: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem', display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', color: '#0F172A', background: '#fff' };
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' };
const sectionTitleStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.85rem' };
const smallBtn: React.CSSProperties = { padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '7px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#334155', cursor: 'pointer' };
const removeBtn: React.CSSProperties = { ...smallBtn, color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' };

export function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cadence, setCadence] = useState<Cadence>('annual');
  const [required, setRequired] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [expiresAfterDays, setExpiresAfterDays] = useState<string>('');
  const [externalUrl, setExternalUrl] = useState('');

  const [objectives, setObjectives] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [note, setNote] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (!isEdit) return;
    getJson<{ success: boolean; data: Course[] }>('/api/learning/courses')
      .then((r) => {
        const course = r.data.find((c) => c.id === id);
        if (!course) { setError('Course not found.'); return; }
        if (course.agencyId === null) { setError('Global courses are read-only and cannot be edited.'); return; }
        setCode(course.code);
        setTitle(course.title);
        setDescription(course.description);
        setCadence(course.cadence);
        setRequired(course.required);
        setDurationMinutes(course.durationMinutes);
        setExpiresAfterDays(course.expiresAfterDays != null ? String(course.expiresAfterDays) : '');
        setExternalUrl(course.externalUrl ?? '');
        const m = course.modules;
        if (m) {
          setObjectives(m.objectives ?? []);
          setSections(m.sections ?? []);
          setNote(m.note ?? '');
          setVideoUrl(m.videoUrl ?? '');
          setQuiz(m.quiz ?? []);
        }
      })
      .catch(() => setError('Failed to load course.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const buildModules = (): CourseModules | null => {
    const cleanObjectives = objectives.map((o) => o.trim()).filter(Boolean);
    const cleanSections = sections
      .map((s) => ({ title: s.title.trim(), content: s.content.trim() }))
      .filter((s) => s.title && s.content);
    const cleanQuiz = quiz
      .map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        correct: q.correct,
      }))
      .filter((q) => q.question && q.options.length >= 2);
    const hasContent =
      cleanObjectives.length > 0 || cleanSections.length > 0 || note.trim() || videoUrl.trim() || cleanQuiz.length > 0;
    if (!hasContent) return null;
    return {
      objectives: cleanObjectives,
      sections: cleanSections,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
      ...(cleanQuiz.length > 0 ? { quiz: cleanQuiz } : {}),
    };
  };

  const validate = (): string | null => {
    if (!code.trim()) return 'Course code is required.';
    if (!title.trim()) return 'Course title is required.';
    for (const q of quiz) {
      const opts = q.options.map((o) => o.trim()).filter(Boolean);
      if (q.question.trim() && opts.length < 2) return 'Each quiz question needs at least 2 options.';
      if (q.question.trim() && (q.correct < 0 || q.correct >= opts.length)) {
        return 'Each quiz question needs a correct answer selected.';
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSaving(true);
    const payload = {
      code: code.trim(),
      title: title.trim(),
      description: description.trim(),
      cadence,
      required,
      durationMinutes: Number(durationMinutes) || 0,
      expiresAfterDays: expiresAfterDays.trim() ? Number(expiresAfterDays) : null,
      externalUrl: externalUrl.trim() || null,
      modules: buildModules(),
    };
    try {
      if (isEdit) {
        await patchJson(`/api/learning/courses/${id}`, payload);
      } else {
        await postJson('/api/learning/courses', payload);
      }
      navigate('/admin/learning');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#64748B' }}>Loading course…</div>;
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <button
        type="button"
        onClick={() => navigate('/admin/learning')}
        style={{ background: 'none', border: 'none', color: '#107480', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', padding: '0 0 1rem' }}
      >
        ← Back to Learning Hub
      </button>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.35rem' }}>
        {isEdit ? 'Edit course' : 'New course'}
      </h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
        Build the lesson content and an optional knowledge-check quiz. Caregivers must pass the quiz (80%) to complete the course.
      </p>

      {error && (
        <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Basics */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Course details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle} htmlFor="code">Course code</label>
            <input id="code" style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ANNUAL-HIPAA" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="cadence">Cadence</label>
            <select id="cadence" style={inputStyle} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
              {CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle} htmlFor="title">Title</label>
          <input id="title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual HIPAA Privacy Refresher" />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle} htmlFor="description">Description</label>
          <textarea id="description" style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences shown in the catalog." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={labelStyle} htmlFor="duration">Duration (min)</label>
            <input id="duration" type="number" min={0} style={inputStyle} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="expires">Expires after (days)</label>
            <input id="expires" type="number" min={0} style={inputStyle} value={expiresAfterDays} onChange={(e) => setExpiresAfterDays(e.target.value)} placeholder="never" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#334155', cursor: 'pointer', paddingBottom: '0.55rem' }}>
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#107480' }} />
              Required for compliance
            </label>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle} htmlFor="externalUrl">Official resource URL (optional)</label>
          <input id="externalUrl" style={inputStyle} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>

      {/* Objectives */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Learning objectives</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {objectives.map((obj, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                style={inputStyle}
                value={obj}
                onChange={(e) => setObjectives((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                placeholder={`Objective ${i + 1}`}
              />
              <button type="button" style={removeBtn} onClick={() => setObjectives((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </div>
        <button type="button" style={{ ...smallBtn, marginTop: objectives.length ? '0.6rem' : 0 }} onClick={() => setObjectives((prev) => [...prev, ''])}>+ Add objective</button>
      </div>

      {/* Sections / lessons */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Lesson sections</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8' }}>Section {i + 1}</span>
                <button type="button" style={removeBtn} onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
              </div>
              <input
                style={{ ...inputStyle, marginBottom: '0.5rem' }}
                value={s.title}
                onChange={(e) => setSections((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder="Section title"
              />
              <textarea
                style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                value={s.content}
                onChange={(e) => setSections((prev) => prev.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                placeholder="Section content, what the caregiver reads."
              />
            </div>
          ))}
        </div>
        <button type="button" style={{ ...smallBtn, marginTop: sections.length ? '0.6rem' : 0 }} onClick={() => setSections((prev) => [...prev, { title: '', content: '' }])}>+ Add section</button>
      </div>

      {/* Video + note */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Video &amp; note</h2>
        <label style={labelStyle} htmlFor="videoUrl">Training video URL (YouTube, optional)</label>
        <input id="videoUrl" style={inputStyle} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        <label style={{ ...labelStyle, marginTop: '1rem' }} htmlFor="note">Important note (optional)</label>
        <textarea id="note" style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A highlighted callout shown above the content." />
      </div>

      {/* Quiz */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Knowledge check (quiz)</h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 0.85rem' }}>
          If you add questions, caregivers must score 80% to complete the course. Select the correct answer with the radio button.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {quiz.map((q, qi) => (
            <div key={qi} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8' }}>Question {qi + 1}</span>
                <button type="button" style={removeBtn} onClick={() => setQuiz((prev) => prev.filter((_, j) => j !== qi))}>Remove</button>
              </div>
              <input
                style={{ ...inputStyle, marginBottom: '0.6rem' }}
                value={q.question}
                onChange={(e) => setQuiz((prev) => prev.map((x, j) => (j === qi ? { ...x, question: e.target.value } : x)))}
                placeholder="Question text"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct === oi}
                      onChange={() => setQuiz((prev) => prev.map((x, j) => (j === qi ? { ...x, correct: oi } : x)))}
                      style={{ accentColor: '#107480', flexShrink: 0 }}
                      aria-label={`Mark option ${oi + 1} correct`}
                    />
                    <input
                      style={inputStyle}
                      value={opt}
                      onChange={(e) => setQuiz((prev) => prev.map((x, j) => (j === qi ? { ...x, options: x.options.map((o, k) => (k === oi ? e.target.value : o)) } : x)))}
                      placeholder={`Option ${oi + 1}`}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        style={removeBtn}
                        onClick={() => setQuiz((prev) => prev.map((x, j) => {
                          if (j !== qi) return x;
                          const options = x.options.filter((_, k) => k !== oi);
                          const correct = x.correct >= options.length ? options.length - 1 : x.correct;
                          return { ...x, options, correct };
                        }))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                style={{ ...smallBtn, marginTop: '0.5rem' }}
                onClick={() => setQuiz((prev) => prev.map((x, j) => (j === qi ? { ...x, options: [...x.options, ''] } : x)))}
              >
                + Add option
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          style={{ ...smallBtn, marginTop: quiz.length ? '0.6rem' : 0 }}
          onClick={() => setQuiz((prev) => [...prev, { question: '', options: ['', ''], correct: 0 }])}
        >
          + Add question
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
        <button type="button" style={{ ...smallBtn, padding: '0.6rem 1.25rem' }} onClick={() => navigate('/admin/learning')}>Cancel</button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          style={{ padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.9375rem', color: '#fff', background: saving ? '#94A3B8' : '#107480', border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create course'}
        </button>
      </div>
    </div>
  );
}
