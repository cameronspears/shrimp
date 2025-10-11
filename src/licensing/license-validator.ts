import Conf from 'conf';
import type { LicenseInfo } from '../types/index.js';

const config = new Conf({
  projectName: 'shrimp-health',
});

const FREE_TIER_CHECKS = 50;

export class LicenseValidator {
  /**
   * Validate and retrieve license information
   */
  async validateLicense(): Promise<LicenseInfo> {
    const licenseKey = config.get('licenseKey') as string | undefined;
    const email = config.get('email') as string | undefined;

    // If no license key, return free tier
    if (!licenseKey) {
      return this.getFreeTierLicense();
    }

    try {
      // TODO: Call your licensing API to validate the key
      // For now, decode the key format: tier_email_expiry_signature
      const parts = licenseKey.split('_');
      if (parts.length < 3) {
        console.warn('Invalid license key format, falling back to free tier');
        return this.getFreeTierLicense();
      }

      const [tier, licenseEmail, expiryTimestamp] = parts;
      const expiry = parseInt(expiryTimestamp, 10);

      // Check if expired
      if (expiry < Date.now()) {
        console.warn('License expired, falling back to free tier');
        config.delete('licenseKey');
        return this.getFreeTierLicense();
      }

      // Return license based on tier
      return this.getLicenseForTier(
        tier as 'pro' | 'team' | 'enterprise',
        licenseKey,
        licenseEmail,
        expiry
      );
    } catch (error) {
      console.error('Error validating license:', error);
      return this.getFreeTierLicense();
    }
  }

  /**
   * Activate a license key
   */
  async activateLicense(licenseKey: string, email: string): Promise<boolean> {
    try {
      // TODO: Call your licensing API to activate and validate
      // For MVP, just store it locally
      config.set('licenseKey', licenseKey);
      config.set('email', email);
      config.set('activatedAt', Date.now());

      console.log('✅ License activated successfully!');
      return true;
    } catch (error) {
      console.error('Failed to activate license:', error);
      return false;
    }
  }

  /**
   * Deactivate current license
   */
  async deactivateLicense(): Promise<void> {
    config.delete('licenseKey');
    config.delete('email');
    config.delete('activatedAt');
    console.log('License deactivated');
  }

  /**
   * Get current license info from local storage
   */
  getCurrentLicense(): { key?: string; email?: string; activatedAt?: number } {
    return {
      key: config.get('licenseKey') as string | undefined,
      email: config.get('email') as string | undefined,
      activatedAt: config.get('activatedAt') as number | undefined,
    };
  }

  /**
   * Check if a specific feature is available
   */
  async hasFeature(feature: keyof LicenseInfo['features']): Promise<boolean> {
    const license = await this.validateLicense();
    const value = license.features[feature];
    return typeof value === 'boolean' ? value : value > 0;
  }

  /**
   * Check and decrement remaining checks for free tier
   */
  async canRunCheck(): Promise<{ allowed: boolean; remaining: number }> {
    const license = await this.validateLicense();

    if (license.tier !== 'free') {
      // Paid tiers have unlimited checks
      return { allowed: true, remaining: -1 };
    }

    // Check free tier usage
    const checksThisMonth = this.getChecksThisMonth();
    const remaining = FREE_TIER_CHECKS - checksThisMonth;

    if (remaining <= 0) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining };
  }

  /**
   * Increment check counter
   */
  incrementCheckCount(): void {
    const month = this.getCurrentMonth();
    const monthKey = `checks_${month}`;
    const current = config.get(monthKey, 0) as number;
    config.set(monthKey, current + 1);
    config.set('lastCheckAt', Date.now());
  }

  /**
   * Get checks used this month
   */
  private getChecksThisMonth(): number {
    const month = this.getCurrentMonth();
    const monthKey = `checks_${month}`;
    return config.get(monthKey, 0) as number;
  }

  /**
   * Get current month key (YYYY-MM)
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get free tier license
   */
  private getFreeTierLicense(): LicenseInfo {
    const checksUsed = this.getChecksThisMonth();
    return {
      tier: 'free',
      checksRemaining: Math.max(0, FREE_TIER_CHECKS - checksUsed),
      features: {
        maxChecksPerMonth: FREE_TIER_CHECKS,
        claudeIntegration: false,
        advancedDetectors: false,
        gitHooks: true,
        healthTrends: false,
        multiRepo: false,
        teamDashboard: false,
        cicdIntegration: true,
      },
    };
  }

  /**
   * Get license for paid tier
   */
  private getLicenseForTier(
    tier: 'pro' | 'team' | 'enterprise',
    key: string,
    email: string,
    expiresAt: number
  ): LicenseInfo {
    const baseFeatures = {
      maxChecksPerMonth: -1, // Unlimited
      claudeIntegration: true,
      advancedDetectors: true,
      gitHooks: true,
      healthTrends: true,
      multiRepo: tier === 'team' || tier === 'enterprise',
      teamDashboard: tier === 'team' || tier === 'enterprise',
      cicdIntegration: true,
    };

    return {
      tier,
      key,
      email,
      expiresAt,
      features: baseFeatures,
    };
  }
}
