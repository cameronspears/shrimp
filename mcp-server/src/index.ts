#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { execSync } from 'child_process';
import { access, stat } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import FileWatcher for real-time monitoring
// Note: We'll import from the built dist instead of src
type FileWatcherClass = {
  new (rootPath?: string): FileWatcherInstance;
};

type FileWatcherInstance = {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): WatcherStatus;
};

type WatcherStatus = {
  isRunning: boolean;
  healthScore: number;
  previousScore: number;
  trend: 'improving' | 'declining' | 'stable';
  issueCount: number;
  topIssues: Array<{
    file: string;
    line: number;
    category: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  lastCheckTime: number;
  filesWatched: number;
  checksPerformed: number;
};

let FileWatcher: FileWatcherClass | null = null;
let getWatcherInstance: (() => FileWatcherInstance | null) | null = null;
let setWatcherInstance: ((watcher: FileWatcherInstance | null) => void) | null = null;

try {
  const watcherModule = await import('../../dist/core/file-watcher.js');
  FileWatcher = watcherModule.FileWatcher;
  getWatcherInstance = watcherModule.getWatcherInstance;
  setWatcherInstance = watcherModule.setWatcherInstance as ((watcher: FileWatcherInstance | null) => void);
} catch (error) {
  console.error('[MCP] Warning: Could not load FileWatcher. Watch features disabled.');
}

// Tool schemas
const CheckHealthSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Path to check (defaults to current directory)'),
  threshold: z
    .number()
    .optional()
    .describe('Minimum health score threshold (0-100)'),
});

const FixIssuesSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Path to fix (defaults to current directory)'),
  dryRun: z
    .boolean()
    .optional()
    .describe('Preview fixes without applying them'),
});

const ExplainIssueSchema = z.object({
  issueType: z
    .string()
    .describe('Type of issue to explain (e.g., "unused-import", "empty-catch")'),
  context: z
    .string()
    .optional()
    .describe('Additional context about the issue'),
});

const GetStatusSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Path to check status (defaults to current directory)'),
  detailed: z
    .boolean()
    .optional()
    .describe('Include detailed breakdown of issues'),
});

const WatchStartSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Path to watch (defaults to current directory)'),
});

const WatchStopSchema = z.object({});

const GetLiveStatusSchema = z.object({
  includeIssues: z
    .boolean()
    .optional()
    .describe('Include top 10 issues in response'),
});

