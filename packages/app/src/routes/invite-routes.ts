import { Router, type Request, type Response } from 'express';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

interface Invite {
  id: string;
  agencyId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
}

// In-memory store (replaced by DB-backed repo when InviteRepository lands in core)
const inviteStore = new Map<string, Invite>();

router.post('/', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const { email, role } = req.body as { email?: string; role?: string };
  const invite: Invite = {
    id: crypto.randomUUID(),
    agencyId: req.auth.agencyId,
    email: email ?? '',
    role: role ?? '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  inviteStore.set(invite.id, invite);
  res.status(201).json(invite);
});

router.post('/:id/resend', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const invite = inviteStore.get(req.params.id as string);
  if (!invite) return res.status(404).json({ success: false, error: 'Invite not found' });
  if (invite.status !== 'pending') {
    return res.status(409).json({ success: false, error: `Cannot resend a ${invite.status} invite` });
  }
  res.json({ success: true, data: invite });
});

router.post('/:id/revoke', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const invite = inviteStore.get(req.params.id as string);
  if (!invite) return res.status(404).json({ success: false, error: 'Invite not found' });
  invite.status = 'revoked';
  res.json({ success: true, data: invite });
});

router.get('/', requireCapability('staff.read'), async (req: Request, res: Response) => {
  const agencyId = req.auth.agencyId;
  const list = Array.from(inviteStore.values())
    .filter(i => i.agencyId === agencyId)
    .map(({ id, agencyId: aid, email, role, status, createdAt }) => ({
      id,
      agencyId: aid,
      email,
      role,
      status,
      createdAt,
    }));
  res.json({ success: true, data: list });
});

export default router;

export { inviteStore };
