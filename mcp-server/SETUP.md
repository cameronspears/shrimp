# Shrimp MCP Server Setup Guide

Get Shrimp working inside Claude Code in 5 minutes.

## Step-by-Step Installation

### 1. Build Shrimp MCP Server

```bash
# Navigate to the MCP server directory
cd /path/to/shrimp-health/mcp-server

# Install dependencies
bun install

# Build the server
bun run build

# Verify build succeeded
ls build/index.js  # Should show the file
```

### 2. Get Your Installation Path

```bash
# Get the full path to the built MCP server
pwd
# Example output: /Users/yourname/projects/shrimp-health/mcp-server

# You'll need: /Users/yourname/projects/shrimp-health/mcp-server/build/index.js
```

### 3. Configure Claude Code

#### On macOS:

```bash
# Open Claude Code's config file
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### On Linux:

```bash
# Open Claude Code's config file
nano ~/.config/Claude/claude_desktop_config.json
```

#### On Windows:

```powershell
# Open Claude Code's config file
notepad %APPDATA%\Claude\claude_desktop_config.json
```

### 4. Add Shrimp to MCP Config

If the file is empty or doesn't exist, add:

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

If you already have other MCP servers, add Shrimp to the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": ["..."]
    },
    "shrimp-health": {
      "command": "node",
      "args": [
        "/full/path/to/shrimp-health/mcp-server/build/index.js"
      ]
    }
  }
}
```

**Important:** Replace `/full/path/to/shrimp-health` with your actual path from step 2!

### 5. Restart Claude Code

Completely quit and restart Claude Code to load the MCP server.

### 6. Test It!

Open Claude Code and try:

```
Check the health of my codebase
```

Claude Code should automatically:
1. Detect it can use the `shrimp_check` tool
2. Run a health check
3. Show you the results with recommendations

## Quick Test Commands

Try these in Claude Code to test different tools:

1. **Health Check:**
   > "Run a health check on this project"

2. **Check with Threshold:**
   > "Check health and fail if below 85"

3. **Fix Issues:**
   > "Fix all the safe issues Shrimp found"

4. **Dry Run:**
   > "Show me what Shrimp would fix without applying changes"

5. **Explain an Issue:**
   > "Explain what an empty-catch block is and why it matters"

6. **Get Status:**
   > "What's the current health status?"

## Verification

You can verify the MCP server is working by checking Claude Code's logs:

### macOS:
```bash
tail -f ~/Library/Logs/Claude/mcp-server-shrimp-health.log
```

### Linux:
```bash
tail -f ~/.config/Claude/logs/mcp-server-shrimp-health.log
```

You should see:
```
Shrimp MCP Server running on stdio
```

## Troubleshooting

### "Tool not found" errors

**Symptom:** Claude Code doesn't recognize shrimp tools

**Solutions:**
1. Check the path in `claude_desktop_config.json` is absolute (not relative)
2. Verify `build/index.js` exists: `ls /your/path/mcp-server/build/index.js`
3. Check file is executable: `chmod +x /your/path/mcp-server/build/index.js`
4. Restart Claude Code completely

### "Shrimp CLI not found"

**Symptom:** MCP server runs but can't find the Shrimp CLI

**Solution:**
Build the main Shrimp package:
```bash
cd /path/to/shrimp-health
bun install
bun run build
```

The MCP server looks for the CLI at `../../bin/shrimp.js` (relative to the MCP server).

### "Permission denied"

**Symptom:** Can't execute the MCP server

**Solution:**
```bash
chmod +x /path/to/shrimp-health/mcp-server/build/index.js
```

### MCP server not loading

**Symptom:** No logs, Claude Code acts like MCP isn't there

**Solutions:**
1. Check JSON syntax in `claude_desktop_config.json` (no trailing commas!)
2. Restart Claude Code (not just reload, fully quit and reopen)
3. Check Claude Code version supports MCP (need v0.7+)

### Tools work but give errors

**Symptom:** Claude Code calls the tool but gets an error response

**Solutions:**
1. Make sure you're in a project directory when running checks
2. Verify `.shrimprc.json` is valid JSON if you have one
3. Check the MCP server logs for specific error messages

## Advanced: Using with Multiple Projects

You can configure Shrimp differently per project by adding `.shrimprc.json`:

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
    ".next",
    "coverage"
  ],
  "thresholds": {
    "minimum": 85,
    "target": 95
  }
}
```

The MCP server will respect these settings when Claude Code runs checks.

## Next Steps

Once Shrimp MCP is working:

1. **Try it on a real refactor:** Ask Claude Code to refactor something and watch it use Shrimp automatically

2. **Set up git hooks:** `shrimp install-hooks` to run checks on every commit

3. **Configure thresholds:** Set minimum health scores for your project

4. **Explore auto-fix:** Let Shrimp fix safe issues automatically

## Getting Help

- **Issues:** https://github.com/cameronspears/shrimp/issues
- **Discord:** [Join our community](#)
- **Email:** support@shrimphealth.com

Happy shipping! 🦐
