import fs from 'fs/promises';
import path from 'path';
import { BugDetector } from '../detectors/bug-detector.js';
import { ConsistencyDetector } from '../detectors/consistency-detector.js';
import { PerformanceDetector } from '../detectors/performance-detector.js';
import { ImportDetector } from '../detectors/import-detector.js';
import { NextJSDetector } from '../detectors/nextjs-detector.js';

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

export class ShrimpChecks {
  private sourceRoot: string;
  private shouldAutoFix: boolean;
  private recommendations: string[] = [];
  private details: MaintenanceResult['details'];

  constructor(
    sourceRoot: string,
    autoFix: boolean = false,
    details: MaintenanceResult['details'],
    recommendations: string[]
  ) {
    this.sourceRoot = sourceRoot;
    this.shouldAutoFix = autoFix;
    this.details = details;
    this.recommendations = recommendations;
  }

  async checkForPotentialDeadCode(): Promise<number> {
    console.log('[SCAN] Scanning for potential dead code...');

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    for (const file of files.slice(0, 20)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        let unusedImports = 0;
        let debugStatements = 0;

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.startsWith('import ') && trimmed.includes('// UNUSED')) {
            unusedImports++;
          }

          // Count debug statements (but allow them in scripts directory)
          if (
            (trimmed.startsWith('console.log(') || trimmed.startsWith('console.debug(')) &&
            !file.includes('/scripts/')
          ) {
            debugStatements++;
          }
        }

        if (unusedImports > 0) {
          issues += unusedImports * 2;
          this.details?.deadCodeFiles.push(file);
        }

