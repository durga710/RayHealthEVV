import { useEffect, useMemo, useState } from 'react';
import { postJson } from '../../lib/api-client.js';
import { useApiResource } from '../../lib/use-api-resource.js';
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
import { FormField } from '@/components/patterns/form-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

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
  const coursesQuery = useApiResource<ApiResponse<LearningCourse[]>>(
    ['learning', 'courses'],
    '/api/learning/courses',
    { enabled: open },
  );
  const staffQuery = useApiResource<ApiResponse<Caregiver[]>>(['staff'], '/api/staff', {
    enabled: open,
  });

  const courses = useMemo(
    () => (coursesQuery.data?.success ? coursesQuery.data.data ?? [] : []),
    [coursesQuery.data],
  );
  const caregivers = useMemo(() => {
    const list = staffQuery.data?.success ? staffQuery.data.data ?? [] : [];
    return list.filter((c) => c.status === 'active');
  }, [staffQuery.data]);

  const loading = open && (coursesQuery.isLoading || staffQuery.isLoading);
  const loadErrorMessage =
    coursesQuery.isError || (coursesQuery.data && !coursesQuery.data.success)
      ? coursesQuery.data?.error ?? 'Failed to load courses'
      : staffQuery.isError || (staffQuery.data && !staffQuery.data.success)
        ? staffQuery.data?.error ?? 'Failed to load caregivers'
        : null;
  const retryLoad = (): void => {
    void coursesQuery.refetch();
    void staffQuery.refetch();
  };

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedCaregiverIds, setSelectedCaregiverIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<string>('');
  const [caregiverSearch, setCaregiverSearch] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

        {loading && (
          <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
            <Spinner size="sm" />
            Loading courses and caregivers…
          </div>
        )}

        {!loading && loadErrorMessage && (
          <div className="px-6 py-4">
            <Alert variant="destructive">
              <AlertTitle>Could not load modal data</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                {loadErrorMessage}
                <Button variant="outline" size="sm" onClick={retryLoad}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {!loading && !loadErrorMessage && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
            <FormField label="Course">
              <Select
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
            </FormField>

            <FormField label="Due date" hint="Smart default; override if needed">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>

            {/* Caregiver multi-select — not a single labelable control, so wired with a plain Label. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enroll-caregiver-search">
                Caregivers{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({selectedCaregiverIds.size} selected of {caregivers.length})
                </span>
              </Label>
              {!lockedCaregiverId && (
                <Input
                  id="enroll-caregiver-search"
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
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
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
