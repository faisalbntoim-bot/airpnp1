/**
 * Tap adapter — INTENTIONAL STUB.
 *
 * Supports the marketplace / destinations model in real use. Do NOT ship
 * to production until the real Tap SDK / REST calls are wired.
 *
 * Reference: https://developers.tap.company/
 */

import type {
  PaymentProvider, CreatePaymentInput, ProviderPayment,
  RefundInput, ProviderRefund, CreateBeneficiaryInput, ProviderBeneficiary,
  CreatePayoutInput, ProviderPayout, WebhookVerifyInput, VerifiedWebhook,
} from './payment-provider.js';
import { notImplemented } from '../errors.js';

export class TapProvider implements PaymentProvider {
  readonly name = 'tap' as const;
  constructor(private readonly secretKey: string, private readonly webhookSecret: string) {
    if (!secretKey) throw new Error('TAP_SECRET_KEY is not configured');
  }
  async createPayment(_input: CreatePaymentInput): Promise<ProviderPayment> { throw notImplemented('tap.createPayment'); }
  async getPayment(_id: string): Promise<ProviderPayment>                     { throw notImplemented('tap.getPayment'); }
  async verifyPayment(_id: string): Promise<ProviderPayment>                  { throw notImplemented('tap.verifyPayment'); }
  async refundPayment(_input: RefundInput): Promise<ProviderRefund>           { throw notImplemented('tap.refundPayment'); }
  async createBeneficiary(_input: CreateBeneficiaryInput): Promise<ProviderBeneficiary> { throw notImplemented('tap.createBeneficiary'); }
  async getBeneficiary(_id: string): Promise<ProviderBeneficiary>             { throw notImplemented('tap.getBeneficiary'); }
  async createPayout(_input: CreatePayoutInput): Promise<ProviderPayout>      { throw notImplemented('tap.createPayout'); }
  async getPayout(_id: string): Promise<ProviderPayout>                       { throw notImplemented('tap.getPayout'); }
  async verifyWebhook(_input: WebhookVerifyInput): Promise<VerifiedWebhook>   { throw notImplemented('tap.verifyWebhook'); }
}
