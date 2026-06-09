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
import { Label } from '@/components/ui/label';

interface Agency {
  id: string;
  name: string;
  state: string;
}

export function AgencySetupPage() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<Agency>('/api/agencies/current')
      .then(data => {
        setAgency(data);
        setName(data.name);
      })
      .catch(err => {
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
    } catch (err) {
      setMessage({ kind: 'error', text: 'Failed to update agency' });
    }
  };

  if (loading) return <div>Loading...</div>;

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
            <div className="space-y-1.5">
              <Label htmlFor="name">Agency Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter agency name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={agency?.state || 'PA'} disabled />
            </div>

            <Button type="submit" className="w-full sm:w-auto">
              Save Changes
            </Button>
          </form>

          {message && (
            <div
              role="status"
              className={
                message.kind === 'ok'
                  ? 'mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                  : 'mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
              }
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
