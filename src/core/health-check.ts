#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { ShrimpChecks } from './health-analyzer.js';
import { invokeClaude } from '../integrations/claude-integration.js';

interface MaintenanceResult {
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

export class CodebaseMaintenance {
  private sourceRoot: string;
  private recommendations: string[] = [];
  private shouldAutoFix: boolean = false;
  private details: MaintenanceResult['details'] = {
    deadCodeFiles: [],
    debugStatements: [],
    emptyDirectories: [],
    packageIssues: [],
    largeFiles: [],
    complexFunctions: [],
    duplicatePatterns: [],
    todoComments: [],
    outdatedComments: [],
    namingInconsistencies: [],
  };

  constructor(sourceRoot: string = '.', autoFix: boolean = false) {
    this.sourceRoot = path.resolve(sourceRoot);
    this.shouldAutoFix = autoFix;
  }

  async run(): Promise<MaintenanceResult> {
    console.log('🦐 Shrimp Codebase Health Check (Claude-Paired) v4.0');
    console.log(
      '🚀 Enhanced: Bug Detection • Performance Analysis • Code Consistency • Import Optimization • Next.js Best Practices\n'
    );

    const startTime = Date.now();

    try {
      const healthScore = await this.analyzeCodebaseHealth();
      const duration = Date.now() - startTime;

      const summary = `Health Check completed in ${duration}ms - Score: ${healthScore}/100`;

      console.log(`\n✅ ${summary}`);

      if (this.recommendations.length > 0) {
        console.log('\n📋 Recommendations:');
        this.recommendations.forEach((rec) => console.log(`  • ${rec}`));
      }

      return {
        success: true,
        healthScore,
        recommendations: this.recommendations,
        summary,
        details: this.details,
      };
    } catch (error) {
      console.error('\n❌ Health check failed:', error);

      return {
        success: false,
        healthScore: 0,
        recommendations: [],
        summary: `Health check failed: ${error}`,
      };
    }
  }

  private async analyzeCodebaseHealth(): Promise<number> {
    let score = 100;

    // Delegate main checks to ShrimpChecks module
    const checks = new ShrimpChecks(
      this.sourceRoot,
      this.shouldAutoFix,
      this.details,
      this.recommendations
    );

    // Core checks (existing)
    score -= await checks.checkForPotentialDeadCode();
    score -= await checks.checkPackageHealth();
    score -= await checks.checkDirectoryStructure();
    score -= await checks.checkForLargeFiles();
    score -= await checks.checkCodeComplexity();

    // Enhanced detection (new!)
    score -= await checks.checkForBugs();
    score -= await checks.checkPerformance();
    score -= await checks.checkConsistency();
    score -= await checks.checkImports();
    score -= await checks.checkNextJSPatterns();

    // Keep remaining lightweight checks here
    score -= await this.checkForTodoComments();
    score -= await this.checkForOutdatedPatterns();
    score -= await this.checkNamingConsistency();

    return Math.max(0, Math.min(100, score));
  }

  private async checkForTodoComments(): Promise<number> {
    console.log('📝 Scanning for TODO/FIXME comments...');

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    for (const file of files) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK)\s*:?\s*(.+)/i);

          if (todoMatch) {
            const type = todoMatch[1].toUpperCase() as 'TODO' | 'FIXME' | 'HACK';
            const content = todoMatch[2] || '';

            this.details?.todoComments.push({
              file,
              line: i + 1,
              content: content.trim() || line.trim(),
              type,
            });

            issues += type === 'FIXME' ? 2 : type === 'HACK' ? 3 : 1;
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (issues > 0) {
      const todoCount = this.details?.todoComments.length || 0;
      this.recommendations.push(`Address ${todoCount} TODO/FIXME comments`);
      console.log(`  ⚠️  Found ${todoCount} TODO/FIXME comments`);
    } else {
      console.log('  ✅ No outstanding TODO comments found');
    }

    return Math.min(issues, 8); // Reduced penalty cap
  }

