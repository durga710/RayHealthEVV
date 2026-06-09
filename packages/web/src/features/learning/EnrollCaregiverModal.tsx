import { useEffect, useMemo, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Enroll caregivers in a course</DialogTitle>
          <DialogDescription>
            Select a course and the caregivers who should be enrolled.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="px-6 py-4 text-sm text-muted-foreground">Loading…</p>}

        {loadError && (
          <div
            role="alert"
            className="mx-6 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <strong>Could not load modal data.</strong> {loadError}
          </div>
        )}

        {!loading && !loadError && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
            {/* Course picker */}
            <div className="space-y-1.5">
              <Label htmlFor="enroll-course">Course</Label>
              <Select
                id="enroll-course"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                <option value="">— Select a course —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.required ? '(required)' : ''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label htmlFor="enroll-due">
                Due date{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  (smart default; override if needed)
                </span>
              </Label>
              <Input
                id="enroll-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Caregiver picker */}
            <div className="space-y-1.5">
              <Label>
                Caregivers{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({selectedCaregiverIds.size} selected of {caregivers.length})
                </span>
              </Label>
              {!lockedCaregiverId && (
                <Input
                  type="search"
                  placeholder="Search by name or email…"
                  value={caregiverSearch}
                  onChange={(e) => setCaregiverSearch(e.target.value)}
                />
              )}
              <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                {filteredCaregivers.length === 0 && (
                  <p className="m-0 px-3 py-3 text-sm text-muted-foreground">
                    No active caregivers match.
                  </p>
                )}
                {filteredCaregivers.map((c) => {
                  const isSelected = selectedCaregiverIds.has(c.id);
                  const isLocked = lockedCaregiverId === c.id;
                  return (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center border-b border-border px-3 py-2 last:border-b-0 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isLocked || submitting}
                        onChange={() => toggleCaregiver(c.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="ml-3 flex-1 text-sm">
                        <strong>{c.firstName} {c.lastName}</strong>
                        <span className="ml-2 text-muted-foreground">{c.email}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {submitError}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !selectedCourseId || selectedCaregiverIds.size === 0}
          >
            {submitting
              ? 'Enrolling…'
              : selectedCaregiverIds.size > 1
                ? `Enroll ${selectedCaregiverIds.size} caregivers`
                : 'Enroll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
