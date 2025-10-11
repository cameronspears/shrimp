#!/usr/bin/env bun
/**
 * Track detection quality trends over time
 * Appends current metrics to a historical log
 */

import fs from 'fs';
import path from 'path';

const BASELINE_PATH = path.join(__dirname, '../tests/baselines/gielinor-gains-baseline.json');
const TRENDS_PATH = path.join(__dirname, '../tests/baselines/quality-trends.json');

interface BaselineData {
  timestamp: string;
  totalFiles: number;
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: { error: number; warning: number; info: number };
  filesAnalyzed: number;
  version: string;
}

interface TrendEntry {
  timestamp: string;
  totalIssues: number;
  avgPerFile: number;
  errorRate: number;
  qualityScore: number;
  version: string;
}

function trackTrend() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('No baseline found. Run tests first: bun test:integration');
    process.exit(1);
  }

  const baseline: BaselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));

  // Load existing trends
  let trends: TrendEntry[] = [];
  if (fs.existsSync(TRENDS_PATH)) {
    trends = JSON.parse(fs.readFileSync(TRENDS_PATH, 'utf-8'));
  }

  // Calculate metrics
  const avgPerFile = baseline.totalIssues / baseline.filesAnalyzed;
  const errorRate = (baseline.issuesBySeverity.error / baseline.totalIssues) * 100;
  const qualityScore = calculateQualityScore(errorRate, avgPerFile);

  // Add new entry
  const entry: TrendEntry = {
    timestamp: new Date().toISOString(),
    totalIssues: baseline.totalIssues,
    avgPerFile: parseFloat(avgPerFile.toFixed(2)),
    errorRate: parseFloat(errorRate.toFixed(1)),
    qualityScore,
    version: baseline.version,
  };

  trends.push(entry);

  // Keep only last 100 entries
  if (trends.length > 100) {
    trends = trends.slice(-100);
  }

  // Save trends
  fs.writeFileSync(TRENDS_PATH, JSON.stringify(trends, null, 2));

  // Display trend analysis
  displayTrends(trends);
}

function displayTrends(trends: TrendEntry[]) {
  console.log('');
  console.log('========================================');
  console.log('   DETECTION QUALITY TRENDS');
  console.log('========================================');
  console.log('');

  if (trends.length < 2) {
    console.log('Not enough data for trend analysis. Run this again after making changes.');
    console.log('');
    return;
  }

  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];
  const oldest = trends[0];

  // Recent change
  console.log('--- LATEST CHANGE ---');
  console.log(`Current:  ${new Date(latest.timestamp).toLocaleString()}`);
  console.log(`Previous: ${new Date(previous.timestamp).toLocaleString()}`);
  console.log('');

  const issueChange = latest.totalIssues - previous.totalIssues;
  const avgChange = latest.avgPerFile - previous.avgPerFile;
  const errorChange = latest.errorRate - previous.errorRate;
  const qualityChange = latest.qualityScore - previous.qualityScore;

  printChange('Total Issues', previous.totalIssues, latest.totalIssues, issueChange);
  printChange('Avg per File', previous.avgPerFile, latest.avgPerFile, avgChange);
  printChange('Error Rate %', previous.errorRate, latest.errorRate, errorChange);
  printChange('Quality Score', previous.qualityScore, latest.qualityScore, qualityChange);
  console.log('');

  // Overall trend
  if (trends.length >= 3) {
    console.log('--- OVERALL TREND ---');
    console.log(`First Recorded: ${new Date(oldest.timestamp).toLocaleString()}`);
    console.log(`Latest:         ${new Date(latest.timestamp).toLocaleString()}`);
    console.log(`Data Points:    ${trends.length}`);
    console.log('');

    const overallIssueChange = latest.totalIssues - oldest.totalIssues;
    const overallAvgChange = latest.avgPerFile - oldest.avgPerFile;
    const overallQualityChange = latest.qualityScore - oldest.qualityScore;

    printChange('Total Issues', oldest.totalIssues, latest.totalIssues, overallIssueChange);
    printChange('Avg per File', oldest.avgPerFile, latest.avgPerFile, overallAvgChange);
    printChange('Quality Score', oldest.qualityScore, latest.qualityScore, overallQualityChange);
    console.log('');

    // Trend summary
    console.log('--- INTERPRETATION ---');
    if (overallQualityChange > 5) {
      console.log('[+] Detection quality is improving over time.');
    } else if (overallQualityChange < -5) {
      console.log('[!] Detection quality is declining. Review recent changes.');
    } else {
      console.log('[=] Detection quality is stable.');
    }

    if (overallIssueChange > 50) {
      console.log('[!] Issue count increased significantly. Check for false positives.');
    } else if (overallIssueChange < -50) {
      console.log('[+] Issue count decreased. Good progress on fixing issues or reducing false positives.');
    }
  }

  console.log('');
  console.log('========================================');
  console.log('');
}

function printChange(metric: string, prev: number, current: number, change: number) {
  const indicator = change > 0 ? '↑' : change < 0 ? '↓' : '=';
  const color = change > 0 ? (metric === 'Quality Score' ? '+' : '-') :
                 change < 0 ? (metric === 'Quality Score' ? '-' : '+') : '=';

  console.log(`${metric.padEnd(15)} ${prev.toString().padStart(6)} → ${current.toString().padStart(6)} (${indicator} ${Math.abs(change).toFixed(2)})`);
}

function calculateQualityScore(errorRate: number, avgPerFile: number): number {
  let score = 100;

  if (errorRate > 25) score -= 20;
  else if (errorRate < 8) score -= 10;

  if (avgPerFile > 6) score -= 20;
  else if (avgPerFile < 1.5) score -= 15;

  return Math.max(0, score);
}

trackTrend();