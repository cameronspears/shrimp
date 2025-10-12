import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { ShrimpChecks } from './health-analyzer.js';

export interface WatcherIssue {
  file: string;
  line: number;
  category: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  timestamp: number;
}

export interface WatcherStatus {
  isRunning: boolean;
  healthScore: number;
  previousScore: number;
  trend: 'improving' | 'declining' | 'stable';
  issueCount: number;
  topIssues: WatcherIssue[];
  lastCheckTime: number;
  filesWatched: number;
  checksPerformed: number;
}

/**
 * File Watcher for Real-Time Health Monitoring
 *
 * Watches source files for changes and runs incremental health checks.
 * Designed to be fast (< 50ms per check) and memory efficient.
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private issues: Map<string, WatcherIssue[]> = new Map();
  private healthScore: number = 100;
  private previousScore: number = 100;
  private isRunning: boolean = false;
  private watchRoot: string;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private pendingFiles: Set<string> = new Set();
  private checksPerformed: number = 0;
  private filesWatched: number = 0;
  private lastCheckTime: number = Date.now();

  // Configuration
  private readonly DEBOUNCE_MS = 500;
  private readonly MAX_ISSUES = 1000;
  private readonly PATTERNS = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
  ];
  private readonly IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
  ];

  constructor(rootPath: string = process.cwd()) {
    this.watchRoot = path.resolve(rootPath);
  }

  /**
   * Start watching files for changes
   */
  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        console.log('[Watcher] Already running');
        return;
      }

      console.log('[Watcher] Starting file watcher...');
      console.log(`[Watcher] Watching: ${this.watchRoot}`);

      // Initial health check
      await this.performInitialCheck();

      // Start watching - watch root directory with file type filters
      this.watcher = chokidar.watch(this.watchRoot, {
        ignored: [
          /(^|[\/\\])\../,  // Ignore dotfiles
          ...this.IGNORE_PATTERNS,
        ],
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      this.watcher.on('change', (filePath: string) => {
        // Only process files matching our patterns
        if (this.matchesPattern(filePath)) {
          this.onFileChanged(filePath);
        }
      });

      this.watcher.on('add', (filePath: string) => {
        // Only process files matching our patterns
        if (this.matchesPattern(filePath)) {
          this.onFileChanged(filePath);
        }
      });

      this.watcher.on('unlink', (filePath: string) => {
        this.onFileDeleted(filePath);
      });

      // Wait for watcher to be ready
      await new Promise<void>((resolve) => {
        this.watcher?.on('ready', () => {
          const watched = this.watcher?.getWatched();
          if (watched) {
            this.filesWatched = Object.values(watched as Record<string, string[]>).reduce((sum: number, files: string[]) => sum + files.length, 0);
          }
          console.log(`[Watcher] Watching ${this.filesWatched} files`);
          console.log(`[Watcher] Initial health: ${this.healthScore}/100`);
          resolve();
        });
      });

      this.isRunning = true;
    } catch (error) {
      console.error('[Watcher] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        return;
      }

      console.log('[Watcher] Stopping file watcher...');

      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = null;
      }

      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      this.isRunning = false;
      console.log('[Watcher] Stopped');
    } catch (error) {
      console.error('[Watcher] Error while stopping:', error);
      this.isRunning = false;
    }
  }

  /**
   * Get current watcher status
   */
  getStatus(): WatcherStatus {
    const allIssues = Array.from(this.issues.values()).flat();
    const topIssues = allIssues
      .sort((a, b) => {
        // Sort by severity first, then timestamp
        const severityOrder = { error: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp - a.timestamp;
      })
      .slice(0, 10);

    const trend = this.calculateTrend();

    return {
      isRunning: this.isRunning,
      healthScore: this.healthScore,
      previousScore: this.previousScore,
      trend,
      issueCount: allIssues.length,
      topIssues,
      lastCheckTime: this.lastCheckTime,
      filesWatched: this.filesWatched,
      checksPerformed: this.checksPerformed,
    };
  }

  /**
   * Perform initial health check on startup
   */
  private async performInitialCheck(): Promise<void> {
    try {
      console.log('[Watcher] Running initial health check...');

      const startTime = Date.now();
      const details: any = {
        bugIssues: [],
        performanceIssues: [],
        consistencyIssues: [],
        importIssues: [],
        wcagIssues: [],
        nextJSIssues: [],
      };

      const checks = new ShrimpChecks(this.watchRoot, false, details, []);

      // Run all detectors
      let score = 100;
      score -= await checks.checkForBugs();
      score -= await checks.checkPerformance();
      score -= await checks.checkConsistency();
      score -= await checks.checkImports();
      score -= await checks.checkNextJSPatterns();

      this.healthScore = Math.max(0, Math.min(100, score));
      this.previousScore = this.healthScore;

      // Store issues in memory
      this.storeIssues(details);

      const duration = Date.now() - startTime;
      console.log(`[Watcher] Initial check complete: ${this.healthScore}/100 (${duration}ms)`);
    } catch (error) {
      console.error('[Watcher] Error during initial check:', error);
      // Set a default score if check fails
      this.healthScore = 50;
      this.previousScore = 50;
    }
  }

  /**
   * Check if file matches our patterns
   */
  private matchesPattern(filePath: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Handle file change event
   */
  private onFileChanged(filePath: string): void {
    // Chokidar provides absolute paths when watching a directory
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.watchRoot, filePath);
    this.pendingFiles.add(fullPath);

    // Debounce: wait for 500ms of silence before checking
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.processChangedFiles();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Handle file deletion event
   */
  private onFileDeleted(filePath: string): void {
    // Chokidar provides absolute paths when watching a directory
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.watchRoot, filePath);

    // Remove issues for deleted file
    this.issues.delete(fullPath);

    // Recalculate health score
    this.recalculateHealthScore();
  }

  /**
   * Process all pending file changes
   */
  private async processChangedFiles(): Promise<void> {
    if (this.pendingFiles.size === 0) return;

    try {
      const files = Array.from(this.pendingFiles);
      this.pendingFiles.clear();

      const startTime = Date.now();
      console.log(`[Watcher] Checking ${files.length} changed file(s)...`);

      // Run incremental checks on changed files only
      for (const file of files) {
        await this.checkSingleFile(file);
      }

      this.checksPerformed++;
      this.lastCheckTime = Date.now();
      this.recalculateHealthScore();

      const duration = Date.now() - startTime;
      const trend = this.calculateTrend();
      const trendIcon = trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→';

      console.log(
        `[Watcher] Health: ${this.healthScore}/100 ${trendIcon} (${duration}ms, ${this.issues.size} files with issues)`
      );
    } catch (error) {
      console.error('[Watcher] Error processing changed files:', error);
    }
  }

  /**
   * Check a single file for issues (fast, < 50ms target)
   */
  private async checkSingleFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const fileIssues: WatcherIssue[] = [];

      // Quick pattern matching for common issues
      // These are fast checks that don't require full AST parsing

      // 1. Unused imports (basic check)
      const importLines = new Map<number, string>();
      const importedNames = new Set<string>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for imports
        const importMatch = line.match(/import\s+(?:{([^}]+)}|(\w+))/);
        if (importMatch) {
          importLines.set(i, line);
          const names = importMatch[1]
            ? importMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0])
            : [importMatch[2]];
          names.forEach(name => importedNames.add(name));
        }
      }

      // Check if imports are used
      for (const [lineNum, importLine] of importLines) {
        const importMatch = importLine.match(/import\s+(?:{([^}]+)}|(\w+))/);
        if (importMatch) {
          const names = importMatch[1]
            ? importMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0])
            : [importMatch[2]];

          for (const name of names) {
            // Simple check: is the name used anywhere else in the file?
            const usageCount = lines.filter((l, idx) => idx !== lineNum && l.includes(name)).length;
            if (usageCount === 0) {
              fileIssues.push({
                file: filePath,
                line: lineNum + 1,
                category: 'Unused Imports',
                message: `Unused import '${name}'`,
                severity: 'warning',
                timestamp: Date.now(),
              });
            }
          }
        }
      }

      // 2. Empty catch blocks
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('} catch')) {
          // Check if next non-empty line is just a closing brace
          let nextLineIdx = i + 1;
          while (nextLineIdx < lines.length && lines[nextLineIdx].trim() === '') {
            nextLineIdx++;
          }
          if (nextLineIdx < lines.length && lines[nextLineIdx].trim() === '}') {
            fileIssues.push({
              file: filePath,
              line: i + 1,
              category: 'Error Handling',
              message: 'Empty catch block - errors are silently swallowed',
              severity: 'error',
              timestamp: Date.now(),
            });
          }
        }
      }

      // 3. Missing alt text (React/JSX)
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for <img> or <Image> tags without alt attribute
          if ((line.includes('<img') || line.includes('<Image')) && !line.includes('alt=')) {
            fileIssues.push({
              file: filePath,
              line: i + 1,
              category: 'Accessibility',
              message: 'Image missing alt attribute',
              severity: 'warning',
              timestamp: Date.now(),
            });
          }
        }
      }

      // 4. Console.log statements
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('console.log') && !line.trim().startsWith('//')) {
          fileIssues.push({
            file: filePath,
            line: i + 1,
            category: 'Code Cleanup',
            message: 'console.log statement should be removed',
            severity: 'info',
            timestamp: Date.now(),
          });
        }
      }

      // Update issues for this file
      if (fileIssues.length > 0) {
        this.issues.set(filePath, fileIssues);
      } else {
        this.issues.delete(filePath);
      }

      // Enforce max issues limit
      this.enforceIssueLimit();

    } catch (error) {
      console.error(`[Watcher] Error checking ${filePath}:`, error);
    }
  }

  /**
   * Store issues from full health check
   */
  private storeIssues(details: any): void {
    const allIssues = [
      ...(details.bugIssues || []),
      ...(details.performanceIssues || []),
      ...(details.consistencyIssues || []),
      ...(details.importIssues || []),
      ...(details.wcagIssues || []),
      ...(details.nextJSIssues || []),
    ];

    // Group by file
    const byFile = new Map<string, WatcherIssue[]>();
    for (const issue of allIssues) {
      const fileIssues = byFile.get(issue.file) || [];
      fileIssues.push({
        file: issue.file,
        line: issue.line || 0,
        category: issue.category || 'General',
        message: issue.message || 'Unknown issue',
        severity: issue.severity || 'warning',
        timestamp: Date.now(),
      });
      byFile.set(issue.file, fileIssues);
    }

    this.issues = byFile;
    this.enforceIssueLimit();
  }

  /**
   * Enforce maximum issue count (keep most recent/severe)
   */
  private enforceIssueLimit(): void {
    const allIssues = Array.from(this.issues.values()).flat();

    if (allIssues.length > this.MAX_ISSUES) {
      // Sort by severity and timestamp
      const sorted = allIssues.sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp - a.timestamp;
      });

      // Keep top issues
      const kept = sorted.slice(0, this.MAX_ISSUES);

      // Rebuild issues map
      this.issues.clear();
      for (const issue of kept) {
        const fileIssues = this.issues.get(issue.file) || [];
        fileIssues.push(issue);
        this.issues.set(issue.file, fileIssues);
      }
    }
  }

  /**
   * Recalculate health score based on current issues
   */
  private recalculateHealthScore(): void {
    this.previousScore = this.healthScore;

    const allIssues = Array.from(this.issues.values()).flat();

    let deduction = 0;
    for (const issue of allIssues) {
      switch (issue.severity) {
        case 'error':
          deduction += 0.5;
          break;
        case 'warning':
          deduction += 0.3;
          break;
        case 'info':
          deduction += 0.1;
          break;
      }
    }

    this.healthScore = Math.max(0, Math.min(100, 100 - deduction));
  }

  /**
   * Calculate health trend
   */
  private calculateTrend(): 'improving' | 'declining' | 'stable' {
    const diff = this.healthScore - this.previousScore;
    if (Math.abs(diff) < 1) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  }

  /**
   * Get all current issues
   */
  getAllIssues(): WatcherIssue[] {
    return Array.from(this.issues.values()).flat();
  }

  /**
   * Clear all issues and reset
   */
  reset(): void {
    this.issues.clear();
    this.healthScore = 100;
    this.previousScore = 100;
    this.checksPerformed = 0;
  }
}

// Singleton instance for MCP server to access
let watcherInstance: FileWatcher | null = null;

export function getWatcherInstance(): FileWatcher | null {
  return watcherInstance;
}

export function setWatcherInstance(watcher: FileWatcher): void {
  watcherInstance = watcher;
}

export function clearWatcherInstance(): void {
  watcherInstance = null;
}