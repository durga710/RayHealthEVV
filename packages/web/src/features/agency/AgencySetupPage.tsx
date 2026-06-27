import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getJson, putJson } from '../../lib/api-client.js';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FormField } from '@/components/patterns/form-field';
import { Spinner } from '@/components/ui/spinner';

interface Agency {
  id: string;
  name: string;
  state: string;
}

type SaveMessage = { kind: 'ok' | 'error'; text: string };

export function AgencySetupPage() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<SaveMessage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<Agency>('/api/agencies/current')
      .then((data) => {
        setAgency(data);
        setName(data.name);
      })
      .catch((err) => {
        console.error('Failed to load agency', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const updated = await putJson<Agency>('/api/agencies/current', { name });
      setAgency(updated);
      setName(updated.name);
      setMessage({ kind: 'ok', text: 'Agency updated successfully' });
    } catch {
      setMessage({ kind: 'error', text: 'Failed to update agency' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        Loading…
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agency Setup"
        description="Configure your Pennsylvania agency details and operating tracks."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" aria-hidden />
            Agency Details
          </CardTitle>
          <CardDescription>Update your agency name and review your operating state.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Agency Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter agency name"
                required
              />
            </FormField>

            <FormField label="State">
              <Input value={agency?.state || 'PA'} disabled />
            </FormField>

            <Button type="submit" className="w-full sm:w-auto">
              Save Changes
            </Button>
          </form>

          {message && (
            <Alert
              variant={message.kind === 'ok' ? 'success' : 'destructive'}
              className="mt-4"
            >
              {message.kind === 'ok' ? (
                <AlertDescription>{message.text}</AlertDescription>
              ) : (
                <>
                  <AlertTitle>Could not save.</AlertTitle>
                  <AlertDescription>{message.text}</AlertDescription>
                </>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
