/**
 * ManualREGAProvider — admin-driven placeholder used until Nafath / Elm
 * integration is procured. Verification and licence issuance become admin
 * actions recorded in the AuditLog.
 *
 * This is NOT a real REGA integration. It only lets us run the
 * DRAFT → SUBMITTED → VERIFIED → PUBLISHED lifecycle end-to-end while
 * every decision remains a manual admin call.
 */

import type {
  REGAProvider, AdvertiserVerificationProvider, AdvertisementLicenseProvider,
  AdvertiserVerificationInput, AdvertiserVerificationResult,
  AdvertisementLicenseInput, AdvertisementLicenseResult,
} from './rega-provider.js';

const identity: AdvertiserVerificationProvider = {
  name: 'manual',
  async verifyAdvertiser(_input: AdvertiserVerificationInput): Promise<AdvertiserVerificationResult> {
    // Admin drives the actual state transition; this just returns "pending".
    return { status: 'pending' };
  },
  async getStatus(_externalRef: string): Promise<AdvertiserVerificationResult> {
    return { status: 'pending' };
  },
};

const license: AdvertisementLicenseProvider = {
  name: 'manual',
  async requestLicense(_input: AdvertisementLicenseInput): Promise<AdvertisementLicenseResult> {
    // A real REGA integration mints a licence number here. In manual mode
    // the admin sets one when calling the mark-verified endpoint.
    throw new Error('manual REGA provider: license must be entered by an admin');
  },
  async isActive(_licenseNumber: string): Promise<boolean> {
    return true;                        // trusted-input placeholder
  },
};

export const manualREGAProvider: REGAProvider = { name: 'manual', identity, license };
