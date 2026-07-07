import { Router } from 'express';
import Stripe from 'stripe';
import { AgencyRepository } from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';

const router = Router();

const TIER_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  growth: process.env.STRIPE_PRICE_GROWTH ?? '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
}

// GET /billing/status, subscription state for the authenticated agency.
router.get('/status', authContext, async (req, res) => {
  try {
    const repo = new AgencyRepository(req.app.get('db'));
    const billing = await repo.getBillingStatus(req.auth.agencyId);
    res.json(billing ?? { stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: null, subscriptionTier: null });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /billing/checkout-session, creates a Stripe Checkout session.
// Body: { tier: string, successUrl: string, cancelUrl: string }
router.post('/checkout-session', authContext, async (req, res) => {
  const { tier, successUrl, cancelUrl } = req.body ?? {};
  if (!tier || !(tier in TIER_PRICE_IDS) || !TIER_PRICE_IDS[tier as string]) {
    res.status(400).json({ message: 'Valid tier required (starter, growth, enterprise)' });
    return;
  }
  if (!successUrl || !cancelUrl) {
    res.status(400).json({ message: 'successUrl and cancelUrl required' });
    return;
  }

  try {
    const sdk = getStripe();
    const repo = new AgencyRepository(req.app.get('db'));
    const billing = await repo.getBillingStatus(req.auth.agencyId);

    let customerId = billing?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const agency = await repo.findById(req.auth.agencyId);
      const customer = await sdk.customers.create({
        metadata: { agencyId: req.auth.agencyId, agencyName: agency?.name ?? '' },
      });
      customerId = customer.id;
      await repo.updateBilling(req.auth.agencyId, { stripeCustomerId: customerId });
    }

    const session = await sdk.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: TIER_PRICE_IDS[tier as string], quantity: 1 }],
      success_url: successUrl as string,
      cancel_url: cancelUrl as string,
      metadata: { agencyId: req.auth.agencyId, tier: tier as string },
      subscription_data: { metadata: { agencyId: req.auth.agencyId, tier: tier as string } },
    });

    res.json({ url: session.url });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /billing/portal, returns a Stripe Customer Portal URL.
router.get('/portal', authContext, async (req, res) => {
  const returnUrl = (req.query.returnUrl as string | undefined)
    ?? `${process.env.APP_URL ?? 'https://rayhealthevv.com'}/admin`;

  try {
    const repo = new AgencyRepository(req.app.get('db'));
    const billing = await repo.getBillingStatus(req.auth.agencyId);

    if (!billing?.stripeCustomerId) {
      res.status(404).json({ message: 'No billing account. Start a subscription first.' });
      return;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /billing/webhook. Stripe webhook. This route is mounted BEFORE
// express.json() so req.body is the raw Buffer Stripe needs for signature
// verification. See app.ts for the special mounting order.
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ message: 'Webhook secret not configured' }); return; }
  if (!sig) { res.status(400).json({ message: 'Missing stripe-signature header' }); return; }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as string, sig, secret);
  } catch {
    res.status(400).json({ message: 'Webhook signature verification failed' });
    return;
  }

  const repo = new AgencyRepository(req.app.get('db'));

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const agencyId = session.metadata?.agencyId;
      const tier = session.metadata?.tier;
      const subId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null;
      if (agencyId && subId) {
        await repo.updateBilling(agencyId, {
          stripeSubscriptionId: subId,
          subscriptionStatus: 'active',
          subscriptionTier: tier,
        });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const agencyId = sub.metadata?.agencyId;
      if (agencyId) await repo.updateBilling(agencyId, { subscriptionStatus: sub.status });
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const agencyId = sub.metadata?.agencyId;
      if (agencyId) {
        await repo.updateBilling(agencyId, {
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: undefined,
        });
      }
    }

    res.json({ received: true });
  } catch {
    res.status(500).json({ message: 'Webhook handler error' });
  }
});

export default router;
