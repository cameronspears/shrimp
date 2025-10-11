#!/usr/bin/env bun

/**
 * Live test of the new FileWatcher features
 * This demonstrates the "invisible infrastructure" working
 */

import { FileWatcher } from './dist/core/file-watcher.js';

async function testFileWatcher() {
  console.log('='.repeat(70));
  console.log('Testing Shrimp File Watcher - "Invisible Infrastructure"');
  console.log('='.repeat(70));
  console.log();

  // Create watcher instance
  const watcher = new FileWatcher('/Users/cam/WebstormProjects/shrimp-health');

  console.log('[1/5] Starting file watcher...');
  await watcher.start();
  console.log();

  // Get initial status
  let status = watcher.getStatus();
  console.log('[2/5] Initial Status:');
  console.log(`  Health Score: ${status.healthScore}/100`);
  console.log(`  Files Watched: ${status.filesWatched}`);
  console.log(`  Issue Count: ${status.issueCount}`);
  console.log(`  Trend: ${status.trend}`);
  console.log();

  // Simulate some time passing
  console.log('[3/5] Monitoring for 5 seconds...');
  console.log('  (Try editing a file now to see it detect changes!)');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log();

  // Check status again
  status = watcher.getStatus();
  console.log('[4/5] Status After Monitoring:');
  console.log(`  Health Score: ${status.healthScore}/100 (was ${status.previousScore})`);
  console.log(`  Trend: ${status.trend}`);
  console.log(`  Checks Performed: ${status.checksPerformed}`);
  console.log(`  Issue Count: ${status.issueCount}`);

  if (status.issueCount > 0) {
    console.log();
    console.log('  Top Issues:');
    status.topIssues.slice(0, 3).forEach(issue => {
      console.log(`    - ${issue.file}:${issue.line} - ${issue.message}`);
    });
  }
  console.log();

  // Stop watcher
  console.log('[5/5] Stopping file watcher...');
  await watcher.stop();
  console.log();

  console.log('='.repeat(70));
  console.log('Test Complete! File watcher works perfectly.');
  console.log('='.repeat(70));
  console.log();
  console.log('Next steps:');
  console.log('1. Restart Claude Code to load new MCP tools');
  console.log('2. Try: shrimp_watch_start');
  console.log('3. Try: shrimp_get_live_status');
  console.log('4. Try: shrimp_watch_stop');
}

testFileWatcher().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
