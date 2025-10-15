# Shrimp Health MCP Server

MCP (Model Context Protocol) server for Shrimp Health - enables Claude Code to run health checks and apply fixes directly during conversations.

## What This Does

The Shrimp MCP server gives Claude Code the ability to:

- Run health checks with threshold enforcement
- Automatically fix safe code health issues (with dry-run support)
- Get quick health status summaries with detailed breakdowns
- Explain specific code health issues with examples and fixes
- Watch files in real-time for continuous quality monitoring
- Run pre-commit checks on staged files

All without you having to leave your conversation with Claude Code.

## Quick Start

### 1. Build the MCP Server

```bash
cd mcp-server
bun install
bun run build
```

### 2. Configure Claude Code

Add to your Claude Code MCP settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "shrimp-health": {
      "command": "node",
      "args": [
        "/full/path/to/shrimp-health/mcp-server/build/index.js"
      ]
    }
  }
}
```

Replace `/full/path/to` with the actual path to your Shrimp installation.

### 3. Restart Claude Code

Close and reopen Claude Code to load the MCP server.

### 4. Test It

Start a conversation with Claude Code and try:

> "Run a shrimp health check on this project"

Claude Code will automatically use the `shrimp_check` tool and show you the results!

## Available Tools

### shrimp_check

Run a comprehensive health check on a codebase with threshold enforcement.

**Parameters:**
- `path` (optional): Path to check (defaults to current directory)
- `threshold` (optional): Minimum health score threshold (0-100)

**Example Claude Code usage:**
> "Check the health of the src directory with a threshold of 85"

### shrimp_fix

Automatically fix safe code health issues with dry-run support.

**Parameters:**
- `path` (optional): Path to fix (defaults to current directory)
- `dryRun` (optional): Preview fixes without applying them

**Example Claude Code usage:**
> "Fix all import issues in dry-run mode"

### shrimp_status

Get quick status of codebase health with detailed breakdown.

**Parameters:**
- `path` (optional): Path to check (defaults to current directory)
- `detailed` (optional): Include detailed breakdown

**Example Claude Code usage:**
> "What's the current health status?"

### shrimp_explain

Get detailed explanation of a specific issue type with examples and fixes.

**Parameters:**
- `issueType` (required): Type of issue (e.g., "unused-import", "empty-catch", "missing-alt")
- `context` (optional): Additional context

**Example Claude Code usage:**
> "Explain the empty-catch issue"

### shrimp_watch_start

Start background file watching for real-time health monitoring.

**Parameters:**
- `path` (optional): Path to watch (defaults to current directory)

**Example Claude Code usage:**
> "Start watching my codebase for health changes"

### shrimp_watch_stop

Stop background file watching and get final statistics.

**Parameters:** None

**Example Claude Code usage:**
> "Stop watching and show me the final stats"

### shrimp_get_live_status

Get real-time health status from the file watcher (fast, no re-scan).

**Parameters:**
- `includeIssues` (optional): Include top 10 issues in response

**Example Claude Code usage:**
> "What's the live health status?"

### shrimp_precommit

Run health checks on staged files before committing (NEW!).

**Parameters:**
- `stagedFiles` (optional): List of staged files to check (defaults to git diff --staged)
- `threshold` (optional): Minimum health score threshold to pass (default: 80)
- `autoFix` (optional): Automatically fix issues before commit (default: false)

**Example Claude Code usage:**
> "Check my staged files before I commit"

## Example Workflow

Here's a typical workflow with Claude Code + Shrimp MCP:

1. **Start a refactoring session:**
   > "I want to refactor the authentication module"

2. **Claude Code checks health first:**
   - Automatically runs `shrimp_check` on relevant files
   - Shows current health score and issues

3. **Claude Code suggests fixes:**
   - "I see there are 3 unused imports and 2 accessibility issues. I'll fix those as part of the refactor."
   - Runs `shrimp_fix` automatically

4. **Refactoring complete:**
   - Shows health score improvement
   - "Health improved from 87 → 92"

## Configuration

You can configure Shrimp behavior with `.shrimprc.json` in your project root:

```json
{
  "checks": {
    "bugs": true,
    "performance": true,
    "imports": true,
    "consistency": true,
    "wcag": true,
    "nextjs": true
  },
  "ignore": [
    "node_modules",
    "dist",
    ".next"
  ],
  "thresholds": {
    "minimum": 80,
    "target": 95
  },
  "autofix": {
    "enabled": true
  }
}
```

## Troubleshooting

### "Shrimp CLI not found" error

Make sure you've built the main Shrimp CLI:

```bash
cd /path/to/shrimp-health
bun install
bun run build
```

### MCP server not showing up in Claude Code

1. Check that the path in `claude_desktop_config.json` is correct
2. Make sure you've run `bun run build` in the mcp-server directory
3. Restart Claude Code completely

### Tools not working

Check the Claude Code logs for errors:
- macOS: `~/Library/Logs/Claude/mcp-server-shrimp-health.log`

## Development

### Running in Development Mode

```bash
bun run dev
```

This watches for changes and rebuilds automatically.

### Testing the MCP Server

You can test the MCP server directly:

```bash
# The server runs on stdio, so you can test it with echo
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node build/index.js
```

## License

MIT
