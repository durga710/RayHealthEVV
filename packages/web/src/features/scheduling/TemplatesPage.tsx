import React, { useMemo, useState } from 'react';
import { ClipboardList, LayoutTemplate, ListChecks } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postJson, HttpError } from '../../lib/api-client.js';
import { useApiResource } from '../../lib/use-api-resource.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/patterns/form-field';
import { SearchInput } from '@/components/patterns/search-input';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

/**
 * Template tasks are stored as loose JSONB: templates created in-app store
 * task duty ids (`string`), while seeded/imported templates may store
 * `{ id, label }` objects. The display tolerates both shapes.
 */
type TemplateTask = string | { id: string; label: string };

interface Template {
  id: string;
  clientId: string;
  name: string;
  tasks: TemplateTask[];
}

interface PATask {
  id: string;
  duty: string;
}

interface NewTemplateInput {
  clientId: string;
  name: string;
  tasks: string[];
}

const TEMPLATES_KEY = ['templates'];
const TASKS_KEY = ['tasks'];

export function TemplatesPage() {
  const queryClient = useQueryClient();

  const {
    data: templatesData,
    isLoading: templatesLoading,
    isError: templatesError,
    refetch: refetchTemplates,
  } = useApiResource<Template[]>(TEMPLATES_KEY, '/api/templates');
  const templates = templatesData ?? [];

  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useApiResource<PATask[]>(TASKS_KEY, '/api/tasks');
  const availableTasks = tasksData ?? [];

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [taskError, setTaskError] = useState('');
  const [query, setQuery] = useState('');

  const createTemplate = useMutation({
    mutationFn: (input: NewTemplateInput) => postJson<Template>('/api/templates', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
      setClientId('');
      setName('');
      setSelectedTasks(new Set());
      setTaskError('');
      toast.success('Template created successfully.');
    },
    onError: (error) => {
      toast.error(
        error instanceof HttpError ? error.message : 'Failed to create template. Please try again.',
      );
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, query]);

  const handleTaskToggle = (duty: string) => {
    setTaskError('');
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(duty)) {
        next.delete(duty);
      } else {
        next.add(duty);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tasks = Array.from(selectedTasks);
    if (tasks.length === 0) {
      setTaskError('Please select at least one task.');
      return;
    }
    createTemplate.mutate({ clientId, name, tasks });
  };

  const columns: DataTableColumn<Template>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (t) => t.name.toLowerCase(),
      cell: (t) => <span className="font-medium text-foreground">{t.name}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      sortValue: (t) => t.clientId,
      cell: (t) => (
        <span className="tabular-nums text-muted-foreground">{t.clientId.slice(0, 6)}…</span>
      ),
    },
    {
      id: 'tasks',
      header: 'Tasks',
      cell: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.tasks.map((task) => {
            const id = typeof task === 'string' ? task : task.id;
            const label = typeof task === 'string' ? task : task.label;
            return (
              <Badge key={id} variant="secondary">
                {label}
              </Badge>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visit Templates"
        description="Create and manage plan-of-care visit templates."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" aria-hidden />
              New Template
            </CardTitle>
            <CardDescription>Build a reusable plan-of-care visit template.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormField label="Client ID" required>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} required />
              </FormField>

              <FormField label="Template Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Routine"
                  required
                />
              </FormField>

              <FormField label="Select Tasks" error={taskError || undefined}>
                <div className="flex max-h-[300px] flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                  {tasksLoading ? (
                    <span className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                      <Spinner size="sm" /> Loading tasks…
                    </span>
                  ) : tasksError ? (
                    <Alert variant="destructive">
                      <AlertDescription className="flex items-center justify-between gap-3">
                        Couldn’t load tasks.
                        <Button variant="outline" size="sm" onClick={() => void refetchTasks()}>
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : availableTasks.length === 0 ? (
                    <span className="px-2 py-1 text-sm text-muted-foreground">
                      No tasks available.
                    </span>
                  ) : (
                    availableTasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selectedTasks.has(task.duty)}
                          onChange={() => handleTaskToggle(task.duty)}
                        />
                        <span>
                          {task.id} - {task.duty}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </FormField>

              <Button type="submit" disabled={createTemplate.isPending} className="w-full sm:w-auto">
                {createTemplate.isPending ? 'Creating…' : 'Create Template'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="size-5 text-primary" aria-hidden />
                Template Library
              </CardTitle>
              <CardDescription>
                {templates.length} {templates.length === 1 ? 'template' : 'templates'}
              </CardDescription>
            </div>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search templates…"
              aria-label="Search templates"
              className="w-full sm:w-56"
            />
          </CardHeader>
          <CardContent>
            {templatesError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-3">
                  Couldn’t load templates.
                  <Button variant="outline" size="sm" onClick={() => void refetchTemplates()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(t) => t.id}
                isLoading={templatesLoading}
                pageSize={10}
                empty={{
                  icon: ListChecks,
                  title: query ? 'No matching templates' : 'No templates yet',
                  description: query
                    ? `No templates match “${query}”.`
                    : 'Create your first template to get started.',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
