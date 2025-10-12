// Licensing removed - fully open source
// Usage tracking kept for local stats only (no enforcement, no remote analytics)

import Conf from 'conf';
import type { UsageStats } from '../types/index.js';

const config = new Conf({
  projectName: 'shrimp-health',
});

export class UsageTracker {
  /**
   * Track a health check (for local statistics only)
   */
  trackCheck(healthScore: number): void {
    // Increment monthly counter
    const month = this.getCurrentMonth();
    const monthKey = `checks_${month}`;
    const currentMonthly = config.get(monthKey, 0) as number;
    config.set(monthKey, currentMonthly + 1);

    // Increment total counter
    const totalChecks = config.get('totalChecks', 0) as number;
    config.set('totalChecks', totalChecks + 1);

    // Update last check timestamp
    config.set('lastCheckAt', Date.now());

    // Update average health score (rolling average)
    const avgScore = config.get('avgHealthScore', healthScore) as number;
    const newAvg = (avgScore * totalChecks + healthScore) / (totalChecks + 1);
    config.set('avgHealthScore', newAvg);

    // Store health score history (last 30 checks)
    const history = config.get('healthScoreHistory', []) as number[];
    history.push(healthScore);
    if (history.length > 30) history.shift();
    config.set('healthScoreHistory', history);
  }

  /**
   * Get usage statistics
   */
  getStats(): UsageStats {
    const month = this.getCurrentMonth();
    const monthKey = `checks_${month}`;

    return {
      checksThisMonth: config.get(monthKey, 0) as number,
      totalChecks: config.get('totalChecks', 0) as number,
      lastCheckAt: config.get('lastCheckAt') as number | undefined,
      avgHealthScore: config.get('avgHealthScore', 0) as number,
    };
  }

  /**
   * Get health score history
   */
  getHealthHistory(): number[] {
    return config.get('healthScoreHistory', []) as number[];
  }

  /**
   * Enable or disable analytics (no-op, kept for backwards compatibility)
   */
  setAnalyticsEnabled(enabled: boolean): void {
    // No-op - analytics removed
  }

  /**
   * Check if analytics is enabled (always false)
   */
  isAnalyticsEnabled(): boolean {
    return false;
  }

  /**
   * Reset usage stats (for testing)
   */
  reset(): void {
    const month = this.getCurrentMonth();
    const monthKey = `checks_${month}`;
    config.delete(monthKey);
  }

  /**
   * Get current month key
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
