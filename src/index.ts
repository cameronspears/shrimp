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
export { BugDetectorAST as BugDetector } from './detectors/bug-detector-ast.js';
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
   * Licensing removed - unlimited checks for everyone
   */
  async check(sourceRoot: string = '.', autoFix: boolean = false, silent: boolean = false) {
    // Run the health check (no license validation needed)
    const maintenance = new CodebaseMaintenance(sourceRoot, autoFix, silent);
    const result = await maintenance.run();

    // Track usage for local stats only
    this.tracker.trackCheck(result.healthScore);

    return result;
  }

  /**
   * Get license information
   * Always returns unlimited enterprise tier
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
   * No-op - licensing removed
   */
  async activate(licenseKey: string, email: string) {
    return await this.validator.activateLicense(licenseKey, email);
  }
}
