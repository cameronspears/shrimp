import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

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
  };
}

interface CodebaseContext {
  techStack: string;
  conventions: string[];
  fileContexts: Array<{ file: string; purpose: string; keyPatterns: string[] }>;
  verificationSteps: string[];
}

export async function invokeClaude(result: MaintenanceResult): Promise<void> {
  console.log('\n🤖 Invoking Claude for automated cleanup...');

  // Only skip if score is excellent (>95) AND there are no recommendations
  if (!result.details || (result.healthScore > 95 && result.recommendations.length === 0)) {
    console.log('[OK] Health score is excellent, no Claude intervention needed');
    return;
  }

  console.log('🔍 Gathering codebase context for Claude...');
  const codebaseContext = await gatherCodebaseContext(result);
  const prompt = generateClaudePrompt(result, codebaseContext);

  try {
    const promptFile = path.join(process.cwd(), '.shrimp-prompt.md');
    await fs.writeFile(promptFile, prompt);

    console.log(`💡 Created cleanup prompt at: ${promptFile}`);
    console.log('🤖 Starting Claude session with the prompt...');
    console.log('');

    const claudeProcess = spawn('claude', [promptFile], {
      stdio: 'inherit',
      shell: true,
      detached: false,
    });

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⚠️ Claude CLI not available or taking too long');
        console.log('💡 You can manually run: claude < ' + promptFile);
        claudeProcess.kill('SIGTERM');
        resolve();
      }, 5000);

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          console.log('\n[OK] Claude cleanup session completed');
        } else if (code !== null) {
          console.log(`\n⚠️ Claude exited with code ${code}`);
        }
        resolve();
      });

      claudeProcess.on('error', () => {
        clearTimeout(timeout);
        console.log(
          '\n💡 Claude CLI not available - install with: npm install -g @anthropic-ai/claude-cli'
        );
        console.log(`💡 Or run manually: claude < ${promptFile}`);
        resolve();
      });

      claudeProcess.on('spawn', () => {
        clearTimeout(timeout);
      });
    });
  } catch (error) {
    console.log('\n⚠️ Claude automation failed:', error);
    console.log('💡 You can still use the recommendations above manually');
  }
}

