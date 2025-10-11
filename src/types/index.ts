export interface MaintenanceResult {
  success: boolean;
  healthScore: number;
  recommendations: string[];
  summary: string;
  details?: {
    deadCodeFiles: string[];
    debugStatements: Array<{ file: string; line: number; content: string }>;
    emptyDirectories: string[];
    packageIssues: string[];
    largeFiles: Array<{ file: string; size: number; lines: number }>;
    complexFunctions: Array<{ file: string; function: string; complexity: number }>;
    duplicatePatterns: Array<{ pattern: string; files: string[] }>;
    todoComments: Array<{
      file: string;
      line: number;
      content: string;
      type: 'TODO' | 'FIXME' | 'HACK';
    }>;
    outdatedComments: Array<{ file: string; line: number; content: string; reason: string }>;
    namingInconsistencies: Array<{ file: string; issue: string; suggestion: string }>;
    bugIssues?: any[];
    performanceIssues?: any[];
    consistencyIssues?: any[];
    importIssues?: any[];
    nextJSIssues?: any[];
  };
}

export interface ShrimpConfig {
  checks?: {
    bugs?: boolean;
    performance?: boolean;
    imports?: boolean;
    consistency?: boolean;
    wcag?: boolean;
    nextjs?: boolean;
    deadCode?: boolean;
    complexity?: boolean;
  };
  ignore?: string[];
  thresholds?: {
    minimum?: number;
    target?: number;
  };
  autofix?: {
    enabled?: boolean;
    claude?: boolean;
  };
}

export interface LicenseInfo {
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  key?: string;
  email?: string;
  expiresAt?: number;
  checksRemaining?: number;
  features: {
    maxChecksPerMonth: number;
    claudeIntegration: boolean;
    advancedDetectors: boolean;
    gitHooks: boolean;
    healthTrends: boolean;
    multiRepo: boolean;
    teamDashboard: boolean;
    cicdIntegration: boolean;
  };
}

export interface UsageStats {
  checksThisMonth: number;
  totalChecks: number;
  lastCheckAt?: number;
  avgHealthScore: number;
}

export interface AutoFixResult {
  file: string;
  fixesApplied: number;
  changes: string[];
}
