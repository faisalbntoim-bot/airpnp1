/**
 * Tap adapter — INTENTIONAL STUB.
 *
 * Tap supports the marketplace / destinations model in real use (business
 * accounts, beneficiaries, split "destinations" and payouts). This file is a
 * SCAFFOLD ONLY — the real REST calls must be wired before Tap runs against
 * production. Configuration expected via environment variables:
 *
 *   TAP_SECRET_KEY        server-side secret; never exposed to clients
 *   TAP_WEBHOOK_SECRET    HMAC secret for webhook signature verification
 *   TAP_BASE_URL          e.g. https://api.tap.company (sandbox / production)
 *
 * Reference: https://developers.tap.company/
 */

import type {
  PaymentProvider, CreatePaymentInput, ProviderPayment,
  RefundInput, ProviderRefund, CreateBeneficiaryInput, ProviderBeneficiary,
  CreatePayoutInput, ProviderPayout, WebhookVerifyInput, VerifiedWebhook,
  SplitPaymentInput,
} from './payment-provider.js';
import { notImplemented } from '../errors.js';

export class TapProvider implements PaymentProvider {
  readonly name = 'tap' as const;
  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
    private readonly baseUrl: string = process.env.TAP_BASE_URL ?? 'https://api.tap.company',
  ) {
    if (!secretKey) throw new Error('TAP_SECRET_KEY is not configured');
    // webhookSecret is required for webhook verification but not for outbound calls; warn late.
    void this.baseUrl; // preserved for the real implementation
    void this.webhookSecret;
  }
  async createPayment(_input: CreatePaymentInput): Promise<ProviderPayment> {
    throw notImplemented('tap.createPayment: implement POST {baseUrl}/v2/charges/');
  }
  async createSplitPayment(_input: SplitPaymentInput): Promise<ProviderPayment> {
    throw notImplemented('tap.createSplitPayment: implement Tap "destinations" on POST {baseUrl}/v2/charges/');
  }
  async getPayment(_id: string): Promise<ProviderPayment>                     { throw notImplemented('tap.getPayment'); }
  async verifyPayment(_id: string): Promise<ProviderPayment>                  { throw notImplemented('tap.verifyPayment'); }
  async refundPayment(_input: RefundInput): Promise<ProviderRefund>           { throw notImplemented('tap.refundPayment: POST {baseUrl}/v2/refunds/'); }
  async createBeneficiary(_input: CreateBeneficiaryInput): Promise<ProviderBeneficiary> {
    throw notImplemented('tap.createBeneficiary: POST {baseUrl}/v2/beneficiary');
  }
  async getBeneficiary(_id: string): Promise<ProviderBeneficiary>             { throw notImplemented('tap.getBeneficiary'); }
  async createPayout(_input: CreatePayoutInput): Promise<ProviderPayout>      {
    throw notImplemented('tap.createPayout: POST {baseUrl}/v2/transfers/ (with beneficiary id)');
  }
  async getPayout(_id: string): Promise<ProviderPayout>                       { throw notImplemented('tap.getPayout'); }
  async verifyWebhook(_input: WebhookVerifyInput): Promise<VerifiedWebhook>   {
    throw notImplemented('tap.verifyWebhook: compute HMAC-SHA256 over the raw body against TAP_WEBHOOK_SECRET');
  }
}
