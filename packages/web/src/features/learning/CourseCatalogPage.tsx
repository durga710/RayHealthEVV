import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, GraduationCap, Search } from 'lucide-react';
import { getJson } from '../../lib/api-client.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';

interface LearningCourse {
  id: string;
  agencyId: string | null;
  code: string;
  title: string;
  description: string;
  cadence: CourseCadence;
  expiresAfterDays: number | null;
  required: boolean;
  durationMinutes: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const CADENCE_LABEL: Record<CourseCadence, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  biennial: 'Biennial',
  certification: 'Certification',
};

export function CourseCatalogPage() {
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<LearningCourse[]>>('/api/learning/courses');
        if (cancelled) return;
        if (response.success && response.data) {
          setCourses(response.data);
        } else {
          setError(response.error ?? 'Failed to load courses');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load courses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      `${c.title} ${c.code}`.toLowerCase().includes(q),
    );
  }, [courses, query]);

  return (
    <div>
      <PageHeader
        title="Course catalog"
        description="Training courses available to assign to caregivers."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/learning">
              <ArrowLeft className="size-4" aria-hidden />
              Back to Learning Hub
            </Link>
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <strong>Could not load courses.</strong> {error}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading courses…</p>}

      {!loading && !error && (
        <>
          {courses.length > 0 && (
            <div className="relative mb-6 w-full sm:w-72">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses…"
                className="pl-9"
                aria-label="Search courses"
              />
            </div>
          )}

          {courses.length === 0 ? (
            <EmptyState message="No courses in the catalog yet. Seed the PA-required baseline with: npx tsx packages/core/scripts/seed-learning-catalog.ts" />
          ) : filtered.length === 0 ? (
            <EmptyState message={`No courses match “${query}”.`} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((course) => (
                <Card key={course.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      {course.required && <Badge variant="warning">Required</Badge>}
                      {course.agencyId === null && <Badge variant="accent">Global</Badge>}
                      <Badge variant="secondary">{CADENCE_LABEL[course.cadence]}</Badge>
                    </div>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription>{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden />
                      {course.durationMinutes} min
                    </span>
                    {course.expiresAfterDays !== null && (
                      <span>Expires after {course.expiresAfterDays} days</span>
                    )}
                  </CardContent>
                  <CardFooter className="mt-auto justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{course.code}</span>
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/admin/learning/courses/${course.id}`}>View course</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <GraduationCap className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