  private async checkForOutdatedPatterns(): Promise<number> {
    console.log('🕰️  Checking for outdated patterns...');

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    const outdatedPatterns = [
      {
        pattern: /class\s+\w+\s+extends\s+React\.Component/,
        reason: 'Consider migrating to functional components with hooks',
      },
      {
        pattern: /componentDidMount|componentWillUnmount/,
        reason: 'Consider using useEffect hook instead',
      },
      { pattern: /\bvar\s+\w+/, reason: 'Use const/let instead of var' },
      { pattern: /\brequire\s*\(/, reason: 'Use ES6 import statements instead of require' },
    ];

    for (const file of files.slice(0, 20)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          for (const { pattern, reason } of outdatedPatterns) {
            if (pattern.test(line)) {
              issues += 1;
              this.details?.outdatedComments.push({
                file,
                line: i + 1,
                content: line.trim(),
                reason,
              });
            }
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (issues > 0) {
      const outdatedCount = this.details?.outdatedComments.length || 0;
      this.recommendations.push(`Modernize ${outdatedCount} outdated code patterns`);
      console.log(`  ⚠️  Found ${outdatedCount} outdated patterns`);
    } else {
      console.log('  ✅ Code patterns look modern');
    }

    return Math.min(issues, 6); // Reduced penalty cap
  }

  private async checkNamingConsistency(): Promise<number> {
    console.log('🏷️  Checking naming consistency...');

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    for (const file of files.slice(0, 15)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Very conservative naming checks
          const varMatch = line.match(/(const|let|var)\s+(\w+)/g);
          if (varMatch) {
            varMatch.forEach((match) => {
              const varName = match.split(/\s+/)[1];

              // Only flag obvious issues
              if (
                varName.match(/^[A-Z]/) &&
                !varName.match(/^[A-Z_]+$/) &&
                !file.includes('/types/')
              ) {
                issues += 1;
                this.details?.namingInconsistencies.push({
                  file,
                  issue: `Variable '${varName}' uses PascalCase`,
                  suggestion: `Use camelCase: ${varName.charAt(0).toLowerCase() + varName.slice(1)}`,
                });
              }
            });
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (issues > 0) {
      const inconsistentCount = this.details?.namingInconsistencies.length || 0;
      this.recommendations.push(`Fix ${inconsistentCount} naming inconsistencies`);
      console.log(`  ⚠️  Found ${inconsistentCount} naming inconsistencies`);
    } else {
      console.log('  ✅ Naming conventions look consistent');
    }

    return Math.min(issues, 4); // Reduced penalty cap
  }

  // Helper methods
  private shouldIgnoreFile(file: string): boolean {
    const ignorePatterns = [
      'shrimp',
      'health-check',
      'health-analyzer',
      'health-autofix',
      'auto-fixer',
      'wcag-detector',
      'bug-detector',
      'performance-detector',
      'consistency-detector',
      'import-detector',
      'nextjs-detector',
      'scripts/maintenance',
      '*.generated.*',
      'node_modules',
      '.next',
      '.git',
    ];

    return ignorePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(file);
      }
      return file.includes(pattern);
    });
  }

  private async findFiles(
    _patterns: string[],
    exclude: string[] = ['node_modules', '.next', 'dist']
  ): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (exclude.some((ex) => fullPath.includes(ex))) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    }

    await walk(this.sourceRoot);
    return files;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const shouldInvokeClaude = args.includes('--claude') || args.includes('--auto');
  const shouldAutoFix = args.includes('--fix');
  const outputJson = args.includes('--json');

  const maintenance = new CodebaseMaintenance('.', shouldAutoFix);
  const result = await maintenance.run();

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
    return;
  }

  // Output Claude-friendly summary
  console.log('\n📋 Claude Summary:');
  console.log(`Health Score: ${result.healthScore}/100`);
  console.log(`Recommendations: ${result.recommendations.length}`);
  console.log(`Status: ${result.success ? 'OK' : 'Issues Found'}`);

  // Automatically invoke Claude if requested
  if (shouldInvokeClaude) {
    await invokeClaude(result);
  } else if (result.recommendations.length > 0) {
    console.log('\n💡 Available options:');
    console.log('  • `pnpm shrimp --fix` - Automatically fix simple issues');
    console.log('  • `pnpm shrimp --claude` - Have Claude fix complex issues');
    console.log('  • `pnpm shrimp --json` - Output machine-readable results');
  }

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// ESM-compatible check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

export { type MaintenanceResult };