// Initialize MCP server
const server = new Server(
  {
    name: 'shrimp-health',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to run shrimp commands
async function runShrimpCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
  const shrimpPath = resolve(__dirname, '../../bin/shrimp.js');

  try {
    await access(shrimpPath);
  } catch {
    throw new Error('Shrimp CLI not found. Please install @shrimphealth/cli');
  }

  // Validate cwd if provided
  if (cwd) {
    try {
      await access(cwd);
    } catch {
      throw new Error(`Path does not exist: ${cwd}`);
    }

    const stats = await stat(cwd);
    if (!stats.isDirectory()) {
      throw new Error(`Path must be a directory, not a file: ${cwd}`);
    }
  }

  try {
    const output = execSync(`node ${shrimpPath} ${command}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return { output, exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string; status?: number };
    return {
      output: err.stdout || err.stderr || err.message || 'Unknown error',
      exitCode: err.status || 1,
    };
  }
}

// Helper to parse health check output
function parseHealthOutput(output: string): {
  score: number;
  recommendations: string[];
  summary: string;
  details: string;
} {
  // Parse the output to extract structured data
  const scoreMatch = output.match(/Score:\s*(\d+)\/100/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  const recommendations: string[] = [];
  const recSection = output.match(/\[RECOMMENDATIONS\]:([\s\S]*?)(?:\n\n|$)/);
  if (recSection) {
    const lines = recSection[1].split('\n').filter((l) => l.trim().startsWith('-'));
    recommendations.push(...lines.map((l) => l.trim().substring(1).trim()));
  }

  const summaryMatch = output.match(/\[OK\]\s*(.+)/);
  const summary = summaryMatch ? summaryMatch[1] : 'Health check completed';

  return {
    score,
    recommendations,
    summary,
    details: output,
  };
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'shrimp_check',
      description:
        'Run a comprehensive health check on a codebase. Analyzes bugs, performance issues, code consistency, imports, accessibility, and more. Returns a health score (0-100) and actionable recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to check (defaults to current directory)',
          },
          threshold: {
            type: 'number',
            description: 'Minimum health score threshold (0-100)',
          },
        },
      },
    },
    {
      name: 'shrimp_fix',
      description:
        'Automatically fix safe code health issues. Can fix unused imports, accessibility issues, performance problems, and common bugs. Supports dry-run mode to preview changes before applying.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to fix (defaults to current directory)',
          },
          dryRun: {
            type: 'boolean',
            description: 'Preview fixes without applying them',
          },
        },
      },
    },
    {
      name: 'shrimp_status',
      description:
        'Get quick status of codebase health including current score, recent trends, and top issues. Useful for monitoring health over time.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to check status (defaults to current directory)',
          },
          detailed: {
            type: 'boolean',
            description: 'Include detailed breakdown of issues',
          },
        },
      },
    },
    {
      name: 'shrimp_explain',
      description:
        'Get detailed explanation of a specific code health issue type, including why it matters, how to fix it, and examples.',
      inputSchema: {
        type: 'object',
        properties: {
          issueType: {
            type: 'string',
            description: 'Type of issue to explain (e.g., "unused-import", "empty-catch")',
          },
          context: {
            type: 'string',
            description: 'Additional context about the issue',
          },
        },
        required: ['issueType'],
      },
    },
    {
      name: 'shrimp_watch_start',
      description:
        'Start background file watching for real-time health monitoring. The watcher runs in the background and tracks health score changes as files are modified. This enables proactive health monitoring without explicit checks.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to watch (defaults to current directory)',
          },
        },
      },
    },
    {
      name: 'shrimp_watch_stop',
      description:
        'Stop background file watching. Returns final statistics including total checks performed and final health score.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'shrimp_get_live_status',
      description:
        'Get real-time health status from the file watcher WITHOUT running a new check. This is much faster than shrimp_check as it returns cached results from the background watcher. Use this to monitor health changes in real-time.',
      inputSchema: {
        type: 'object',
        properties: {
          includeIssues: {
            type: 'boolean',
            description: 'Include top 10 issues in response',
          },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'shrimp_check': {
        const { path, threshold } = CheckHealthSchema.parse(args);

        let command = 'check --json';
        if (threshold) {
          command += ` --threshold ${threshold}`;
        }

        const result = await runShrimpCommand(command, path);

        if (result.exitCode !== 0 && !result.output.includes('Score:')) {
          throw new McpError(
            ErrorCode.InternalError,
            `Shrimp check failed: ${result.output}`
          );
        }

        const parsed = parseHealthOutput(result.output);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  healthScore: parsed.score,
                  summary: parsed.summary,
                  recommendations: parsed.recommendations,
                  passed: threshold ? parsed.score >= threshold : true,
                  details: parsed.details,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'shrimp_fix': {
        const { path, dryRun } = FixIssuesSchema.parse(args);

        let command = 'fix';
        if (dryRun) {
          command += ' --dry-run';
        }

        const result = await runShrimpCommand(command, path);

        return {
          content: [
            {
              type: 'text',
              text: result.output,
            },
          ],
        };
      }

      case 'shrimp_status': {
        const { path, detailed } = GetStatusSchema.parse(args);

        let command = 'check --json';
        const result = await runShrimpCommand(command, path);
        const parsed = parseHealthOutput(result.output);

        const statusOutput = {
          currentHealth: parsed.score,
          summary: parsed.summary,
          topIssues: parsed.recommendations.slice(0, 5),
          ...(detailed && { fullDetails: parsed.details }),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(statusOutput, null, 2),
            },
          ],
        };
      }

      case 'shrimp_explain': {
        const { issueType, context } = ExplainIssueSchema.parse(args);

        // Build explanation based on issue type
        const explanations: Record<string, string> = {
          'unused-import': `
# Unused Import

**Why it matters:** Unused imports increase bundle size, slow down compilation, and clutter the code.

**How to fix:** Remove the import statement if the imported item is not used anywhere in the file.

**Example:**
\`\`\`typescript
// Before
import { useState, useEffect } from 'react'; // useEffect is unused

// After
import { useState } from 'react';
\`\`\`

**Auto-fix:** Shrimp can automatically remove unused imports safely.
          `,
          'empty-catch': `
# Empty Catch Block

**Why it matters:** Empty catch blocks silently swallow errors, making debugging nearly impossible.

**How to fix:** Either handle the error properly or add a comment explaining why it's safe to ignore.

**Example:**
\`\`\`typescript
// Before
try {
  riskyOperation();
} catch (error) {}

// After (Option 1: Handle it)
try {
  riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Fallback logic
}

// After (Option 2: Document why it's safe)
try {
  riskyOperation();
} catch (error) {
  // Error intentionally ignored - operation is optional
}
\`\`\`

**Auto-fix:** Shrimp adds a comment explaining the suppression.
          `,
          'missing-alt': `
# Missing Alt Text

**Why it matters:** Screen readers need alt text to describe images for visually impaired users.

**How to fix:** Add descriptive alt text or empty alt="" for decorative images.

**Example:**
\`\`\`tsx
// Before
<img src="/avatar.png" />

// After (meaningful image)
<img src="/avatar.png" alt="User profile avatar" />

// After (decorative image)
<img src="/decoration.png" alt="" />
\`\`\`

**Auto-fix:** Shrimp infers alt text from context or marks as decorative.
          `,
          'inline-object': `
# Inline Object in Render

**Why it matters:** Creates new object on every render, causing unnecessary re-renders of child components.

**How to fix:** Extract object outside component or use useMemo.

**Example:**
\`\`\`tsx
// Before
<ChildComponent style={{ margin: 10 }} />

// After (Option 1: Extract)
const style = { margin: 10 };
<ChildComponent style={style} />

// After (Option 2: useMemo)
const style = useMemo(() => ({ margin: 10 }), []);
<ChildComponent style={style} />
\`\`\`

**Auto-fix:** Complex - requires manual refactoring.
          `,
        };

        const explanation = explanations[issueType] || `
# ${issueType}

No detailed explanation available for this issue type yet.

${context ? `Context: ${context}` : ''}

Run \`shrimp check\` to see where this issue appears in your codebase.
        `;

        return {
          content: [
            {
              type: 'text',
              text: explanation.trim(),
            },
          ],
        };
      }

      case 'shrimp_watch_start': {
        const { path } = WatchStartSchema.parse(args);

        if (!FileWatcher) {
          throw new McpError(
            ErrorCode.InternalError,
            'File watcher not available. Please build Shrimp first (bun run build)'
          );
        }

        // Check if watcher is already running
        const existing = getWatcherInstance?.();
        if (existing && existing.getStatus().isRunning) {
          const status = existing.getStatus();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: 'File watcher already running',
                    healthScore: status.healthScore,
                    filesWatched: status.filesWatched,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Create and start new watcher
        try {
          const watcher = new FileWatcher(path || process.cwd());
          await watcher.start();
          setWatcherInstance?.(watcher);

          const status = watcher.getStatus();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: 'File watcher started successfully',
                    filesWatched: status.filesWatched,
                    initialHealth: status.healthScore,
                    trend: status.trend,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to start file watcher: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      case 'shrimp_watch_stop': {
        WatchStopSchema.parse(args);

        const watcher = getWatcherInstance?.();
        if (!watcher) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: 'No file watcher running',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        try {
          const finalStatus = watcher.getStatus();
          await watcher.stop();
          setWatcherInstance?.(null);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: 'File watcher stopped',
                    finalHealth: finalStatus.healthScore,
                    checksPerformed: finalStatus.checksPerformed,
                    filesWatched: finalStatus.filesWatched,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to stop file watcher: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      case 'shrimp_get_live_status': {
        const { includeIssues } = GetLiveStatusSchema.parse(args);

        const watcher = getWatcherInstance?.();
        if (!watcher) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'No file watcher running',
                    suggestion: 'Call shrimp_watch_start first to enable live status',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const status = watcher.getStatus();

        const response: {
          isRunning: boolean;
          healthScore: number;
          previousScore: number;
          trend: string;
          issueCount: number;
          lastCheckTime: number;
          filesWatched: number;
          checksPerformed: number;
          topIssues?: Array<{
            file: string;
            line: number;
            category: string;
            message: string;
            severity: 'error' | 'warning' | 'info';
          }>;
        } = {
          isRunning: status.isRunning,
          healthScore: status.healthScore,
          previousScore: status.previousScore,
          trend: status.trend,
          issueCount: status.issueCount,
          lastCheckTime: status.lastCheckTime,
          filesWatched: status.filesWatched,
          checksPerformed: status.checksPerformed,
        };

        if (includeIssues) {
          response.topIssues = status.topIssues.slice(0, 10);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.message}`);
    }
    throw error;
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Shrimp MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});