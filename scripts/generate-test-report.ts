#!/usr/bin/env bun
/**
 * Generate a detailed report from the baseline data
 * Shows detection quality trends over time
 */

import fs from 'fs';
import path from 'path';

const BASELINE_PATH = path.join(__dirname, '../tests/baselines/gielinor-gains-baseline.json');

interface BaselineData {
  timestamp: string;
  totalFiles: number;
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: { error: number; warning: number; info: number };
  filesAnalyzed: number;
  version: string;
}

function generateReport() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('No baseline found. Run tests first: bun test tests/integration');
    process.exit(1);
  }

  const baseline: BaselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));

  console.log('');
  console.log('========================================');
  console.log('   SHRIMP HEALTH - DETECTION REPORT');
  console.log('========================================');
  console.log('');
  console.log(`Generated: ${new Date().toLocaleString()}`);
  console.log(`Baseline: ${new Date(baseline.timestamp).toLocaleString()}`);
  console.log('');

  // Overview
  console.log('--- OVERVIEW ---');
  console.log(`Files Analyzed:    ${baseline.filesAnalyzed}`);
  console.log(`Total Issues:      ${baseline.totalIssues}`);
  console.log(`Average per File:  ${(baseline.totalIssues / baseline.filesAnalyzed).toFixed(2)}`);
  console.log('');

  // Severity Distribution
  console.log('--- SEVERITY DISTRIBUTION ---');
  const total = baseline.issuesBySeverity.error + baseline.issuesBySeverity.warning + baseline.issuesBySeverity.info;
  console.log(`Errors:   ${baseline.issuesBySeverity.error.toString().padStart(4)} (${((baseline.issuesBySeverity.error / total) * 100).toFixed(1)}%)`);
  console.log(`Warnings: ${baseline.issuesBySeverity.warning.toString().padStart(4)} (${((baseline.issuesBySeverity.warning / total) * 100).toFixed(1)}%)`);
  console.log(`Info:     ${baseline.issuesBySeverity.info.toString().padStart(4)} (${((baseline.issuesBySeverity.info / total) * 100).toFixed(1)}%)`);
  console.log('');

  // Category Breakdown
  console.log('--- ISSUES BY CATEGORY ---');
  const categories = Object.entries(baseline.issuesByCategory)
    .sort(([, a], [, b]) => b - a);

  for (const [category, count] of categories) {
    const percent = ((count / baseline.totalIssues) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor((count / categories[0][1]) * 30));
    console.log(`${category.padEnd(20)} ${count.toString().padStart(4)} (${percent.padStart(5)}%) ${bar}`);
  }
  console.log('');

  // Quality Metrics
  console.log('--- QUALITY METRICS ---');
  const errorRate = (baseline.issuesBySeverity.error / total) * 100;
  const avgPerFile = baseline.totalIssues / baseline.filesAnalyzed;

  const qualityScore = calculateQualityScore(errorRate, avgPerFile);
  console.log(`Detection Quality Score: ${qualityScore}/100`);
  console.log('');

  // Recommendations
  console.log('--- RECOMMENDATIONS ---');
  if (errorRate > 20) {
    console.log('[!] Error rate is high. Consider tuning detection to reduce false positives.');
  } else if (errorRate < 10) {
    console.log('[+] Error rate is healthy. Good severity distribution.');
  }

  if (avgPerFile > 5) {
    console.log('[!] Average issues per file is high. May need to relax some rules.');
  } else if (avgPerFile < 2) {
    console.log('[!] Average issues per file is low. Detection might be too lenient.');
  } else {
    console.log('[+] Average issues per file is in a healthy range.');
  }

  console.log('');
  console.log('========================================');
  console.log('');
}

function calculateQualityScore(errorRate: number, avgPerFile: number): number {
  let score = 100;

  // Penalize if error rate is too high or too low
  if (errorRate > 25) score -= 20;
  else if (errorRate < 8) score -= 10;

  // Penalize if average per file is too high or too low
  if (avgPerFile > 6) score -= 20;
  else if (avgPerFile < 1.5) score -= 15;

  return Math.max(0, score);
}

generateReport();