/**
 * Moyasar adapter — INTENTIONAL STUB.
 *
 * Do NOT ship this to production before wiring the real Moyasar SDK / REST calls.
 * Requires a server-side secret (`MOYASAR_SECRET_KEY`) — never expose to the client.
 *
 * References for the real integration:
 *   Docs:     https://docs.moyasar.com/
 *   Webhooks: https://docs.moyasar.com/webhooks
 *   Refunds:  https://docs.moyasar.com/refunds
 */

import type {
  PaymentProvider, CreatePaymentInput, ProviderPayment,
  RefundInput, ProviderRefund, CreateBeneficiaryInput, ProviderBeneficiary,
  CreatePayoutInput, ProviderPayout, WebhookVerifyInput, VerifiedWebhook,
  SplitPaymentInput,
} from './payment-provider.js';
import { notImplemented } from '../errors.js';

export class MoyasarProvider implements PaymentProvider {
  readonly name = 'moyasar' as const;
  constructor(private readonly secretKey: string, private readonly webhookSecret: string) {
    if (!secretKey) {
      // Refuse to run un-configured; do NOT silently fall back to a mock.
      throw new Error('MOYASAR_SECRET_KEY is not configured');
    }
  }
  async createPayment(_input: CreatePaymentInput): Promise<ProviderPayment> { throw notImplemented('moyasar.createPayment: wire the real REST call'); }
  async createSplitPayment(_input: SplitPaymentInput): Promise<ProviderPayment> { throw notImplemented('moyasar.createSplitPayment: Moyasar does not offer native marketplace splits — implement post-capture payouts instead'); }
  async getPayment(_id: string): Promise<ProviderPayment>                     { throw notImplemented('moyasar.getPayment'); }
  async verifyPayment(_id: string): Promise<ProviderPayment>                  { throw notImplemented('moyasar.verifyPayment'); }
  async refundPayment(_input: RefundInput): Promise<ProviderRefund>           { throw notImplemented('moyasar.refundPayment'); }
  async createBeneficiary(_input: CreateBeneficiaryInput): Promise<ProviderBeneficiary> { throw notImplemented('moyasar.createBeneficiary'); }
  async getBeneficiary(_id: string): Promise<ProviderBeneficiary>             { throw notImplemented('moyasar.getBeneficiary'); }
  async createPayout(_input: CreatePayoutInput): Promise<ProviderPayout>      { throw notImplemented('moyasar.createPayout'); }
  async getPayout(_id: string): Promise<ProviderPayout>                       { throw notImplemented('moyasar.getPayout'); }
  async verifyWebhook(_input: WebhookVerifyInput): Promise<VerifiedWebhook>   { throw notImplemented('moyasar.verifyWebhook'); }
}
