import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, LayoutTemplate, Search, ListChecks } from 'lucide-react';
import { getJson, postJson } from '../../lib/api-client.js';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Template {
  id: string;
  clientId: string;
  name: string;
  tasks: string[];
}

interface PATask {
  id: string;
  duty: string;
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [availableTasks, setAvailableTasks] = useState<PATask[]>([]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    getJson<Template[]>('/api/templates')
      .then((data) => setTemplates(data || []))
      .catch(console.error);

    getJson<PATask[]>('/api/tasks')
      .then((data) => setAvailableTasks(data || []))
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, query]);

  const handleTaskToggle = (duty: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(duty)) {
      newSelected.delete(duty);
    } else {
      newSelected.add(duty);
    }
    setSelectedTasks(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const tasks = Array.from(selectedTasks);
      if (tasks.length === 0) {
        setMessage('Please select at least one task');
        return;
      }
      const newTemplate = await postJson<Template>('/api/templates', { clientId, name, tasks });
      setTemplates((prev) => [...prev, newTemplate]);
      setClientId('');
      setName('');
      setSelectedTasks(new Set());
      setMessage('Template created successfully');
    } catch (err) {
      setMessage('Failed to create template');
    }
  };

  const isError = message === 'Please select at least one task' || message === 'Failed to create template';

  return (
    <div>
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Routine"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Select Tasks</Label>
                <div className="flex max-h-[300px] flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                  {availableTasks.length === 0 ? (
                    <span className="px-2 py-1 text-sm text-muted-foreground">Loading tasks…</span>
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
              </div>

              <Button type="submit" className="w-full sm:w-auto">
                Create Template
              </Button>
            </form>

            {message && (
              <div
                role="status"
                className={
                  isError
                    ? 'mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                    : 'mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                }
              >
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="size-5 text-primary" aria-hidden />
                Template Library
              </CardTitle>
              <CardDescription>
                {templates.length} {templates.length === 1 ? 'template' : 'templates'}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-56">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="pl-9"
                aria-label="Search templates"
              />
            </div>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <EmptyState message="No templates found. Create one to get started." />
            ) : filtered.length === 0 ? (
              <EmptyState message={`No templates match “${query}”.`} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Tasks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.clientId.slice(0, 6)}…
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {t.tasks.map((task, i) => (
                              <Badge key={i} variant="secondary">
                                {task}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <ListChecks className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
