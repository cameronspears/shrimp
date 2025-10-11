import Conf from 'conf';
import type { UsageStats } from '../types/index.js';

const config = new Conf({
  projectName: 'shrimp-health',
});

export class UsageTracker {
  /**
   * Track a health check
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

    // Optional: Send anonymous analytics (only with user consent)
    if (config.get('analyticsEnabled', false)) {
      this.sendAnonymousAnalytics({
        event: 'health_check',
        healthScore,
        timestamp: Date.now(),
      });
    }
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
   * Enable or disable analytics
   */
  setAnalyticsEnabled(enabled: boolean): void {
    config.set('analyticsEnabled', enabled);
  }

  /**
   * Check if analytics is enabled
   */
  isAnalyticsEnabled(): boolean {
    return config.get('analyticsEnabled', false) as boolean;
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

  /**
   * Send anonymous analytics (placeholder for future implementation)
   */
  private async sendAnonymousAnalytics(data: any): Promise<void> {
    // TODO: Implement analytics endpoint
    // This would send to your analytics service
    // Examples: PostHog, Mixpanel, custom endpoint
    try {
      // const response = await fetch('https://api.shrimphealth.com/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data),
      // });
    } catch (error) {
      // Silently fail - analytics should never break functionality
    }
  }
}
