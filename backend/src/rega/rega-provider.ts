/**
 * REGA compliance provider interfaces.
 *
 * These are INTERFACES ONLY. No real integration with the Real Estate
 * General Authority (REGA), Nafath, or Elm is performed. The interfaces
 * exist so that when a real integration is procured, it drops in without
 * touching business code.
 *
 * DO NOT claim REGA compliance in code, marketing, or product copy until
 * a licensed integration is actually wired.
 */

export interface AdvertiserVerificationInput {
  userId: string;
  documentType: 'national_id' | 'iqama' | 'cr';
  /** Provider-specific handle — never the raw national id. */
  externalRef: string;
}

export interface AdvertiserVerificationResult {
  status: 'pending' | 'verified' | 'rejected';
  externalRef?: string;
  verifiedAt?: Date;
  expiresAt?: Date;
  rejectionReason?: string;
}

/**
 * Identity verification (Nafath / Elm / manual).
 */
export interface AdvertiserVerificationProvider {
  readonly name: string;
  verifyAdvertiser(input: AdvertiserVerificationInput): Promise<AdvertiserVerificationResult>;
  getStatus(externalRef: string): Promise<AdvertiserVerificationResult>;
}

export interface AdvertisementLicenseInput {
  propertyId: string;
  advertiserUserId: string;
}

export interface AdvertisementLicenseResult {
  licenseNumber: string;
  issuedAt: Date;
  expiresAt: Date;
  complianceRef: string;
}

/**
 * Advertisement licence issuance (REGA `فال` for property ads).
 */
export interface AdvertisementLicenseProvider {
  readonly name: string;
  requestLicense(input: AdvertisementLicenseInput): Promise<AdvertisementLicenseResult>;
  isActive(licenseNumber: string): Promise<boolean>;
}

/**
 * Aggregate REGA provider — usually a single vendor covers both surfaces,
 * but we keep them separate so the composition can be per-use-case.
 */
export interface REGAProvider {
  readonly name: string;
  readonly identity: AdvertiserVerificationProvider;
  readonly license: AdvertisementLicenseProvider;
}
