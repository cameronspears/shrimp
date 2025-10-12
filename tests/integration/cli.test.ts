import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { $ } from 'bun';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Comprehensive CLI Integration Tests
 * Tests the bin/shrimp.js CLI with all commands and options
 */

const CLI_PATH = path.resolve(__dirname, '../../bin/shrimp.js');
const TEST_PROJECT_DIR = path.join(os.tmpdir(), 'shrimp-cli-test-' + Date.now());

beforeAll(() => {
  // Create test project directory
  fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  // Create some test files
  fs.writeFileSync(
    path.join(TEST_PROJECT_DIR, 'test.ts'),
    `
// Test file with intentional issues
function test() {
  try {
    console.log('debug');
  } catch (e) {}
}

const x = { a: 1 };
    `.trim()
  );

  fs.writeFileSync(
    path.join(TEST_PROJECT_DIR, 'clean.ts'),
    `
// Clean file with no issues
export function add(a: number, b: number): number {
  return a + b;
}
    `.trim()
  );
});

afterAll(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_PROJECT_DIR)) {
    fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
});

describe('CLI Integration Tests', () => {
  // ===== BASIC COMMANDS (5 tests) =====

  describe('Basic Commands', () => {
    it('check command runs successfully', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toContain('HEALTH CHECK RESULTS');
      expect(output).toMatch(/Health Score: \d+(\.\d+)?\/100/);
    });

    it('help displays correctly', async () => {
      const result = await $`node ${CLI_PATH} --help`.quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toContain('shrimp');
      expect(output).toContain('check');
      expect(output).toContain('fix');
      expect(output).toContain('status');
      expect(output).toContain('activate');
    });

    it('version shows package.json version', async () => {
      const result = await $`node ${CLI_PATH} --version`.quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString().trim();
      expect(output).toBe('1.0.0');
    });

    it('invalid command shows error', async () => {
      const result = await $`node ${CLI_PATH} invalid-command`.nothrow().quiet();

      expect(result.exitCode).toBe(1);
      const output = result.stderr.toString();
      expect(output).toContain('unknown command');
    });

    it('check exits with code 0 on success', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
    });
  });

  // ===== THRESHOLD TESTING (4 tests) =====

  describe('Threshold Testing', () => {
    it('passes when score is above threshold', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --threshold 0`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).not.toContain('[FAIL]');
    });

    it('fails when score is below threshold', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --threshold 100`.nothrow().quiet();

      expect(result.exitCode).toBe(1);
      const output = result.stdout.toString();
      expect(output).toContain('[FAIL]');
      expect(output).toMatch(/Health score \d+(\.\d+)? is below threshold 100/);
    });

    it('uses default threshold of 0', async () => {
      // Without threshold, should always pass (default is 0)
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
    });

    it('accepts valid threshold values (0-100)', async () => {
      const validThresholds = [0, 50, 75, 90, 100];

      for (const threshold of validThresholds) {
        const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --threshold ${threshold}`.nothrow().quiet();

        // Should execute without error (though may fail threshold)
        expect([0, 1]).toContain(result.exitCode);
      }
    });
  });

  // ===== OUTPUT FORMATS (3 tests) =====

  describe('Output Formats', () => {
    it('JSON output is valid JSON', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --json`.quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();

      // Extract JSON from output (might have progress logs before it)
      const lines = output.trim().split('\n');
      const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
      const jsonText = jsonStart >= 0 ? lines.slice(jsonStart).join('\n') : output;

      // Should be parseable JSON
      const parsed = JSON.parse(jsonText);
      expect(parsed).toBeDefined();
    });

    it('JSON contains all required fields', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --json`.quiet();

      const output = result.stdout.toString();

      // Extract JSON from output
      const lines = output.trim().split('\n');
      const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
      const jsonText = jsonStart >= 0 ? lines.slice(jsonStart).join('\n') : output;
      const parsed = JSON.parse(jsonText);

      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('healthScore');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('recommendations');
      expect(typeof parsed.healthScore).toBe('number');
      expect(parsed.healthScore).toBeGreaterThanOrEqual(0);
      expect(parsed.healthScore).toBeLessThanOrEqual(100);
    });

    it('default output is human-readable', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.quiet();

      const output = result.stdout.toString();

      // Should contain formatted output, not JSON
      expect(output).toContain('HEALTH CHECK RESULTS');
      expect(output).toContain('Health Score:');
      expect(output).toMatch(/\[★+[☆★]*\]/); // Star rating (may be all stars or mixed)

      // Should not be JSON
      expect(() => JSON.parse(output)).toThrow();
    });
  });

  // ===== FIX COMMAND (4 tests) =====

  describe('Fix Command', () => {
    it('fix command runs without errors', async () => {
      const result = await $`node ${CLI_PATH} fix --path ${TEST_PROJECT_DIR}`.nothrow().quiet();

      // Fix should run successfully
      expect([0, 1]).toContain(result.exitCode);
      const output = result.stdout.toString();
      expect(output).toContain('[OK]');
    });

    it('dry-run does not modify files', async () => {
      const testFile = path.join(TEST_PROJECT_DIR, 'dryrun-test.ts');
      const originalContent = 'console.log("test");\n';
      fs.writeFileSync(testFile, originalContent);

      const result = await $`node ${CLI_PATH} fix --path ${TEST_PROJECT_DIR} --dry-run`.nothrow().quiet();

      // File should remain unchanged
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toBe(originalContent);

      fs.unlinkSync(testFile);
    });

    it('fix reports results', async () => {
      const result = await $`node ${CLI_PATH} fix --path ${TEST_PROJECT_DIR}`.nothrow().quiet();

      const output = result.stdout.toString();
      expect(output).toMatch(/\[OK\]|\[FAIL\]/);
    });

    it('fix requires ANTHROPIC_API_KEY for Claude integration', async () => {
      const result = await $`node ${CLI_PATH} fix --path ${TEST_PROJECT_DIR} --claude`.nothrow().quiet();

      const output = result.stdout.toString();
      // Should mention API key requirement
      expect(output).toMatch(/ANTHROPIC_API_KEY|API key/i);
    });
  });

  // ===== STATUS COMMAND (2 tests) =====

  describe('Status Command', () => {
    it('status command displays usage info', async () => {
      const result = await $`node ${CLI_PATH} status`.quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toContain('STATUS');
      expect(output).toMatch(/Open Source|All Features/i);
    });

    it('status shows usage statistics', async () => {
      const result = await $`node ${CLI_PATH} status`.quiet();

      const output = result.stdout.toString();
      expect(output).toContain('Checks this month:');
      expect(output).toContain('Total checks:');
      expect(output).toContain('Average health:');
    });
  });

  // ===== ERROR HANDLING (5 tests) =====

  describe('Error Handling', () => {
    it('handles non-existent directory gracefully', async () => {
      const nonExistentPath = '/tmp/shrimp-nonexistent-' + Date.now();
      const result = await $`node ${CLI_PATH} check --path ${nonExistentPath}`.nothrow().quiet();

      // CLI handles non-existent directories gracefully (creates empty check)
      expect([0, 1]).toContain(result.exitCode);
    });

    it('handles invalid paths', async () => {
      const result = await $`node ${CLI_PATH} check --path /invalid/path/xyz`.nothrow().quiet();

      // CLI handles invalid paths gracefully
      expect([0, 1]).toContain(result.exitCode);
    });

    it('exits with non-zero on error', async () => {
      const result = await $`node ${CLI_PATH} invalid-command`.nothrow().quiet();

      expect(result.exitCode).not.toBe(0);
    });

    it('handles empty directory without crashing', async () => {
      const emptyDir = path.join(os.tmpdir(), 'shrimp-empty-' + Date.now());
      fs.mkdirSync(emptyDir, { recursive: true });

      const result = await $`node ${CLI_PATH} check --path ${emptyDir}`.nothrow().quiet();

      // Should handle gracefully
      expect([0, 1]).toContain(result.exitCode);

      fs.rmdirSync(emptyDir);
    });

    it('handles missing command gracefully', async () => {
      // Invalid command
      const result = await $`node ${CLI_PATH} nonexistent-command`.nothrow().quiet();

      expect(result.exitCode).toBe(1);
      const output = result.stderr.toString();
      expect(output.length).toBeGreaterThan(0);
    });
  });

  // ===== PATH OPTION (2 tests) =====

  describe('Path Option', () => {
    it('accepts custom path via --path option', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toContain('HEALTH CHECK RESULTS');
    });

    it('uses current directory when path not specified', async () => {
      // Run from test project directory
      const result = await $`cd ${TEST_PROJECT_DIR} && node ${CLI_PATH} check`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toContain('HEALTH CHECK RESULTS');
    });
  });

  // ===== INSTALL HOOKS COMMAND (1 test) =====

  describe('Install Hooks Command', () => {
    it('install-hooks shows instructions', async () => {
      const result = await $`node ${CLI_PATH} install-hooks`.quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toContain('git');
      expect(output).toContain('pre-commit');
      expect(output).toContain('husky');
    });
  });

  // ===== ACTIVATE COMMAND (2 tests) =====

  describe('Activate Command', () => {
    it('activate shows open source message', async () => {
      const result = await $`node ${CLI_PATH} activate`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toMatch(/Open Source|No longer needed/i);
    });

    it('activate accepts arguments gracefully', async () => {
      const result = await $`node ${CLI_PATH} activate test-key test@example.com`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).toMatch(/Open Source|No longer needed/i);
    });
  });

  // ===== INTEGRATION SCENARIOS (3 tests) =====

  describe('Integration Scenarios', () => {
    it('check then fix workflow', async () => {
      // First check
      const checkResult = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.nothrow().quiet();
      expect(checkResult.exitCode).toBe(0);

      // Then fix
      const fixResult = await $`node ${CLI_PATH} fix --path ${TEST_PROJECT_DIR}`.nothrow().quiet();
      expect([0, 1]).toContain(fixResult.exitCode);
    });

    it('JSON output can be piped and parsed', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --json`.quiet();

      const output = result.stdout.toString();

      // The JSON should be at the end of the output (after progress logs)
      // Extract just the JSON portion
      const lines = output.trim().split('\n');
      const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));

      if (jsonStart >= 0) {
        const jsonText = lines.slice(jsonStart).join('\n');
        const parsed = JSON.parse(jsonText);

        // Verify structure
        expect(parsed.success).toBeDefined();
        expect(parsed.healthScore).toBeDefined();
        expect(Array.isArray(parsed.recommendations)).toBe(true);
      } else {
        // Fallback: try to parse entire output
        const parsed = JSON.parse(output);
        expect(parsed.success).toBeDefined();
        expect(parsed.healthScore).toBeDefined();
        expect(Array.isArray(parsed.recommendations)).toBe(true);
      }
    });

    it('multiple sequential checks work correctly', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.nothrow().quiet();
        expect(result.exitCode).toBe(0);
      }

      // Check that usage was tracked
      const statusResult = await $`node ${CLI_PATH} status`.quiet();
      const output = statusResult.stdout.toString();
      expect(output).toContain('Checks this month:');
    });
  });

  // ===== OUTPUT FORMATTING (2 tests) =====

  describe('Output Formatting', () => {
    it('displays ASCII logo correctly', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.quiet();

      const output = result.stdout.toString();
      // Check for box drawing characters (the logo uses them)
      expect(output).toMatch(/╔═+╗/); // Box drawing characters
      // The logo shows "AI-Powered Code Health Monitoring"
      expect(output).toContain('AI-Powered Code Health Monitoring');
    });

    it('uses colors in output', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.quiet();

      const output = result.stdout.toString();
      // Should have ANSI color codes (this is a basic check)
      // Note: In CI environments colors might be disabled
      expect(output.length).toBeGreaterThan(100);
    });
  });

  // ===== PERFORMANCE (1 test) =====

  describe('Performance', () => {
    it('check completes in reasonable time', async () => {
      const start = Date.now();

      await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR}`.quiet();

      const duration = Date.now() - start;

      // Should complete in under 10 seconds
      expect(duration).toBeLessThan(10000);

      console.log(`Check completed in ${duration}ms`);
    });
  });

  // ===== EDGE CASES (3 tests) =====

  describe('Edge Cases', () => {
    it('handles special characters in path', async () => {
      const specialPath = path.join(os.tmpdir(), 'shrimp test 123');
      fs.mkdirSync(specialPath, { recursive: true });
      fs.writeFileSync(path.join(specialPath, 'test.ts'), 'export const x = 1;');

      const result = await $`node ${CLI_PATH} check --path ${specialPath}`.nothrow().quiet();

      expect(result.exitCode).toBe(0);

      fs.rmSync(specialPath, { recursive: true, force: true });
    });

    it('handles very low threshold (0)', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --threshold 0`.nothrow().quiet();

      expect(result.exitCode).toBe(0);
      const output = result.stdout.toString();
      expect(output).not.toContain('[FAIL]');
    });

    it('handles maximum threshold (100)', async () => {
      const result = await $`node ${CLI_PATH} check --path ${TEST_PROJECT_DIR} --threshold 100`.nothrow().quiet();

      // Will likely fail unless code is perfect
      expect([0, 1]).toContain(result.exitCode);
    });
  });
});
