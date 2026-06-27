import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, GraduationCap } from 'lucide-react';
import { useApiResource } from '../../lib/use-api-resource.js';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/patterns/empty-state';
import { SearchInput } from '@/components/patterns/search-input';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [query, setQuery] = useState('');

  const { data: envelope, isLoading, isError, refetch } = useApiResource<
    ApiResponse<LearningCourse[]>
  >(['learning-courses'], '/api/learning/courses');

  const courses = envelope?.success ? envelope.data ?? [] : [];
  const loadFailed = isError || (envelope !== undefined && !envelope.success);
  const errorMessage =
    envelope && !envelope.success ? envelope.error : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => `${c.title} ${c.code}`.toLowerCase().includes(q));
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

      {loadFailed ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load courses.</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorMessage ?? 'Something went wrong while loading the catalog.'}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`course-skeleton-${i}`} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {courses.length > 0 && (
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search courses…"
              aria-label="Search courses"
              className="mb-6 w-full sm:w-72"
            />
          )}

          {courses.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No courses in the catalog yet"
              description="Seed the PA-required baseline with: npx tsx packages/core/scripts/seed-learning-catalog.ts"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No matching courses"
              description={`No courses match “${query}”.`}
            />
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