function generateClaudePrompt(result: MaintenanceResult, context: CodebaseContext): string {
  const parts = [
    '🦐 Shrimp Codebase Cleanup - Smart Context-Aware Maintenance',
    '',
    '🎯 MISSION: Improve code maintainability without breaking functionality or UIs',
    '',
    `📊 Health Score: ${result.healthScore}/100`,
    '',
    '⚡ TECH STACK: ' + context.techStack,
    '',
    '📖 PROJECT CONVENTIONS:',
    ...context.conventions.map((c) => `  • ${c}`),
    '',
  ];

  if (context.fileContexts.length > 0) {
    parts.push('🔍 FILE CONTEXTS:');
    context.fileContexts.forEach(({ file, purpose, keyPatterns }) => {
      parts.push(`  📄 ${file}`);
      parts.push(`     Purpose: ${purpose}`);
      if (keyPatterns.length > 0) {
        parts.push(`     Patterns: ${keyPatterns.join(', ')}`);
      }
    });
    parts.push('');
  }

  if (result.details?.debugStatements.length) {
    parts.push('🐛 Debug statements to remove:');
    result.details.debugStatements.forEach(({ file, line, content }) => {
      parts.push(`  • ${file}:${line} - ${content}`);
    });
    parts.push('');
  }

  if (result.details?.emptyDirectories.length) {
    parts.push('📁 Empty directories to remove:');
    result.details.emptyDirectories.forEach((dir) => {
      parts.push(`  • ${dir}`);
    });
    parts.push('');
  }

  if (result.details?.largeFiles.length) {
    parts.push('📏 Large files that might benefit from refactoring:');
    result.details.largeFiles.forEach(({ file, lines }) => {
      parts.push(`  • ${file} (${lines} lines)`);
    });
    parts.push('');
  }

  if (result.details?.complexFunctions.length) {
    parts.push('🧠 Complex functions to consider simplifying:');
    result.details.complexFunctions.forEach(({ file, function: func, complexity }) => {
      parts.push(`  • ${file} - ${func}() (complexity: ${complexity})`);
    });
    parts.push('');
  }

  // NEW: Bug issues
  if (result.details?.bugIssues?.length) {
    const critical = result.details.bugIssues.filter((i: any) => i.severity === 'error');
    const warnings = result.details.bugIssues.filter((i: any) => i.severity === 'warning');

    if (critical.length > 0) {
      parts.push('🚨 CRITICAL BUGS TO FIX:');
      critical.slice(0, 10).forEach((issue: any) => {
        parts.push(`  • ${issue.file}:${issue.line} - ${issue.message}`);
        parts.push(`    💡 ${issue.suggestion}`);
      });
      parts.push('');
    }

    if (warnings.length > 0) {
      parts.push('⚠️  Potential Bugs:');
      warnings.slice(0, 10).forEach((issue: any) => {
        parts.push(`  • ${issue.file}:${issue.line} - ${issue.message}`);
      });
      parts.push('');
    }
  }

  // NEW: Performance issues
  if (result.details?.performanceIssues?.length) {
    const critical = result.details.performanceIssues.filter((i: any) => i.severity === 'critical');
    const moderate = result.details.performanceIssues.filter((i: any) => i.severity === 'moderate');

    if (critical.length > 0) {
      parts.push('⚡ CRITICAL PERFORMANCE ISSUES:');
      critical.slice(0, 8).forEach((issue: any) => {
        parts.push(`  • ${issue.file}:${issue.line} - ${issue.message}`);
        parts.push(`    💡 ${issue.suggestion}`);
        if (issue.impact) parts.push(`    📊 Impact: ${issue.impact}`);
      });
      parts.push('');
    }

    if (moderate.length > 0) {
      parts.push('📊 Performance Optimizations:');
      moderate.slice(0, 8).forEach((issue: any) => {
        parts.push(`  • ${issue.file}:${issue.line} - ${issue.message}`);
      });
      parts.push('');
    }
  }

  // NEW: Import issues
  if (result.details?.importIssues?.length) {
    parts.push('📦 Import Issues:');
    result.details.importIssues.slice(0, 15).forEach((issue: any) => {
      parts.push(`  • ${issue.file}:${issue.line} - ${issue.message}`);
      parts.push(`    💡 ${issue.suggestion}`);
    });
    parts.push('');
  }

  // NEW: Consistency issues
  if (result.details?.consistencyIssues?.length) {
    parts.push('🎯 Code Consistency Issues:');
    result.details.consistencyIssues.slice(0, 12).forEach((issue: any) => {
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      parts.push(`  • ${location} - ${issue.message}`);
      parts.push(`    💡 ${issue.suggestion}`);
    });
    parts.push('');
  }

  parts.push(
    '🛠️ CLEANUP ACTIONS:',
    '• Remove debug statements (console.log, debugger)',
    '• Fix naming inconsistencies (maintain existing patterns)',
    '• Clean up unused imports and dead code',
    '• Simplify overly complex functions (without changing behavior)',
    '• Remove empty directories',
    '',
    '🚫 CONSTRAINTS:',
    "• Don't break existing functionality",
    "• Don't change UI appearance or behavior",
    '• Maintain existing interfaces and exports',
    '• Keep the same code structure and architecture',
    '',
    '[OK] VERIFICATION REQUIRED:',
    ...context.verificationSteps.map((step) => `  • ${step}`),
    '',
    '🧠 SMART APPROACH:',
    '• Read the full context of each file before making changes',
    '• Understand the purpose and dependencies',
    '• Make conservative changes that clearly improve maintainability',
    '• Test changes immediately and revert if anything breaks',
    '',
    '📝 ISSUES TO ADDRESS:'
  );

  return parts.join('\n');
}