        if (debugStatements > 2) {
          issues += Math.min(debugStatements, 5);
          const debugLines = lines
            .map((line, index) => ({ line: line.trim(), index: index + 1 }))
            .filter(
              ({ line }) =>
                (line.startsWith('console.log(') || line.startsWith('console.debug(')) &&
                !file.includes('/scripts/')
            )
            .slice(0, 10);

          debugLines.forEach(({ line, index }) => {
            this.details?.debugStatements.push({ file, line: index, content: line });
          });

          if (this.shouldAutoFix) {
            try {
              let updatedContent = content;
              debugLines.forEach(({ line }) => {
                const lineRegex = new RegExp(
                  `^.*${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`,
                  'gm'
                );
                updatedContent = updatedContent.replace(lineRegex, '');
                updatedContent = updatedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
              });

              if (updatedContent !== content) {
                await fs.writeFile(file, updatedContent, 'utf-8');
                console.log(
                  `  🔧 Removed ${debugLines.length} console.log statements from ${file}`
                );
              }
            } catch (error) {
              console.log(`  [!] Could not auto-fix debug statements in ${file}: ${error}`);
            }
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (issues > 0) {
      this.recommendations.push(`Consider reviewing ${issues} potential dead code issues`);
    } else {
      console.log('  [OK] No obvious dead code found');
    }

    return Math.min(issues, 15); // Reduced penalty cap
  }

  async checkPackageHealth(): Promise<number> {
    console.log('[SCAN] Checking package health...');

    try {
      const packageJson = path.join(this.sourceRoot, 'package.json');
      const content = await fs.readFile(packageJson, 'utf-8');
      const pkg = JSON.parse(content);

      const issues: string[] = [];
      const depCount = Object.keys(pkg.dependencies || {}).length;
      const devDepCount = Object.keys(pkg.devDependencies || {}).length;

      // More lenient thresholds
      if (depCount > 60) {
        const issue = `High dependency count (${depCount})`;
        issues.push(issue);
        this.details?.packageIssues.push(issue);
      }

      if (devDepCount > 40) {
        const issue = `High dev dependency count (${devDepCount})`;
        issues.push(issue);
        this.details?.packageIssues.push(issue);
      }

      if (issues.length > 0) {
        this.recommendations.push(`Package: ${issues.join(', ')}`);
        console.log(`  [!] ${issues.length} package issues found`);
      } else {
        console.log('  [OK] Package health looks good');
      }

      return issues.length * 2; // Reduced penalty
    } catch (error) {
      console.log('  [!] Could not check package health');
      return 3;
    }
  }

  async checkDirectoryStructure(): Promise<number> {
    console.log('[SCAN] Checking directory structure...');

    let issues = 0;

    try {
      const dirs = await this.findDirectories();
      let emptyDirs = 0;

      for (const dir of dirs) {
        try {
          const entries = await fs.readdir(dir);
          if (entries.length === 0 && !this.isProtectedDirectory(dir)) {
            emptyDirs++;
          }
        } catch (error) {
          // Skip inaccessible directories
        }
      }

      if (emptyDirs > 0) {
        issues = Math.min(emptyDirs, 8); // Reduced penalty
        this.recommendations.push(`${emptyDirs} empty directories could be cleaned up`);
        console.log(`  [!] Found ${emptyDirs} empty directories`);

        for (const dir of dirs) {
          try {
            const entries = await fs.readdir(dir);
            if (entries.length === 0 && !this.isProtectedDirectory(dir)) {
              this.details?.emptyDirectories.push(dir);

              if (this.shouldAutoFix) {
                try {
                  await fs.rmdir(dir);
                  console.log(`  🔧 Removed empty directory: ${dir}`);
                } catch (error) {
                  console.log(`  [!] Could not remove ${dir}: ${error}`);
                }
              }
            }
          } catch (error) {
            // Skip inaccessible directories
          }
        }
      } else {
        console.log('  [OK] No empty directories found');
      }
    } catch (error) {
      console.log('  [!] Could not check directory structure');
      issues = 2;
    }

    return issues;
  }

  async checkForLargeFiles(): Promise<number> {
    console.log('[SCAN] Checking for large files...');

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    const largeFileThreshold = 1000; // Lenient - complex API routes can be long
    const massiveFileThreshold = 1500; // Very lenient

    for (const file of files) {
      if (
        file.includes('/tests/') ||
        file.includes('.test.') ||
        file.includes('.spec.') ||
        file.includes('.generated.') ||
        file.endsWith('shrimp.ts') ||
        this.shouldIgnoreFile(file)
      ) {
        continue;
      }

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        const size = content.length;

        if (lines > largeFileThreshold) {
          const severity = lines > massiveFileThreshold ? 3 : 1; // Reduced penalty
          issues += severity;
          this.details?.largeFiles.push({ file, size, lines });
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (issues > 0) {
      const largeCount = this.details?.largeFiles.length || 0;
      this.recommendations.push(`Consider refactoring ${largeCount} large files (>1000 lines)`);
      console.log(`  [!] Found ${largeCount} large files`);
    } else {
      console.log('  [OK] No overly large files found');
    }

    return Math.min(issues, 8); // Reduced penalty cap - large files are OK for complex features
  }

  async checkCodeComplexity(): Promise<number> {
    console.log('[SCAN] Analyzing code complexity...');

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    for (const file of files.slice(0, 15)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.match(/^(export\s+)?(async\s+)?function\s+\w+\s*\(/)) {
            const functionName = line.match(/function\s+(\w+)/)?.[1] || 'anonymous';
            let complexity = 0;
            let braceCount = 0;
            let maxNesting = 0;

            for (let j = i; j < Math.min(i + 50, lines.length); j++) {
              const nextLine = lines[j];
              braceCount += (nextLine.match(/\{/g) || []).length;
              braceCount -= (nextLine.match(/\}/g) || []).length;
              maxNesting = Math.max(maxNesting, braceCount);

              if (nextLine.match(/\b(if|for|while|switch|catch)\b/)) complexity++;
              if (nextLine.match(/\?.*:/)) complexity++;
              if (nextLine.match(/&&|\|\|/)) complexity++;
            }

            // More lenient for UI components and API routes
            const isUIComponent = file.includes('/components/') || file.includes('/app/');
            const complexityThreshold = isUIComponent ? 15 : 10;
            const nestingThreshold = isUIComponent ? 6 : 4;

            if (complexity > complexityThreshold || maxNesting > nestingThreshold) {
              const penalty = Math.min(complexity - (complexityThreshold - 2), 2); // Reduced penalty
              issues += penalty;
              this.details?.complexFunctions.push({ file, function: functionName, complexity });
            }
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (issues > 0) {
      const complexCount = this.details?.complexFunctions.length || 0;
      this.recommendations.push(`Consider simplifying ${complexCount} complex functions`);
      console.log(`  [!] Found ${complexCount} complex functions`);
    } else {
      console.log('  [OK] Code complexity looks reasonable');
    }

    return Math.min(issues, 8); // Reduced penalty cap
  }

  // ==================== ENHANCED DETECTORS ====================

  async checkForBugs(): Promise<number> {
    console.log('[SCAN] Scanning for potential bugs...');

    const bugDetector = new BugDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    let totalIssues = 0;

    for (const file of files.slice(0, 25)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = await bugDetector.analyze(file, content);

        if (issues.length > 0) {
          totalIssues += issues.length;
          if (!this.details?.bugIssues) this.details!.bugIssues = [];
          this.details!.bugIssues.push(...issues);
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    const severityCounts = bugDetector.getSeverityCount();
    const errorCount = severityCounts.error;
    const warningCount = severityCounts.warning;

    if (totalIssues > 0) {
      if (errorCount > 0) {
        this.recommendations.push(`[CRITICAL] Fix ${errorCount} critical bug(s)`);
      }
      if (warningCount > 0) {
        this.recommendations.push(`[WARNING] Address ${warningCount} potential bug(s)`);
      }

      console.log(`  [BUG] Found ${totalIssues} potential issues`);
      console.log(
        `     - ${errorCount} critical, ${warningCount} warnings, ${severityCounts.info} info`
      );
    } else {
      console.log('  [OK] No obvious bugs detected');
    }

    // Penalty: critical bugs = 5 points each, warnings = 2, info = 0.5
    return Math.min(errorCount * 5 + warningCount * 2 + severityCounts.info * 0.5, 20);
  }

  async checkPerformance(): Promise<number> {
    console.log('[SCAN] Analyzing performance issues...');

    const perfDetector = new PerformanceDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    let totalIssues = 0;

    for (const file of files.slice(0, 20)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = await perfDetector.analyze(file, content);

        if (issues.length > 0) {
          totalIssues += issues.length;
          if (!this.details?.performanceIssues) this.details!.performanceIssues = [];
          this.details!.performanceIssues.push(...issues);
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    const severityCounts = perfDetector.getSeverityCount();
    const criticalCount = severityCounts.critical;
    const moderateCount = severityCounts.moderate;

    if (totalIssues > 0) {
      if (criticalCount > 0) {
        this.recommendations.push(`[PERF] Fix ${criticalCount} critical performance issue(s)`);
      }
      if (moderateCount > 0) {
        this.recommendations.push(`[PERF] Optimize ${moderateCount} performance bottleneck(s)`);
      }

      console.log(`  [PERF] Found ${totalIssues} performance issues`);
      console.log(
        `     - ${criticalCount} critical, ${moderateCount} moderate, ${severityCounts.minor} minor`
      );
    } else {
      console.log('  [OK] No performance issues detected');
    }

    // Penalty: critical = 4 points, moderate = 2, minor = 0.5
    return Math.min(criticalCount * 4 + moderateCount * 2 + severityCounts.minor * 0.5, 15);
  }

  async checkConsistency(): Promise<number> {
    console.log('[SCAN] Checking code consistency...');

    const consistencyDetector = new ConsistencyDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    // First pass: analyze codebase patterns
    await consistencyDetector.analyzeCodebase(files);

    // Second pass: analyze individual files
    let totalIssues = 0;
    for (const file of files.slice(0, 30)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        await consistencyDetector.analyzeFile(file, content);
      } catch (error) {
        // Skip files we can't read
      }
    }

    const issues = consistencyDetector.getIssues();
    totalIssues = issues.length;

    if (totalIssues > 0) {
      if (!this.details?.consistencyIssues) this.details!.consistencyIssues = [];
      this.details!.consistencyIssues = issues;

      const categories = consistencyDetector.getIssuesByCategory();
      const categoryCount = Object.keys(categories).length;

      this.recommendations.push(
        `[STYLE] Improve ${totalIssues} consistency issue(s) across ${categoryCount} categories`
      );
      console.log(`  [STYLE] Found ${totalIssues} consistency issues`);

      // Show top categories
      const topCategories = Object.entries(categories)
        .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length)
        .slice(0, 3);

      topCategories.forEach(([category, catIssues]) => {
        console.log(`     - ${category}: ${(catIssues as any[]).length}`);
      });
    } else {
      console.log('  [OK] Code is consistent');
    }

    // Penalty: 1 point per 3 issues (consistency is less critical)
    return Math.min(Math.floor(totalIssues / 3), 10);
  }

  async checkImports(): Promise<number> {
    console.log('[SCAN] Analyzing imports...');

    const importDetector = new ImportDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    let totalIssues = 0;

    for (const file of files.slice(0, 30)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = await importDetector.analyze(file, content);

        if (issues.length > 0) {
          totalIssues += issues.length;
          if (!this.details?.importIssues) this.details!.importIssues = [];
          this.details!.importIssues.push(...issues);
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (totalIssues > 0) {
      const categories = importDetector.getIssuesByCategory();
      const unusedCount = categories['Unused Imports']?.length || 0;
      const orgCount = categories['Import Organization']?.length || 0;

      if (unusedCount > 0) {
        this.recommendations.push(`[IMPORT] Remove ${unusedCount} unused import(s)`);
      }
      if (orgCount > 0) {
        this.recommendations.push(`[IMPORT] Organize ${orgCount} import statement(s)`);
      }

      console.log(`  [IMPORT] Found ${totalIssues} import issues`);
      console.log(`     - ${unusedCount} unused, ${orgCount} organization`);
    } else {
      console.log('  [OK] Imports are clean and organized');
    }

    // Penalty: unused imports = 0.5 points each, others = 0.3
    // Import organization is low priority compared to functional issues
    const categories = importDetector.getIssuesByCategory();
    const unusedCount = categories['Unused Imports']?.length || 0;
    const otherCount = totalIssues - unusedCount;

    return Math.min(unusedCount * 0.5 + otherCount * 0.3, 10);
  }

  async checkNextJSPatterns(): Promise<number> {
    console.log('[SCAN] Checking Next.js best practices...');

    const nextjsDetector = new NextJSDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);

    for (const file of files.slice(0, 30)) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        await nextjsDetector.analyzeFile(file, content);
      } catch (error) {
        // Skip files we can't read
      }
    }

    const issues = nextjsDetector.getIssues();
    const severityCounts = nextjsDetector.getSeverityCount();

    if (issues.length > 0) {
      if (!this.details?.nextJSIssues) this.details!.nextJSIssues = [];
      this.details!.nextJSIssues = issues;

      if (severityCounts.error > 0) {
        this.recommendations.push(`[NEXTJS] Fix ${severityCounts.error} Next.js critical issue(s)`);
      }
      if (severityCounts.warning > 0) {
        this.recommendations.push(`[NEXTJS] Address ${severityCounts.warning} Next.js warning(s)`);
      }

      console.log(`  [NEXTJS] Found ${issues.length} Next.js pattern issues`);
      console.log(
        `     - ${severityCounts.error} errors, ${severityCounts.warning} warnings, ${severityCounts.info} info`
      );

      // Show categories
      const categories = nextjsDetector.getIssuesByCategory();
      const topCategories = Object.entries(categories)
        .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length)
        .slice(0, 3);

      topCategories.forEach(([category, catIssues]) => {
        console.log(`     - ${category}: ${(catIssues as any[]).length}`);
      });
    } else {
      console.log('  [OK] Next.js patterns look good');
    }

    // Penalty: errors = 3 points, warnings = 1, info = 0.2
    return Math.min(
      severityCounts.error * 3 + severityCounts.warning * 1 + severityCounts.info * 0.2,
      15
    );
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
      '*.generated.*',
      'node_modules',
      '.next',
      'scripts/maintenance',
    ];

    return ignorePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(file);
      }
      return file.includes(pattern);
    });
  }

  private isProtectedDirectory(dir: string): boolean {
    const protectedDirs = [
      '.git',
      '.next',
      'node_modules',
      'dist',
      'build',
      '.husky',
      '.pnpm-store', // pnpm cache
    ];
    return protectedDirs.some((p) => dir.includes(p));
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

  private async findDirectories(): Promise<string[]> {
    const dirs: string[] = [];

    async function walk(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
              dirs.push(fullPath);
              await walk(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    }

    await walk(this.sourceRoot);
    return dirs;
  }
}
