/**
 * SandboxProvider — deterministic in-memory PSP for development & tests.
 *
 *   - `createPayment` returns an "initiated" payment; the caller triggers
 *     capture explicitly via `simulateCapture(...)` or via a webhook.
 *   - Never touches any real network / money.
 *   - Provides a `simulateWebhook(...)` helper the tests + admin dev routes
 *     use to feed events into `/payments/webhook` exactly like a real PSP.
 */

import crypto from 'node:crypto';
import type {
  PaymentProvider, CreatePaymentInput, ProviderPayment,
  RefundInput, ProviderRefund, CreateBeneficiaryInput, ProviderBeneficiary,
  CreatePayoutInput, ProviderPayout, WebhookVerifyInput, VerifiedWebhook,
} from './payment-provider.js';

const WEBHOOK_SECRET = 'sandbox-webhook-secret';

interface Row {
  providerPaymentId: string;
  status: ProviderPayment['status'];
  amountHalalahs: bigint;
  currency: string;
  orderRef: string;
  refundedHalalahs: bigint;
}

const payments = new Map<string, Row>();
const refunds  = new Map<string, ProviderRefund & { paymentId: string; amountHalalahs: bigint }>();
const beneficiaries = new Map<string, ProviderBeneficiary>();
const payouts = new Map<string, ProviderPayout>();

export class SandboxProvider implements PaymentProvider {
  readonly name = 'sandbox' as const;

  async createPayment(input: CreatePaymentInput): Promise<ProviderPayment> {
    const id = `sb_pay_${crypto.randomBytes(6).toString('hex')}`;
    payments.set(id, {
      providerPaymentId: id, status: 'initiated',
      amountHalalahs: input.amountHalalahs, currency: input.currency,
      orderRef: input.orderRef, refundedHalalahs: 0n,
    });
    return { providerPaymentId: id, status: 'initiated', redirectUrl: `sandbox://checkout/${id}` };
  }

  async getPayment(id: string): Promise<ProviderPayment> {
    const row = payments.get(id);
    if (!row) throw new Error(`sandbox: unknown payment ${id}`);
    return { providerPaymentId: id, status: row.status };
  }

  async verifyPayment(id: string): Promise<ProviderPayment> { return this.getPayment(id); }

  async refundPayment(input: RefundInput): Promise<ProviderRefund> {
    const row = payments.get(input.providerPaymentId);
    if (!row) throw new Error(`sandbox: unknown payment ${input.providerPaymentId}`);
    if (row.status !== 'captured') throw new Error(`sandbox: refund requires captured payment`);
    const remaining = row.amountHalalahs - row.refundedHalalahs;
    if (input.amountHalalahs > remaining) throw new Error('sandbox: refund exceeds remaining');
    row.refundedHalalahs += input.amountHalalahs;
    const id = `sb_ref_${crypto.randomBytes(6).toString('hex')}`;
    const r: ProviderRefund & { paymentId: string; amountHalalahs: bigint } = {
      providerRefundId: id, status: 'completed',
      paymentId: input.providerPaymentId, amountHalalahs: input.amountHalalahs,
    };
    refunds.set(id, r);
    return { providerRefundId: id, status: 'completed' };
  }

  async createBeneficiary(input: CreateBeneficiaryInput): Promise<ProviderBeneficiary> {
    const id = `sb_ben_${crypto.randomBytes(4).toString('hex')}`;
    const ibanMasked = input.iban.slice(0, 6) + '****' + input.iban.slice(-4);
    const b: ProviderBeneficiary = { providerBeneficiaryId: id, status: 'active', ibanMasked };
    beneficiaries.set(id, b); return b;
  }
  async getBeneficiary(id: string): Promise<ProviderBeneficiary> {
    const b = beneficiaries.get(id); if (!b) throw new Error('sandbox: unknown beneficiary'); return b;
  }

  async createPayout(input: CreatePayoutInput): Promise<ProviderPayout> {
    const id = `sb_out_${crypto.randomBytes(4).toString('hex')}`;
    const p: ProviderPayout = { providerPayoutId: id, status: 'paid' };
    payouts.set(id, p); return p;
  }
  async getPayout(id: string): Promise<ProviderPayout> {
    const p = payouts.get(id); if (!p) throw new Error('sandbox: unknown payout'); return p;
  }

  async verifyWebhook(input: WebhookVerifyInput): Promise<VerifiedWebhook> {
    const raw = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
    const sig = input.headers['x-sandbox-signature'];
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
    if (sig !== expected) throw new Error('sandbox: bad webhook signature');
    const evt = JSON.parse(raw) as SandboxWebhook;
    return {
      externalEventId: evt.id,
      eventType: evt.type,
      paymentId: evt.orderRef,
      providerPaymentId: evt.providerPaymentId,
      status: evt.status,
      amountHalalahs: evt.amountHalalahs ? BigInt(evt.amountHalalahs) : undefined,
      currency: evt.currency,
      raw: evt,
    };
  }
}

// ---------------- Test / dev helpers (exported for the /admin/dev/webhook route + tests) ----------------

export interface SandboxWebhook {
  id: string;
  type: 'payment.captured' | 'payment.failed' | 'refund.completed';
  providerPaymentId: string;
  orderRef?: string;
  status?: string;
  amountHalalahs?: string; // stringified bigint
  currency?: string;
}

export function simulateCapture(providerPaymentId: string): SandboxWebhook {
  const row = payments.get(providerPaymentId);
  if (!row) throw new Error(`sandbox: unknown payment ${providerPaymentId}`);
  row.status = 'captured';
  return {
    id: `evt_${crypto.randomBytes(6).toString('hex')}`,
    type: 'payment.captured',
    providerPaymentId,
    orderRef: row.orderRef,
    status: 'captured',
    amountHalalahs: row.amountHalalahs.toString(),
    currency: row.currency,
  };
}

export function simulateFailure(providerPaymentId: string): SandboxWebhook {
  const row = payments.get(providerPaymentId);
  if (!row) throw new Error(`sandbox: unknown payment ${providerPaymentId}`);
  row.status = 'failed';
  return {
    id: `evt_${crypto.randomBytes(6).toString('hex')}`,
    type: 'payment.failed',
    providerPaymentId,
    orderRef: row.orderRef,
    status: 'failed',
    amountHalalahs: row.amountHalalahs.toString(),
    currency: row.currency,
  };
}

export function signWebhook(payload: SandboxWebhook): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return { body, signature };
}

/** Test-only: wipe internal state. */
export function _resetSandbox() {
  payments.clear(); refunds.clear(); beneficiaries.clear(); payouts.clear();
}