async function gatherCodebaseContext(result: MaintenanceResult): Promise<CodebaseContext> {
  const context: CodebaseContext = {
    techStack: 'Next.js 15 + TypeScript + Tailwind CSS + Shrimp 🦐',
    conventions: [],
    fileContexts: [],
    verificationSteps: ['pnpm type-check', 'pnpm lint', 'pnpm shrimp'],
  };

  try {
    const claudeContent = await fs.readFile(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    const lines = claudeContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && trimmed.length < 120) {
        const convention = trimmed.replace(/^[-*]\s*/, '');
        if (
          convention.includes('component') ||
          convention.includes('function') ||
          convention.includes('naming') ||
          convention.includes('import') ||
          convention.includes('style') ||
          convention.includes('format')
        ) {
          context.conventions.push(convention);
        }
      }
    }
  } catch (error) {
    context.conventions.push('Follow Next.js and TypeScript best practices');
  }

  if (result.details) {
    const allFiles = new Set<string>();
    result.details.debugStatements?.forEach((d) => allFiles.add(d.file));
    result.details.largeFiles?.forEach((f) => allFiles.add(f.file));
    result.details.complexFunctions?.forEach((f) => allFiles.add(f.file));

    const filesToAnalyze = Array.from(allFiles).slice(0, 8);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const purpose = inferFilePurpose(file, content);
        const patterns = extractKeyPatterns(content);
        const safetyWarnings = generateSafetyWarnings(file, content, purpose);

        context.fileContexts.push({
          file: file.replace(process.cwd(), ''),
          purpose,
          keyPatterns: [...patterns.slice(0, 3), ...safetyWarnings],
        });
      } catch (error) {
        // Skip files we can't read
      }
    }
  }

  return context;
}

function inferFilePurpose(file: string, content: string): string {
  const filename = path.basename(file);

  if (file.includes('/api/')) return 'API endpoint';
  if (file.includes('/components/')) return 'React component';
  if (file.includes('/app/') && filename === 'page.tsx') return 'Next.js page';
  if (file.includes('/lib/')) return 'Utility library';
  if (filename.includes('.test.') || filename.includes('.spec.')) return 'Test file';
  if (filename === 'layout.tsx') return 'Layout component';
  if (content.includes('export default function')) return 'React component/function';
  if (content.includes('export const') && content.includes('router')) return 'Router';
  if (content.includes('interface') || content.includes('type ')) return 'Type definitions';

  return 'Source file';
}

function extractKeyPatterns(content: string): string[] {
  const patterns: string[] = [];

  if (content.includes('className=')) patterns.push('Uses Tailwind classes');
  if (content.includes('export default function')) patterns.push('Default function export');
  if (content.includes('useState') || content.includes('useEffect')) patterns.push('React hooks');
  if (content.includes('async/await')) patterns.push('Async operations');
  if (content.includes('interface ') || content.includes('type '))
    patterns.push('TypeScript types');

  return patterns;
}

function generateSafetyWarnings(file: string, content: string, purpose: string): string[] {
  const warnings: string[] = [];

  if (content.includes('className=') || content.includes('style=')) {
    warnings.push('⚠️ Contains styling - preserve UI appearance');
  }

  if (content.includes('jsx') || content.includes('tsx') || content.includes('return (')) {
    if (purpose.includes('component') || purpose.includes('page')) {
      warnings.push('⚠️ UI component - maintain visual behavior');
    }
  }

  if (file.includes('/api/') || content.includes('export async function')) {
    warnings.push('⚠️ API endpoint - preserve functionality');
  }

  if (content.includes('algorithm') || content.includes('calculate') || content.includes('score')) {
    warnings.push('⚠️ Contains business logic - be very careful');
  }

  if (file.includes('config') || file.includes('.env') || content.includes('process.env')) {
    warnings.push('⚠️ Configuration file - minimal changes only');
  }

  return warnings;
}
