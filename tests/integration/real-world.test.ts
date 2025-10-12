import { describe, it, expect, beforeAll } from 'bun:test';
import path from 'path';
import fs from 'fs';
import { BugDetectorAST as BugDetector } from '../../src/detectors/bug-detector-ast';
import { PerformanceDetector } from '../../src/detectors/performance-detector';
import { ImportDetector } from '../../src/detectors/import-detector';

/**
 * Integration tests using gielinor-gains as a real-world test corpus
 * This validates that Shrimp works on actual production code
 */

const GIELINOR_GAINS_PATH = path.resolve(__dirname, '../../../gielinor-gains');
const BASELINE_PATH = path.join(__dirname, '../baselines/gielinor-gains-baseline.json');

interface BaselineData {
  timestamp: string;
  totalFiles: number;
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: { error: number; warning: number; info: number };
  filesAnalyzed: number;
  version: string;
}

describe('Real World Integration: gielinor-gains', () => {
  let allTsFiles: string[];

  beforeAll(() => {
    // Verify the project exists
    if (!fs.existsSync(GIELINOR_GAINS_PATH)) {
      throw new Error(`gielinor-gains project not found at ${GIELINOR_GAINS_PATH}`);
    }

    // Find all TypeScript files
    allTsFiles = findTsFiles(GIELINOR_GAINS_PATH);
    console.log(`Found ${allTsFiles.length} TypeScript files to analyze`);
  });

  describe('Bug Detection', () => {
    it('should analyze gielinor-gains without crashing', async () => {
      const detector = new BugDetector();
      let analyzed = 0;
      let totalIssues = 0;

      for (const file of allTsFiles.slice(0, 50)) { // Sample first 50 files
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);
        analyzed++;
        totalIssues += issues.length;
      }

      expect(analyzed).toBe(50);
      console.log(`Analyzed ${analyzed} files, found ${totalIssues} issues`);
    });

    it('should find issues in gielinor-gains codebase', async () => {
      const detector = new BugDetector();
      let totalIssues = 0;

      for (const file of allTsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);
        totalIssues += issues.length;
      }

      // We expect to find at least SOME issues in a real codebase
      expect(totalIssues).toBeGreaterThan(0);

      // But not an absurd amount (would indicate false positives)
      const avgIssuesPerFile = totalIssues / allTsFiles.length;
      expect(avgIssuesPerFile).toBeLessThan(5); // Max 5 issues per file on average

      console.log(`Total issues found: ${totalIssues} (avg ${avgIssuesPerFile.toFixed(2)} per file)`);
    });

    it('should not flag test files aggressively', async () => {
      const detector = new BugDetector();
      const testFiles = allTsFiles.filter(f => f.includes('.test.') || f.includes('/tests/'));

      if (testFiles.length === 0) {
        return; // Skip if no test files
      }

      let totalIssues = 0;
      for (const file of testFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);
        totalIssues += issues.length;
      }

      const avgIssuesPerTestFile = totalIssues / testFiles.length;

      // Test files should have fewer issues (we're lenient with them)
      expect(avgIssuesPerTestFile).toBeLessThan(5);

      console.log(`Test files: ${testFiles.length}, avg issues: ${avgIssuesPerTestFile.toFixed(2)}`);
    });
  });

  describe('Performance Detection', () => {
    it('should analyze React components for performance issues', async () => {
      const detector = new PerformanceDetector();
      const componentFiles = allTsFiles.filter(f =>
        f.includes('/components/') || f.includes('/app/') && f.endsWith('.tsx')
      );

      if (componentFiles.length === 0) return;

      let totalIssues = 0;
      for (const file of componentFiles.slice(0, 30)) {
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);
        totalIssues += issues.length;
      }

      console.log(`Performance issues in components: ${totalIssues}`);
      expect(totalIssues).toBeGreaterThanOrEqual(0); // Just verify it runs
    });
  });

  describe('Import Detection', () => {
    it('should detect import issues', async () => {
      const detector = new ImportDetector();

      let totalIssues = 0;
      for (const file of allTsFiles.slice(0, 50)) {
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);
        totalIssues += issues.length;
      }

      console.log(`Import issues found: ${totalIssues}`);
      expect(totalIssues).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Baseline Tracking', () => {
    it('should generate and compare against baseline', async () => {
      const detector = new BugDetector();

      const currentResults: BaselineData = {
        timestamp: new Date().toISOString(),
        totalFiles: allTsFiles.length,
        totalIssues: 0,
        issuesByCategory: {},
        issuesBySeverity: { error: 0, warning: 0, info: 0 },
        filesAnalyzed: 0,
        version: '1.0.0',
      };

      // Analyze all files
      for (const file of allTsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);

        currentResults.filesAnalyzed++;
        currentResults.totalIssues += issues.length;

        // Count by category
        issues.forEach(issue => {
          currentResults.issuesByCategory[issue.category] =
            (currentResults.issuesByCategory[issue.category] || 0) + 1;
          currentResults.issuesBySeverity[issue.severity]++;
        });
      }

      // Save baseline if it doesn't exist
      const baselineDir = path.dirname(BASELINE_PATH);
      if (!fs.existsSync(baselineDir)) {
        fs.mkdirSync(baselineDir, { recursive: true });
      }

      if (!fs.existsSync(BASELINE_PATH)) {
        fs.writeFileSync(BASELINE_PATH, JSON.stringify(currentResults, null, 2));
        console.log('Baseline created:', currentResults);
      } else {
        // Compare against baseline
        const baseline: BaselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));

        console.log('\nBaseline Comparison:');
        console.log(`Previous: ${baseline.totalIssues} issues`);
        console.log(`Current:  ${currentResults.totalIssues} issues`);
        console.log(`Change:   ${currentResults.totalIssues - baseline.totalIssues > 0 ? '+' : ''}${currentResults.totalIssues - baseline.totalIssues}`);

        // Alert if issues increased significantly
        const increase = currentResults.totalIssues - baseline.totalIssues;
        const percentIncrease = (increase / baseline.totalIssues) * 100;

        if (percentIncrease > 10) {
          console.warn(`WARNING: Issues increased by ${percentIncrease.toFixed(1)}%`);
        }

        // We don't fail the test on increase, but we track it
        expect(currentResults.totalIssues).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Detection Quality Metrics', () => {
    it('should maintain reasonable detection rates', async () => {
      const detector = new BugDetector();

      let totalIssues = 0;
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;

      for (const file of allTsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const issues = await detector.analyze(file, content);

        totalIssues += issues.length;
        errorCount += issues.filter(i => i.severity === 'error').length;
        warningCount += issues.filter(i => i.severity === 'warning').length;
        infoCount += issues.filter(i => i.severity === 'info').length;
      }

      const avgPerFile = totalIssues / allTsFiles.length;

      // Reasonable bounds
      expect(avgPerFile).toBeLessThan(10); // Not too aggressive
      expect(avgPerFile).toBeGreaterThan(0); // Should find something

      // Severity distribution should be reasonable
      // Errors should be rare (most serious issues)
      const errorRate = errorCount / totalIssues;
      expect(errorRate).toBeLessThan(0.3); // Less than 30% errors

      console.log('\nDetection Quality Metrics:');
      console.log(`Average issues per file: ${avgPerFile.toFixed(2)}`);
      console.log(`Severity distribution:`);
      console.log(`  Errors:   ${errorCount} (${(errorRate * 100).toFixed(1)}%)`);
      console.log(`  Warnings: ${warningCount} (${(warningCount / totalIssues * 100).toFixed(1)}%)`);
      console.log(`  Info:     ${infoCount} (${(infoCount / totalIssues * 100).toFixed(1)}%)`);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should analyze files quickly', async () => {
      const detector = new BugDetector();
      const sampleFiles = allTsFiles.slice(0, 100);

      const start = Date.now();

      for (const file of sampleFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        await detector.analyze(file, content);
      }

      const duration = Date.now() - start;
      const avgTimePerFile = duration / sampleFiles.length;

      console.log(`Analyzed ${sampleFiles.length} files in ${duration}ms`);
      console.log(`Average time per file: ${avgTimePerFile.toFixed(2)}ms`);

      // Should be fast (under 50ms per file on average)
      expect(avgTimePerFile).toBeLessThan(50);
    });
  });
});

/**
 * Helper function to recursively find all TypeScript files
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules, .next, and other build artifacts
    if (entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === '.git') {
      continue;
    }

    if (entry.isDirectory()) {
      findTsFiles(fullPath, files);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}
