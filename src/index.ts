/**
 * Shrimp Health - AI-powered code health monitoring
 * @module @shrimphealth/cli
 */

import { CodebaseMaintenance } from './core/health-check.js';
import { LicenseValidator } from './licensing/license-validator.js';
import { UsageTracker } from './licensing/usage-tracker.js';

export { CodebaseMaintenance } from './core/health-check.js';
export { ShrimpChecks } from './core/health-analyzer.js';
export { AutoFixer, type AutoFixResult, type FixWithConfidence } from './core/auto-fixer.js';
export { FileWatcher, getWatcherInstance, setWatcherInstance, clearWatcherInstance, type WatcherStatus, type WatcherIssue } from './core/file-watcher.js';
export { invokeClaude } from './integrations/claude-integration.js';
export { LicenseValidator } from './licensing/license-validator.js';
export { UsageTracker } from './licensing/usage-tracker.js';

export type {
  MaintenanceResult,
  ShrimpConfig,
  LicenseInfo,
  UsageStats,
} from './types/index.js';

// Re-export all detectors
export { BugDetector } from './detectors/bug-detector.js';
export { PerformanceDetector } from './detectors/performance-detector.js';
export { ConsistencyDetector } from './detectors/consistency-detector.js';
export { ImportDetector } from './detectors/import-detector.js';
export { NextJSDetector } from './detectors/nextjs-detector.js';
export { WCAGDetector } from './detectors/wcag-detector.js';

/**
 * Main entry point for programmatic usage
 */
export class ShrimpHealth {
  private validator: LicenseValidator;
  private tracker: UsageTracker;

  constructor() {
    this.validator = new LicenseValidator();
    this.tracker = new UsageTracker();
  }

  /**
   * Run a health check on the codebase
   */
  async check(sourceRoot: string = '.', autoFix: boolean = false) {
    // Validate license and check quota
    const { allowed, remaining } = await this.validator.canRunCheck();

    if (!allowed) {
      throw new Error(
        `Free tier limit reached (${remaining} checks remaining this month). Upgrade to Pro for unlimited checks.`
      );
    }

    // Run the health check
    const maintenance = new CodebaseMaintenance(sourceRoot, autoFix);
    const result = await maintenance.run();

    // Track usage
    this.validator.incrementCheckCount();
    this.tracker.trackCheck(result.healthScore);

    return result;
  }

  /**
   * Get license information
   */
  async getLicense() {
    return await this.validator.validateLicense();
  }

  /**
   * Get usage statistics
   */
  getStats() {
    return this.tracker.getStats();
  }

  /**
   * Activate a license
   */
  async activate(licenseKey: string, email: string) {
    return await this.validator.activateLicense(licenseKey, email);
  }
}
