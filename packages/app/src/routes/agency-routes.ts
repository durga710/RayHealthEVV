import { Router } from 'express';
import { z } from 'zod';
import { AgencyRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

/**
 * Billing-provider identity for the 837 claim. Every field optional so admins
 * can fill the Billing & Clearinghouse profile incrementally; format is still
 * validated when a value is provided. Completeness for a sendable claim is
 * enforced at 837-generation time, not here.
 */
const billingIdentitySchema = z
  .object({
    billingNpi: z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits'),
    billingTaxId: z.string().regex(/^\d{2}-?\d{7}$/, 'Tax ID (EIN) must be 9 digits'),
    billingAddress1: z.string().min(1).max(100),
    billingCity: z.string().min(1).max(100),
    billingState: z.string().regex(/^[A-Za-z]{2}$/, 'State must be a 2-letter code'),
    billingPostalCode: z.string().regex(/^\d{5}(-?\d{4})?$/, 'ZIP must be 5 or 9 digits'),
    billingTaxonomy: z.string().regex(/^[A-Za-z0-9]{10}$/, 'Taxonomy must be 10 characters'),
    clearinghouseId: z.string().max(64),
    medicaidProviderNumber: z.string().max(32),
  })
  .partial();

/** Return only the authenticated admin's own agency, never cross-agency data. */
router.get('/', requireCapability('agency.read'), async (req, res) => {
  if (req.auth.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  try {
    const agency = await new AgencyRepository(req.app.get('db')).findById(req.auth.agencyId);
    if (!agency) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json([{ id: agency.id, name: agency.name }]);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/current', requireCapability('agency.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const agency = await new AgencyRepository(db).findById(req.auth.agencyId);
    if (!agency) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json({ id: agency.id, name: agency.name, state: agency.state });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/current', requireCapability('agency.write'), async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (name.trim().length > 200) {
    res.status(400).json({ message: 'name must be 200 characters or fewer' });
    return;
  }
  try {
    const db = req.app.get('db');
    const updated = await new AgencyRepository(db).updateName(req.auth.agencyId, name);
    if (!updated) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json({ id: updated.id, name: updated.name, state: updated.state });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Fee schedule: cents per billing unit keyed by PA HCPCS service code.
const PA_SERVICE_CODES = ['T1019', 'S5125', 'T1004', 'T1021'] as const;
const feeScheduleSchema = z.record(
  z.enum(PA_SERVICE_CODES),
  z.number().int().min(0).max(1_000_000),
);

// GET /agencies/current/fee-schedule, cents per unit, by service code.
router.get('/current/fee-schedule', requireCapability('billing.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const rates = await new AgencyRepository(db).getFeeSchedule(req.auth.agencyId);
    res.json(rates);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT /agencies/current/fee-schedule, replace the fee schedule (admin only).
router.put('/current/fee-schedule', requireCapability('agency.write'), async (req, res) => {
  const parsed = feeScheduleSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: 'Fee schedule must map PA service codes to non-negative integer cents',
      issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  try {
    const db = req.app.get('db');
    const updated = await new AgencyRepository(db).updateFeeSchedule(req.auth.agencyId, parsed.data);
    if (!updated) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /agencies/current/billing, the agency's 837 billing-provider identity.
router.get('/current/billing', requireCapability('agency.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const identity = await new AgencyRepository(db).getBillingIdentity(req.auth.agencyId);
    if (!identity) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json(identity);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT /agencies/current/billing, update the 837 billing-provider identity.
router.put('/current/billing', requireCapability('agency.write'), async (req, res) => {
  const parsed = billingIdentitySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid billing profile',
      issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  try {
    const db = req.app.get('db');
    const updated = await new AgencyRepository(db).updateBillingIdentity(
      req.auth.agencyId,
      parsed.data,
    );
    if (!updated) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
