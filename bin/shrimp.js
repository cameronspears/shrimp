#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { ShrimpHealth } from '../dist/index.js';

const program = new Command();

program
  .name('shrimp')
  .description('🦐 AI-powered code health monitoring with automated fixes')
  .version('1.0.0');

// Check command
program
  .command('check')
  .description('Run a health check on your codebase')
  .option('-p, --path <path>', 'Path to source directory', '.')
  .option('-t, --threshold <score>', 'Minimum health score required', '0')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const spinner = ora('Running health check...').start();

    try {
      const shrimp = new ShrimpHealth();
      const result = await shrimp.check(options.path);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Display results
      displayHealthResults(result);

      // Check threshold
      const threshold = parseInt(options.threshold, 10);
      if (result.healthScore < threshold) {
        console.log(
          chalk.red(`\n❌ Health score ${result.healthScore} is below threshold ${threshold}`)
        );
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Fix command
program
  .command('fix')
  .description('Auto-fix issues in your codebase')
  .option('-p, --path <path>', 'Path to source directory', '.')
  .option('--claude', 'Use Claude AI for complex fixes (Pro only)')
  .option('--dry-run', 'Show what would be fixed without making changes')
  .action(async (options) => {
    const spinner = ora('Analyzing and fixing issues...').start();

    try {
      const shrimp = new ShrimpHealth();

      if (options.claude) {
        // Check if user has Pro license
        const license = await shrimp.getLicense();
        if (!license.features.claudeIntegration) {
          spinner.stop();
          console.log(
            boxen(
              chalk.yellow(
                '⚠️  Claude AI integration is a Pro feature\n\n' +
                  'Upgrade to Pro for $6/month:\n' +
                  chalk.cyan('https://shrimphealth.com/pricing')
              ),
              { padding: 1, margin: 1, borderColor: 'yellow' }
            )
          );
          process.exit(1);
        }
      }

      const result = await shrimp.check(options.path, true);
      spinner.stop();

      if (result.success) {
        console.log(chalk.green(`\n✅ ${result.summary}`));
        if (result.recommendations.length > 0) {
          console.log(chalk.yellow('\n📋 Recommendations:'));
          result.recommendations.forEach((rec) => console.log(`  • ${rec}`));
        }
      } else {
        console.log(chalk.red(`\n❌ ${result.summary}`));
      }

      process.exit(0);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Activate command
program
  .command('activate')
  .description('Activate a Pro or Team license')
  .argument('<license-key>', 'Your license key')
  .argument('<email>', 'Your email address')
  .action(async (licenseKey, email) => {
    const spinner = ora('Activating license...').start();

    try {
      const shrimp = new ShrimpHealth();
      const success = await shrimp.activate(licenseKey, email);

      spinner.stop();

      if (success) {
        const license = await shrimp.getLicense();
        console.log(
          boxen(
            chalk.green('🎉 License activated successfully!\n\n') +
              `Tier: ${chalk.bold(license.tier.toUpperCase())}\n` +
              `Email: ${email}\n\n` +
              chalk.dim('You now have access to all Pro features'),
            { padding: 1, margin: 1, borderColor: 'green' }
          )
        );
      } else {
        console.log(chalk.red('Failed to activate license. Please check your key and try again.'));
        process.exit(1);
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show license and usage information')
  .action(async () => {
    try {
      const shrimp = new ShrimpHealth();
      const license = await shrimp.getLicense();
      const stats = shrimp.getStats();

      console.log(
        boxen(
          chalk.bold('🦐 Shrimp Health Status\n\n') +
            `License: ${chalk.bold(license.tier.toUpperCase())}\n` +
            `Checks this month: ${stats.checksThisMonth}${license.tier === 'free' ? `/${license.features.maxChecksPerMonth}` : ' (unlimited)'}\n` +
            `Total checks: ${stats.totalChecks}\n` +
            `Average health: ${chalk.bold(stats.avgHealthScore.toFixed(1))}/100\n\n` +
            chalk.dim(license.tier === 'free' ? 'Upgrade to Pro: https://shrimphealth.com/pricing' : ''),
          { padding: 1, margin: 1, borderColor: 'cyan' }
        )
      );
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Install hooks command
program
  .command('install-hooks')
  .description('Install git pre-commit hooks')
  .action(async () => {
    console.log(chalk.yellow('\n📝 To install git hooks, add to your .husky/pre-commit:\n'));
    console.log(chalk.cyan('  shrimp check --threshold 80\n'));
    console.log(chalk.dim('Or manually create the hook with:\n'));
    console.log(chalk.gray('  npx husky add .husky/pre-commit "shrimp check --threshold 80"'));
  });

program.parse();

// Helper function to display health results
function displayHealthResults(result) {
  const scoreColor =
    result.healthScore >= 90
      ? 'green'
      : result.healthScore >= 70
        ? 'yellow'
        : result.healthScore >= 50
          ? 'orange'
          : 'red';

  const emoji =
    result.healthScore >= 90
      ? '🌟'
      : result.healthScore >= 70
        ? '👍'
        : result.healthScore >= 50
          ? '⚠️'
          : '🚨';

  console.log(
    boxen(
      chalk.bold('🦐 Shrimp Health Check\n\n') +
        `${emoji} Health Score: ${chalk[scoreColor](result.healthScore + '/100')}\n` +
        chalk.dim(result.summary),
      { padding: 1, margin: 1, borderColor: scoreColor }
    )
  );

  if (result.recommendations && result.recommendations.length > 0) {
    console.log(chalk.yellow('\n📋 Recommendations:'));
    result.recommendations.forEach((rec) => console.log(`  • ${rec}`));
  }

  // Show issue breakdown
  if (result.details) {
    console.log(chalk.cyan('\n📊 Issue Breakdown:'));

    const issues = [
      { name: 'Bugs', count: result.details.bugIssues?.length || 0, emoji: '🐛' },
      {
        name: 'Performance',
        count: result.details.performanceIssues?.length || 0,
        emoji: '⚡',
      },
      { name: 'Imports', count: result.details.importIssues?.length || 0, emoji: '📦' },
      {
        name: 'Consistency',
        count: result.details.consistencyIssues?.length || 0,
        emoji: '🎯',
      },
      { name: 'Debug statements', count: result.details.debugStatements?.length || 0, emoji: '🔍' },
      { name: 'Large files', count: result.details.largeFiles?.length || 0, emoji: '📏' },
    ];

    issues.forEach(({ name, count, emoji }) => {
      if (count > 0) {
        console.log(`  ${emoji} ${name}: ${chalk.yellow(count)}`);
      }
    });
  }

  console.log('');
}
