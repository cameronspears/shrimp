#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { ShrimpHealth } from '../dist/index.js';

const SHRIMP_LOGO = `
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ███████╗██╗  ██╗██████╗ ██╗███╗   ███╗██████╗                      ║
║   ██╔════╝██║  ██║██╔══██╗██║████╗ ████║██╔══██╗                     ║
║   ███████╗███████║██████╔╝██║██╔████╔██║██████╔╝                     ║
║   ╚════██║██╔══██║██╔══██╗██║██║╚██╔╝██║██╔═══╝                      ║
║   ███████║██║  ██║██║  ██║██║██║ ╚═╝ ██║██║                          ║
║   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝                          ║
║                                                                       ║
║              AI-Powered Code Health Monitoring                        ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`;

const program = new Command();

program
  .name('shrimp')
  .description('AI-powered code health monitoring with automated fixes')
  .version('1.0.0');

// Check command
program
  .command('check')
  .description('Run a health check on your codebase')
  .option('-p, --path <path>', 'Path to source directory', '.')
  .option('-t, --threshold <score>', 'Minimum health score required', '0')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const isJsonMode = options.json;
    const spinner = !isJsonMode ? ora('Running health check...').start() : null;

    try {
      const shrimp = new ShrimpHealth();
      const result = await shrimp.check(options.path, false, isJsonMode);

      spinner?.stop();

      if (isJsonMode) {
        console.log(JSON.stringify(result, null, 2));
        // Check threshold in JSON mode
        const threshold = parseInt(options.threshold, 10);
        if (result.healthScore < threshold) {
          process.exit(1);
        }
        process.exit(0);
        return;
      }

      // Display results
      displayHealthResults(result);

      // Check threshold
      const threshold = parseInt(options.threshold, 10);
      if (result.healthScore < threshold) {
        console.log(
          chalk.red(`\n[FAIL] Health score ${result.healthScore} is below threshold ${threshold}`)
        );
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      spinner?.stop();
      if (isJsonMode) {
        console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Fix command
program
  .command('fix')
  .description('Auto-fix issues in your codebase')
  .option('-p, --path <path>', 'Path to source directory', '.')
  .option('--claude', 'Use Claude AI for complex fixes (requires ANTHROPIC_API_KEY)')
  .option('--dry-run', 'Show what would be fixed without making changes')
  .action(async (options) => {
    const spinner = ora('Analyzing and fixing issues...').start();

    try {
      const shrimp = new ShrimpHealth();

      if (options.claude && !process.env.ANTHROPIC_API_KEY) {
        spinner.stop();
        console.log(
          boxen(
            chalk.yellow(
              '[!] Claude AI integration requires ANTHROPIC_API_KEY\n\n' +
                'Set your API key:\n' +
                chalk.cyan('export ANTHROPIC_API_KEY=your_key_here')
            ),
            { padding: 1, margin: 1, borderColor: 'yellow' }
          )
        );
        process.exit(1);
      }

      const result = await shrimp.check(options.path, true);
      spinner.stop();

      if (result.success) {
        console.log(chalk.green(`\n[OK] ${result.summary}`));
        if (result.recommendations.length > 0) {
          console.log(chalk.yellow('\n[RECOMMENDATIONS]:'));
          result.recommendations.forEach((rec) => console.log(`  - ${rec}`));
        }
      } else {
        console.log(chalk.red(`\n[FAIL] ${result.summary}`));
      }

      process.exit(0);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Activate command (kept for backwards compatibility, but is a no-op)
program
  .command('activate')
  .description('No longer needed - Shrimp Health is fully open source!')
  .argument('[license-key]', 'No longer needed')
  .argument('[email]', 'No longer needed')
  .action(async (licenseKey, email) => {
    console.log(
      boxen(
        chalk.green('[INFO] Shrimp Health is fully open source!\n\n') +
          'All features are now free and unlimited.\n' +
          'No license activation needed.\n\n' +
          chalk.cyan('Just run: shrimp check'),
        { padding: 1, margin: 1, borderColor: 'green' }
      )
    );
  });

// Status command
program
  .command('status')
  .description('Show usage statistics')
  .action(async () => {
    try {
      const shrimp = new ShrimpHealth();
      const stats = shrimp.getStats();

      console.log(chalk.cyan(SHRIMP_LOGO));
      console.log(
        boxen(
          chalk.bold('STATUS\n\n') +
            chalk.green('Open Source - All Features Unlimited\n\n') +
            `Checks this month: ${stats.checksThisMonth}\n` +
            `Total checks: ${stats.totalChecks}\n` +
            `Average health: ${chalk.bold(stats.avgHealthScore.toFixed(1))}/100\n\n` +
            chalk.dim('Star us on GitHub: https://github.com/yourusername/shrimp-health'),
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
    console.log(chalk.yellow('\n[HOOKS] To install git hooks, add to your .husky/pre-commit:\n'));
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
          ? 'magenta'
          : 'red';

  const indicator =
    result.healthScore >= 90
      ? '[★★★★★]'
      : result.healthScore >= 70
        ? '[★★★★☆]'
        : result.healthScore >= 50
          ? '[★★★☆☆]'
          : '[★★☆☆☆]';

  console.log(chalk.cyan(SHRIMP_LOGO));
  console.log(
    boxen(
      chalk.bold('HEALTH CHECK RESULTS\n\n') +
        `${indicator} Health Score: ${chalk[scoreColor](result.healthScore + '/100')}\n` +
        chalk.dim(result.summary),
      { padding: 1, margin: 1, borderColor: scoreColor }
    )
  );

  if (result.recommendations && result.recommendations.length > 0) {
    console.log(chalk.yellow('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.yellow('║       RECOMMENDATIONS                 ║'));
    console.log(chalk.yellow('╚═══════════════════════════════════════╝\n'));
    result.recommendations.forEach((rec) => console.log(`  » ${rec}`));
  }

  // Show issue breakdown
  if (result.details) {
    console.log(chalk.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.cyan('║       ISSUE BREAKDOWN                 ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════╝\n'));

    const issues = [
      { name: 'Bugs', count: result.details.bugIssues?.length || 0, icon: '[BUG]' },
      {
        name: 'Performance',
        count: result.details.performanceIssues?.length || 0,
        icon: '[PERF]',
      },
      { name: 'Imports', count: result.details.importIssues?.length || 0, icon: '[IMPORT]' },
      {
        name: 'Consistency',
        count: result.details.consistencyIssues?.length || 0,
        icon: '[STYLE]',
      },
      { name: 'Debug statements', count: result.details.debugStatements?.length || 0, icon: '[DEBUG]' },
      { name: 'Large files', count: result.details.largeFiles?.length || 0, icon: '[SIZE]' },
    ];

    issues.forEach(({ name, count, icon }) => {
      if (count > 0) {
        console.log(`  ${icon} ${name}: ${chalk.yellow(count)}`);
      }
    });
  }

  console.log('');
}
