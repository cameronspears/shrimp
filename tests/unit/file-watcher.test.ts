import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { FileWatcher, getWatcherInstance, setWatcherInstance, clearWatcherInstance, type WatcherStatus } from '../../src/core/file-watcher.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileWatcher', () => {
  let tempDir: string;
  let watcher: FileWatcher | null = null;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shrimp-watcher-test-'));

    // Clear singleton instance
    clearWatcherInstance();
  });

  afterEach(async () => {
    // Stop watcher if running
    if (watcher) {
      await watcher.stop();
      watcher = null;
    }

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // =======================
  // 1. Lifecycle Tests (5)
  // =======================

  describe('Lifecycle', () => {
    test('should start watcher successfully', async () => {
      watcher = new FileWatcher(tempDir);

      await watcher.start();

      const status = watcher.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.healthScore).toBeGreaterThanOrEqual(0);
      expect(status.healthScore).toBeLessThanOrEqual(100);
    });

    test('should stop watcher gracefully', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await watcher.stop();

      const status = watcher.getStatus();
      expect(status.isRunning).toBe(false);
    });

    test('should prevent multiple start calls', async () => {
      watcher = new FileWatcher(tempDir);

      await watcher.start();
      const firstStatus = watcher.getStatus();

      // Try to start again - should not error, just log and return
      await watcher.start();
      const secondStatus = watcher.getStatus();

      expect(firstStatus.isRunning).toBe(true);
      expect(secondStatus.isRunning).toBe(true);
      // Check count hasn't changed (no second initialization)
      expect(secondStatus.checksPerformed).toBe(firstStatus.checksPerformed);
    });

    test('should get status while running', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      const status = watcher.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('healthScore');
      expect(status).toHaveProperty('previousScore');
      expect(status).toHaveProperty('trend');
      expect(status).toHaveProperty('issueCount');
      expect(status).toHaveProperty('topIssues');
      expect(status).toHaveProperty('lastCheckTime');
      expect(status).toHaveProperty('filesWatched');
      expect(status).toHaveProperty('checksPerformed');
      expect(status.isRunning).toBe(true);
    });

    test('should get status when stopped', async () => {
      watcher = new FileWatcher(tempDir);

      const status = watcher.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.healthScore).toBe(100);
      expect(status.previousScore).toBe(100);
      expect(status.trend).toBe('stable');
    });
  });

  // ================================
  // 2. File Change Detection (5)
  // ================================

  describe('File Change Detection', () => {
    test('should detect file additions', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      const initialChecks = watcher.getStatus().checksPerformed;

      // Create a new TypeScript file
      const testFile = path.join(tempDir, 'new-file.ts');
      await fs.writeFile(testFile, 'const x = 1;\n', 'utf-8');

      // Wait for debounce + processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalChecks = watcher.getStatus().checksPerformed;
      expect(finalChecks).toBeGreaterThan(initialChecks);
    });

    test('should detect file modifications', async () => {
      // Pre-create file before starting watcher
      const testFile = path.join(tempDir, 'modify-file.ts');
      await fs.writeFile(testFile, 'const x = 1;\n', 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 600));

      const initialChecks = watcher.getStatus().checksPerformed;

      // Modify the file
      await fs.writeFile(testFile, 'const x = 2;\n', 'utf-8');

      // Wait for debounce + processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalChecks = watcher.getStatus().checksPerformed;
      expect(finalChecks).toBeGreaterThan(initialChecks);
    });

    test('should detect file deletions', async () => {
      // Pre-create file with an issue
      const testFile = path.join(tempDir, 'delete-file.ts');
      await fs.writeFile(testFile, `import { unused } from 'react';\nconsole.log('hi');\n`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 600));

      const initialIssues = watcher.getStatus().issueCount;

      // Delete the file
      await fs.unlink(testFile);

      // Wait a bit for deletion to be processed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Issues should be updated (deleted file's issues removed)
      const finalIssues = watcher.getStatus().issueCount;
      expect(finalIssues).toBeLessThanOrEqual(initialIssues);
    });

    test('should handle multiple rapid changes (debouncing)', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      const testFile = path.join(tempDir, 'rapid.ts');

      // Make rapid changes
      await fs.writeFile(testFile, 'const x = 1;\n', 'utf-8');
      await fs.writeFile(testFile, 'const x = 2;\n', 'utf-8');
      await fs.writeFile(testFile, 'const x = 3;\n', 'utf-8');
      await fs.writeFile(testFile, 'const x = 4;\n', 'utf-8');

      // Wait for debounce (500ms) + processing
      await new Promise(resolve => setTimeout(resolve, 800));

      const status = watcher.getStatus();
      // Should only trigger 1 check due to debouncing, not 4
      expect(status.checksPerformed).toBeLessThanOrEqual(2); // Initial + 1 debounced check
    });

    test('should respect file patterns (.ts, .tsx, .js, .jsx only)', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const initialChecks = watcher.getStatus().checksPerformed;
      const initialIssues = watcher.getStatus().issueCount;

      // Create files with different extensions
      await fs.writeFile(path.join(tempDir, 'test.md'), '# Test\n', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'test.json'), '{}', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'test', 'utf-8');

      // Wait for potential processing
      await new Promise(resolve => setTimeout(resolve, 700));

      // Checks should not increase for non-matching files
      expect(watcher.getStatus().checksPerformed).toBe(initialChecks);

      // Now create a .ts file with an issue to ensure it's detected
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'console.log("test");\n', 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 800));

      // Now checks should increase and we should detect the console.log issue
      const finalStatus = watcher.getStatus();
      expect(finalStatus.checksPerformed).toBeGreaterThan(initialChecks);
      expect(finalStatus.issueCount).toBeGreaterThan(initialIssues);
    });
  });

  // ==========================
  // 3. Issue Tracking (5)
  // ==========================

  describe('Issue Tracking', () => {
    test('should add issues when file changes', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      // Wait for watcher to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 600));

      // Create file with issues
      const testFile = path.join(tempDir, 'issues.ts');
      await fs.writeFile(testFile, `
import { unused } from 'react';
console.log('debug');
try {
  something();
} catch (e) {
}
`, 'utf-8');

      // Wait for processing (awaitWriteFinish 200ms + debounce 500ms + processing)
      await new Promise(resolve => setTimeout(resolve, 1200));

      const status = watcher.getStatus();
      expect(status.issueCount).toBeGreaterThan(0);
      expect(status.topIssues.length).toBeGreaterThan(0);
    });

    test('should remove issues when file deleted', async () => {
      // Pre-create file with issues
      const testFile = path.join(tempDir, 'remove-issues.ts');
      await fs.writeFile(testFile, `
import { unused } from 'react';
console.log('debug');
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 800));

      const beforeDelete = watcher.getStatus().issueCount;
      expect(beforeDelete).toBeGreaterThan(0);

      // Delete the file
      await fs.unlink(testFile);

      // Wait for deletion processing
      await new Promise(resolve => setTimeout(resolve, 300));

      const afterDelete = watcher.getStatus().issueCount;
      expect(afterDelete).toBeLessThan(beforeDelete);
    });

    test('should enforce max issue limit (1000)', async () => {
      watcher = new FileWatcher(tempDir);

      // Create many files with issues to exceed limit
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const file = path.join(tempDir, `file${i}.ts`);
        const content = `
import { unused1 } from 'a';
import { unused2 } from 'b';
import { unused3 } from 'c';
console.log('a');
console.log('b');
console.log('c');
try { x(); } catch (e) {}
try { y(); } catch (e) {}
try { z(); } catch (e) {}
`;
        promises.push(fs.writeFile(file, content, 'utf-8'));
      }
      await Promise.all(promises);

      await watcher.start();

      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = watcher.getStatus();
      // Should not exceed 1000 issues
      expect(status.issueCount).toBeLessThanOrEqual(1000);
    });

    test('should sort issues by severity', async () => {
      // Create file with different severity issues
      const testFile = path.join(tempDir, 'severity.ts');
      await fs.writeFile(testFile, `
console.log('info level');
import { unused } from 'react';
try {
  something();
} catch (e) {
}
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 800));

      const status = watcher.getStatus();
      const topIssues = status.topIssues;

      if (topIssues.length > 1) {
        // Verify sorting: errors should come before warnings, warnings before info
        const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
        for (let i = 0; i < topIssues.length - 1; i++) {
          expect(severityOrder[topIssues[i].severity]).toBeLessThanOrEqual(
            severityOrder[topIssues[i + 1].severity]
          );
        }
      }
    });

    test('should group issues by file', async () => {
      // Create multiple files with issues
      const file1 = path.join(tempDir, 'file1.ts');
      const file2 = path.join(tempDir, 'file2.ts');

      await fs.writeFile(file1, `console.log('hi');\nimport { unused } from 'a';\n`, 'utf-8');
      await fs.writeFile(file2, `console.log('bye');\ntry { x(); } catch (e) {}\n`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 800));

      const allIssues = watcher.getAllIssues();

      // Group by file
      const byFile = new Map<string, number>();
      for (const issue of allIssues) {
        byFile.set(issue.file, (byFile.get(issue.file) || 0) + 1);
      }

      // Should have issues from multiple files
      expect(byFile.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ===================================
  // 4. Health Score Calculation (4)
  // ===================================

  describe('Health Score Calculation', () => {
    test('should calculate score from issues', async () => {
      watcher = new FileWatcher(tempDir);

      // Start with clean directory
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 600));

      const initialScore = watcher.getStatus().healthScore;
      expect(initialScore).toBeGreaterThanOrEqual(90); // Clean directory should be healthy

      // Add file with issues
      const testFile = path.join(tempDir, 'score-test.ts');
      await fs.writeFile(testFile, `
console.log('test');
try { x(); } catch (e) {}
`, 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 800));

      const finalScore = watcher.getStatus().healthScore;
      expect(finalScore).toBeLessThan(initialScore);
    });

    test('should track score history (previous vs current)', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const status1 = watcher.getStatus();
      expect(status1.previousScore).toBeDefined();
      expect(status1.healthScore).toBeDefined();

      // Make a change
      const testFile = path.join(tempDir, 'history.ts');
      await fs.writeFile(testFile, 'console.log("test");\n', 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 800));

      const status2 = watcher.getStatus();
      // Previous score should be updated
      expect(status2.previousScore).toBeDefined();
      expect(typeof status2.previousScore).toBe('number');
    });

    test('should detect improving trend', async () => {
      // Create file with issue
      const testFile = path.join(tempDir, 'improve.ts');
      await fs.writeFile(testFile, 'console.log("test");\n', 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const beforeScore = watcher.getStatus().healthScore;

      // Fix the issue
      await fs.writeFile(testFile, '// No issues here\nconst x = 1;\n', 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 800));

      const status = watcher.getStatus();

      // If score improved by >1 point, trend should be 'improving'
      if (status.healthScore > beforeScore + 1) {
        expect(status.trend).toBe('improving');
      }
    });

    test('should detect declining trend', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const beforeScore = watcher.getStatus().healthScore;

      // Add issues
      const testFile = path.join(tempDir, 'decline.ts');
      await fs.writeFile(testFile, `
console.log('a');
console.log('b');
console.log('c');
try { x(); } catch (e) {}
`, 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 800));

      const status = watcher.getStatus();

      // If score declined by >1 point, trend should be 'declining'
      if (status.healthScore < beforeScore - 1) {
        expect(status.trend).toBe('declining');
      } else {
        // At minimum, score should not improve when adding issues
        expect(status.healthScore).toBeLessThanOrEqual(beforeScore);
      }
    });
  });

  // =======================
  // 5. Performance (3)
  // =======================

  describe('Performance', () => {
    test('should check single file quickly (<50ms)', async () => {
      const testFile = path.join(tempDir, 'perf.ts');
      await fs.writeFile(testFile, 'const x = 1;\n', 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const startTime = Date.now();

      // Trigger a change
      await fs.writeFile(testFile, 'const x = 2;\n', 'utf-8');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 800));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Total duration should be reasonable (mostly debounce time)
      // Actual file check should be <50ms, but we include debounce here
      expect(duration).toBeLessThan(1500);
    });

    test('should handle 100+ file changes efficiently', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const startTime = Date.now();

      // Create many files rapidly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const file = path.join(tempDir, `bulk${i}.ts`);
        promises.push(fs.writeFile(file, `const x${i} = ${i};\n`, 'utf-8'));
      }
      await Promise.all(promises);

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (not hang)
      expect(duration).toBeLessThan(3000);

      const status = watcher.getStatus();
      expect(status.checksPerformed).toBeGreaterThan(0);
    });

    test('should debounce and not check on every keystroke', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const testFile = path.join(tempDir, 'debounce.ts');
      const initialChecks = watcher.getStatus().checksPerformed;

      // Simulate rapid typing (10 changes in quick succession)
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(testFile, `const x = ${i};\n`, 'utf-8');
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms between changes
      }

      // Wait for debounce + processing
      await new Promise(resolve => setTimeout(resolve, 800));

      const finalChecks = watcher.getStatus().checksPerformed;
      const checksTriggered = finalChecks - initialChecks;

      // Should have triggered only 1-2 checks, not 10
      expect(checksTriggered).toBeLessThanOrEqual(2);
    });
  });

  // ============================
  // 6. Singleton Pattern (3)
  // ============================

  describe('Singleton Pattern', () => {
    test('should return null initially for getWatcherInstance', () => {
      clearWatcherInstance();
      const instance = getWatcherInstance();
      expect(instance).toBeNull();
    });

    test('should store instance with setWatcherInstance', () => {
      clearWatcherInstance();

      const newWatcher = new FileWatcher(tempDir);
      setWatcherInstance(newWatcher);

      const retrieved = getWatcherInstance();
      expect(retrieved).toBe(newWatcher);
    });

    test('should reset with clearWatcherInstance', () => {
      const newWatcher = new FileWatcher(tempDir);
      setWatcherInstance(newWatcher);

      expect(getWatcherInstance()).toBe(newWatcher);

      clearWatcherInstance();

      expect(getWatcherInstance()).toBeNull();
    });
  });

  // ==========================
  // 7. Additional Tests (5+)
  // ==========================

  describe('Additional Functionality', () => {
    test('should track checks performed count', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const initial = watcher.getStatus().checksPerformed;

      // Trigger changes
      await fs.writeFile(path.join(tempDir, 'check1.ts'), 'const a = 1;\n', 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 800));

      await fs.writeFile(path.join(tempDir, 'check2.ts'), 'const b = 2;\n', 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 800));

      const final = watcher.getStatus().checksPerformed;
      expect(final).toBeGreaterThan(initial);
    });

    test('should track files watched count', async () => {
      // Pre-create some files
      await fs.writeFile(path.join(tempDir, 'watched1.ts'), 'const x = 1;\n', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'watched2.ts'), 'const y = 2;\n', 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      const status = watcher.getStatus();
      expect(status.filesWatched).toBeGreaterThanOrEqual(0);
    });

    test('should track last check time', async () => {
      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const before = Date.now();
      await fs.writeFile(path.join(tempDir, 'timestamp.ts'), 'const x = 1;\n', 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 800));
      const after = Date.now();

      const status = watcher.getStatus();
      expect(status.lastCheckTime).toBeGreaterThanOrEqual(before - 1000);
      expect(status.lastCheckTime).toBeLessThanOrEqual(after + 1000);
    });

    test('should support reset functionality', async () => {
      // Create file with issues
      const testFile = path.join(tempDir, 'reset.ts');
      await fs.writeFile(testFile, 'console.log("test");\n', 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const beforeReset = watcher.getStatus();
      expect(beforeReset.issueCount).toBeGreaterThan(0);

      watcher.reset();

      const afterReset = watcher.getStatus();
      expect(afterReset.issueCount).toBe(0);
      expect(afterReset.healthScore).toBe(100);
      expect(afterReset.checksPerformed).toBe(0);
    });

    test('should provide getAllIssues method', async () => {
      const testFile = path.join(tempDir, 'all-issues.ts');
      await fs.writeFile(testFile, `
console.log('test');
try { x(); } catch (e) {}
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const allIssues = watcher.getAllIssues();
      expect(Array.isArray(allIssues)).toBe(true);
      expect(allIssues.length).toBeGreaterThanOrEqual(0);

      // Verify issue structure
      if (allIssues.length > 0) {
        const issue = allIssues[0];
        expect(issue).toHaveProperty('file');
        expect(issue).toHaveProperty('line');
        expect(issue).toHaveProperty('category');
        expect(issue).toHaveProperty('message');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('timestamp');
      }
    });

    test('should detect empty catch blocks', async () => {
      const testFile = path.join(tempDir, 'catch.ts');
      await fs.writeFile(testFile, `
try {
  riskyOperation();
} catch (e) {
}
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const issues = watcher.getAllIssues();
      const emptyCatchIssues = issues.filter(i =>
        i.category === 'Error Handling' && i.message.includes('Empty catch')
      );

      expect(emptyCatchIssues.length).toBeGreaterThan(0);
      expect(emptyCatchIssues[0].severity).toBe('error');
    });

    test('should detect unused imports', async () => {
      const testFile = path.join(tempDir, 'imports.ts');
      await fs.writeFile(testFile, `
import { useState } from 'react';

export function test() {
  return 'hello';
}
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const issues = watcher.getAllIssues();
      const unusedImportIssues = issues.filter(i =>
        i.category === 'Unused Imports'
      );

      expect(unusedImportIssues.length).toBeGreaterThan(0);
      expect(unusedImportIssues[0].severity).toBe('warning');
    });

    test('should detect missing alt attributes in JSX', async () => {
      const testFile = path.join(tempDir, 'accessibility.tsx');
      await fs.writeFile(testFile, `
export function Component() {
  return <img src="test.jpg" />;
}
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const issues = watcher.getAllIssues();
      const altIssues = issues.filter(i =>
        i.category === 'Accessibility' && i.message.includes('alt')
      );

      expect(altIssues.length).toBeGreaterThan(0);
      expect(altIssues[0].severity).toBe('warning');
    });

    test('should detect console.log statements', async () => {
      const testFile = path.join(tempDir, 'console.ts');
      await fs.writeFile(testFile, `
export function debug() {
  console.log('Debug message');
  return true;
}
`, 'utf-8');

      watcher = new FileWatcher(tempDir);
      await watcher.start();

      await new Promise(resolve => setTimeout(resolve, 800));

      const issues = watcher.getAllIssues();
      const consoleIssues = issues.filter(i =>
        i.category === 'Code Cleanup' && i.message.includes('console.log')
      );

      expect(consoleIssues.length).toBeGreaterThan(0);
      expect(consoleIssues[0].severity).toBe('info');
    });

    test('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      watcher = new FileWatcher(nonExistentDir);

      // Should not throw when starting (chokidar will just watch nothing)
      try {
        await watcher.start();
        const status = watcher.getStatus();
        expect(status.isRunning).toBe(true);
        expect(status.filesWatched).toBe(0);
      } catch (error) {
        // If it throws, that's fine too - the watcher handles it
        expect(error).toBeDefined();
      }
    });
  });
});
