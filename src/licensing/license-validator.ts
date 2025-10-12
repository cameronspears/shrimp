// Licensing removed - fully open source
// This file is kept for backwards compatibility but all methods are stubbed to allow unlimited access

import type { LicenseInfo } from '../types/index.js';

export class LicenseValidator {
  /**
   * Validate and retrieve license information
   * Always returns unlimited "pro" tier - licensing removed
   */
  async validateLicense(): Promise<LicenseInfo> {
    return this.getUnlimitedLicense();
  }

  /**
   * Activate a license key
   * No-op - licensing removed
   */
  async activateLicense(licenseKey: string, email: string): Promise<boolean> {
    console.log('[OK] Shrimp Health is now fully open source - no license needed!');
    return true;
  }

  /**
   * Deactivate current license
   * No-op - licensing removed
   */
  async deactivateLicense(): Promise<void> {
    console.log('Licensing removed - all features are free');
  }

  /**
   * Get current license info from local storage
   * Returns empty - licensing removed
   */
  getCurrentLicense(): { key?: string; email?: string; activatedAt?: number } {
    return {};
  }

  /**
   * Check if a specific feature is available
   * Always returns true - all features enabled
   */
  async hasFeature(feature: keyof LicenseInfo['features']): Promise<boolean> {
    return true;
  }

  /**
   * Check and decrement remaining checks for free tier
   * Always returns allowed - unlimited checks for everyone
   */
  async canRunCheck(): Promise<{ allowed: boolean; remaining: number }> {
    // Licensing removed - unlimited checks for everyone
    return { allowed: true, remaining: -1 };
  }

  /**
   * Increment check counter
   * No-op - not tracking anymore
   */
  incrementCheckCount(): void {
    // No-op - licensing removed
  }

  /**
   * Get unlimited license (all features enabled)
   */
  private getUnlimitedLicense(): LicenseInfo {
    return {
      tier: 'enterprise',
      checksRemaining: -1,
      features: {
        maxChecksPerMonth: -1, // Unlimited
        claudeIntegration: true,
        advancedDetectors: true,
        gitHooks: true,
        healthTrends: true,
        multiRepo: true,
        teamDashboard: true,
        cicdIntegration: true,
      },
    };
  }
}
