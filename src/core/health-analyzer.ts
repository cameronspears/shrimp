import fs from 'fs/promises';
import path from 'path';
import { BugDetectorAST } from '../detectors/bug-detector-ast.js';
import { ConsistencyDetector } from '../detectors/consistency-detector.js';
import { PerformanceDetector } from '../detectors/performance-detector.js';
import { ImportDetector } from '../detectors/import-detector.js';
import { NextJSDetector } from '../detectors/nextjs-detector.js';
import { logger } from '../utils/logger.js';

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
  private silent: boolean;
  private recommendations: string[] = [];
  private details: MaintenanceResult['details'];

  constructor(
    sourceRoot: string,
    autoFix: boolean = false,
    details: MaintenanceResult['details'],
    recommendations: string[],
    silent: boolean = false
  ) {
    this.sourceRoot = sourceRoot;
    this.shouldAutoFix = autoFix;
    this.details = details;
    this.recommendations = recommendations;
    this.silent = silent;
  }

  async checkForPotentialDeadCode(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Scanning for potential dead code...');
    }

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    logger.debug(`Analyzing ${files.length} files for dead code`);

    for (const file of files) {
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

          // Count debug statements (but allow them in scripts, bin, and user-facing CLI output)
          // Only flag console.debug and console.log with debug-like patterns
          const isDebugLog =
            trimmed.startsWith('console.debug(') ||
            (trimmed.startsWith('console.log(') &&
             (trimmed.includes('[DEBUG]') || trimmed.includes('[TRACE]') || trimmed.includes('TODO:')));

          if (
            isDebugLog &&
            !file.includes('/scripts/') &&
            !file.includes('/bin/')
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
              ({ line }) => {
                const isDebugLog =
                  line.startsWith('console.debug(') ||
                  (line.startsWith('console.log(') &&
                   (line.includes('[DEBUG]') || line.includes('[TRACE]') || line.includes('TODO:')));
                return isDebugLog && !file.includes('/scripts/') && !file.includes('/bin/');
              }
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
                if (!this.silent) {
                  console.log(
                    `  [FIX] Removed ${debugLines.length} console.log statements from ${file}`
                  );
                }
              }
            } catch (error) {
              if (!this.silent) {
                console.log(`  [!] Could not auto-fix debug statements in ${file}: ${error}`);
              }
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
      if (!this.silent) {
        console.log('  [OK] No obvious dead code found');
      }
    }

    return Math.min(issues, 15); // Reduced penalty cap
  }

  async checkPackageHealth(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Checking package health...');
    }

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
        if (!this.silent) {
          console.log(`  [!] ${issues.length} package issues found`);
        }
      } else {
        if (!this.silent) {
          console.log('  [OK] Package health looks good');
        }
      }

      return issues.length * 2; // Reduced penalty
    } catch (error) {
      if (!this.silent) {
        console.log('  [!] Could not check package health');
      }
      return 3;
    }
  }

  async checkDirectoryStructure(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Checking directory structure...');
    }

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
        if (!this.silent) {
          console.log(`  [!] Found ${emptyDirs} empty directories`);
        }

        for (const dir of dirs) {
          try {
            const entries = await fs.readdir(dir);
            if (entries.length === 0 && !this.isProtectedDirectory(dir)) {
              this.details?.emptyDirectories.push(dir);

              if (this.shouldAutoFix) {
                try {
                  await fs.rmdir(dir);
                  if (!this.silent) {
                    console.log(`  [FIX] Removed empty directory: ${dir}`);
                  }
                } catch (error) {
                  if (!this.silent) {
                    console.log(`  [!] Could not remove ${dir}: ${error}`);
                  }
                }
              }
            }
          } catch (error) {
            // Skip inaccessible directories
          }
        }
      } else {
        if (!this.silent) {
          console.log('  [OK] No empty directories found');
        }
      }
    } catch (error) {
      if (!this.silent) {
        console.log('  [!] Could not check directory structure');
      }
      issues = 2;
    }

    return issues;
  }

  async checkForLargeFiles(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Checking for large files...');
    }

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
      if (!this.silent) {
        console.log(`  [!] Found ${largeCount} large files`);
      }
    } else {
      if (!this.silent) {
        console.log('  [OK] No overly large files found');
      }
    }

    return Math.min(issues, 8); // Reduced penalty cap - large files are OK for complex features
  }

  async checkCodeComplexity(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Analyzing code complexity...');
    }

    let issues = 0;
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    logger.debug(`Analyzing ${files.length} files for complexity`);

    for (const file of files) {
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
      if (!this.silent) {
        console.log(`  [!] Found ${complexCount} complex functions`);
      }
    } else {
      if (!this.silent) {
        console.log('  [OK] Code complexity looks reasonable');
      }
    }

    return Math.min(issues, 8); // Reduced penalty cap
  }

  // ==================== ENHANCED DETECTORS ====================

  async checkForBugs(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Scanning for potential bugs...');
    }

    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    let totalIssues = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    logger.debug(`Analyzing ${files.length} files for bugs using AST`);

    for (const file of files) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const bugDetector = new BugDetectorAST(); // Create new instance per file
        const issues = await bugDetector.analyze(file, content);

        if (issues.length > 0) {
          totalIssues += issues.length;
          if (!this.details?.bugIssues) this.details!.bugIssues = [];
          this.details!.bugIssues.push(...issues);

          // Accumulate severity counts
          const counts = bugDetector.getSeverityCount();
          errorCount += counts.error;
          warningCount += counts.warning;
          infoCount += counts.info;
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (totalIssues > 0) {
      if (errorCount > 0) {
        this.recommendations.push(`[CRITICAL] Fix ${errorCount} critical bug(s)`);
      }
      if (warningCount > 0) {
        this.recommendations.push(`[WARNING] Address ${warningCount} potential bug(s)`);
      }

      if (!this.silent) {
        console.log(`  [BUG] Found ${totalIssues} potential issues`);
        console.log(
          `     - ${errorCount} critical, ${warningCount} warnings, ${infoCount} info`
        );
      }
    } else {
      if (!this.silent) {
        console.log('  [OK] No obvious bugs detected');
      }
    }

    // Penalty: critical bugs = 5 points each, warnings = 0.5, info = 0.1
    // Warnings are often style/best-practice, not critical bugs
    return Math.min(errorCount * 5 + warningCount * 0.5 + infoCount * 0.1, 20);
  }

  async checkPerformance(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Analyzing performance issues...');
    }

    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    let totalIssues = 0;
    let criticalCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    logger.debug(`Analyzing ${files.length} files for performance`);

    for (const file of files) {
      if (this.shouldIgnoreFile(file)) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const perfDetector = new PerformanceDetector(); // Create new instance per file
        const issues = await perfDetector.analyze(file, content);

        if (issues.length > 0) {
          totalIssues += issues.length;
          if (!this.details?.performanceIssues) this.details!.performanceIssues = [];
          this.details!.performanceIssues.push(...issues);

          // Accumulate severity counts
          const counts = perfDetector.getSeverityCount();
          criticalCount += counts.critical;
          moderateCount += counts.moderate;
          minorCount += counts.minor;
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    if (totalIssues > 0) {
      if (criticalCount > 0) {
        this.recommendations.push(`[PERF] Fix ${criticalCount} critical performance issue(s)`);
      }
      if (moderateCount > 0) {
        this.recommendations.push(`[PERF] Optimize ${moderateCount} performance bottleneck(s)`);
      }

      if (!this.silent) {
        console.log(`  [PERF] Found ${totalIssues} performance issues`);
        console.log(
          `     - ${criticalCount} critical, ${moderateCount} moderate, ${minorCount} minor`
        );
      }
    } else {
      if (!this.silent) {
        console.log('  [OK] No performance issues detected');
      }
    }

    // Penalty: critical = 1 point, moderate = 0.5, minor = 0.1
    // Performance issues are often micro-optimizations, not deal-breakers
    return Math.min(criticalCount * 1 + moderateCount * 0.5 + minorCount * 0.1, 15);
  }

  async checkConsistency(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Checking code consistency...');
    }

    const consistencyDetector = new ConsistencyDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    logger.debug(`Analyzing ${files.length} files for consistency`);

    // First pass: analyze codebase patterns
    await consistencyDetector.analyzeCodebase(files);

    // Second pass: analyze individual files
    let totalIssues = 0;
    for (const file of files) {
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
      if (!this.silent) {
        console.log(`  [STYLE] Found ${totalIssues} consistency issues`);
      }

      // Show top categories
      const topCategories = Object.entries(categories)
        .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length)
        .slice(0, 3);

      topCategories.forEach(([category, catIssues]) => {
        if (!this.silent) {
          console.log(`     - ${category}: ${(catIssues as any[]).length}`);
        }
      });
    } else {
      if (!this.silent) {
        console.log('  [OK] Code is consistent');
      }
    }

    // Penalty: 1 point per 3 issues (consistency is less critical)
    return Math.min(Math.floor(totalIssues / 3), 10);
  }

  async checkImports(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Analyzing imports...');
    }

    const importDetector = new ImportDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    let totalIssues = 0;
    logger.debug(`Analyzing ${files.length} files for import issues`);

    for (const file of files) {
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

      if (!this.silent) {
        console.log(`  [IMPORT] Found ${totalIssues} import issues`);
        console.log(`     - ${unusedCount} unused, ${orgCount} organization`);
      }
    } else {
      if (!this.silent) {
        console.log('  [OK] Imports are clean and organized');
      }
    }

    // Penalty: unused imports = 0.5 points each, others = 0.3
    // Import organization is low priority compared to functional issues
    const categories = importDetector.getIssuesByCategory();
    const unusedCount = categories['Unused Imports']?.length || 0;
    const otherCount = totalIssues - unusedCount;

    return Math.min(unusedCount * 0.5 + otherCount * 0.3, 10);
  }

  async checkNextJSPatterns(): Promise<number> {
    if (!this.silent) {
      console.log('[SCAN] Checking Next.js best practices...');
    }

    const nextjsDetector = new NextJSDetector();
    const files = await this.findFiles(['**/*.ts', '**/*.tsx']);
    logger.debug(`Analyzing ${files.length} files for Next.js patterns`);

    for (const file of files) {
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

      if (!this.silent) {
        console.log(`  [NEXTJS] Found ${issues.length} Next.js pattern issues`);
        console.log(
          `     - ${severityCounts.error} errors, ${severityCounts.warning} warnings, ${severityCounts.info} info`
        );
      }

      // Show categories
      const categories = nextjsDetector.getIssuesByCategory();
      const topCategories = Object.entries(categories)
        .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length)
        .slice(0, 3);

      topCategories.forEach(([category, catIssues]) => {
        if (!this.silent) {
          console.log(`     - ${category}: ${(catIssues as any[]).length}`);
        }
      });
    } else {
      if (!this.silent) {
        console.log('  [OK] Next.js patterns look good');
      }
    }

    // Penalty: errors = 3 points, warnings = 1, info = 0.2
    return Math.min(
      severityCounts.error * 3 + severityCounts.warning * 1 + severityCounts.info * 0.2,
      15
    );
  }

  // Helper methods
  private shouldIgnoreFile(file: string): boolean {
    // Check if we're analyzing the Shrimp codebase itself (dogfooding)
    // If so, exclude Shrimp's own implementation files
    const isShrimpProject = file.includes('shrimp-health') || file.includes('/shrimp/');

    if (isShrimpProject) {
      const shrimpExclusions = [
        '/src/core/',
        '/src/detectors/',
        '/src/integrations/',
        '/src/licensing/',
        '/src/utils/',
        '/tests/',
        '/mcp-server/src/',
        '/bin/',
      ];

      if (shrimpExclusions.some(dir => file.includes(dir))) {
        return true;
      }
    }

    // Standard exclusions for all projects
    const ignorePatterns = [
      '*.generated.*',
      'node_modules',
      '.next',
      'dist/',
      'build/',
      '.cache/',
      'coverage/',
      '.test.',
      '.spec.',
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
