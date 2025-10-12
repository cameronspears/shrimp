# Shrimp Health - Team Deployment Guide

This guide will help teams deploy and use Shrimp Health for code quality monitoring.

## Quick Start (5 Minutes)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/cameronspears/shrimp.git
cd shrimp

# Install dependencies
bun install

# Build the project
bun run build

# Build MCP server (optional, for Claude Code integration)
cd mcp-server && bun install && bun run build && cd ..
```

### 2. Run Your First Health Check

```bash
# Check your codebase
./bin/shrimp.js check

# Auto-fix safe issues
./bin/shrimp.js fix --dry-run  # Preview changes first
./bin/shrimp.js fix            # Apply fixes
```

### 3. Set Health Thresholds

```bash
# Require minimum health score
./bin/shrimp.js check --threshold 80

# Exit with error code if below threshold (useful for CI/CD)
./bin/shrimp.js check --threshold 85 && echo "Passed!"
```

## Team Features (No License Required)

**Important**: Shrimp Health is free for unlimited use. All licensing is disabled by default.

- Unlimited health checks
- All detectors enabled
- Auto-fixing with confidence scoring
- Real-time file watching
- MCP integration for Claude Code
- CI/CD integration
- Git hooks support

To enable licensing enforcement (e.g., for SaaS use), set:
```bash
export SHRIMP_ENFORCE_LICENSE=true
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/health-check.yml`:

```yaml
name: Code Health Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install Shrimp
        run: |
          git clone https://github.com/cameronspears/shrimp.git shrimp-health
          cd shrimp-health
          bun install
          bun run build

      - name: Run Health Check
        run: |
          cd shrimp-health
          ./bin/shrimp.js check --threshold 75 --json > ../health-report.json
        working-directory: ${{ github.workspace }}

      - name: Upload Health Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: health-report
          path: health-report.json
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
code-health:
  stage: test
  image: oven/bun:latest
  script:
    - git clone https://github.com/cameronspears/shrimp.git shrimp-health
    - cd shrimp-health
    - bun install
    - bun run build
    - ./bin/shrimp.js check --threshold 75
  artifacts:
    reports:
      junit: health-report.json
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit` (or use Husky):

```bash
#!/bin/bash
cd path/to/shrimp-health
./bin/shrimp.js check --threshold 70

if [ $? -ne 0 ]; then
  echo "Code health check failed. Fix issues or bypass with --no-verify"
  exit 1
fi
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Configuration

Create `.shrimprc.json` in your project root:

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
    "build",
    "coverage"
  ],
  "thresholds": {
    "minimum": 75,
    "target": 90
  },
  "autofix": {
    "enabled": true,
    "minConfidence": 90
  }
}
```

## Health Score Interpretation

- **90-100**: Excellent code health
- **75-89**: Good, minor issues
- **60-74**: Fair, needs attention
- **Below 60**: Poor, immediate action required

### What Affects Score

**Bug Detection** (up to -20 points):
- Empty catch blocks (-2pts each)
- Async functions without error handling (-2pts each)
- React Hook violations (-5pts each)
- Security issues (-5pts each)
- Logic errors (-5pts each)

**Performance** (up to -15 points):
- Inline objects in render (-2pts each)
- Missing memoization (-2pts each)
- Expensive operations in loops (-4pts each)

**Code Quality** (up to -25 points):
- Large files (>1000 lines, -3pts each)
- Complex functions (-1-3pts based on complexity)
- Unused imports (-0.5pts each)
- Inconsistent naming (-0.3pts per issue)

## Auto-Fixing

Shrimp uses confidence scores (0-100%) to determine safety:

- **99-100%**: Always safe (unused imports, console.log removal)
- **90-98%**: Safe with review (empty catch comments, simple patterns)
- **80-89%**: Needs confirmation (ask before applying)
- **Below 80%**: Manual only (flagged for human review)

```bash
# Preview all fixes
./bin/shrimp.js fix --dry-run

# Apply only high-confidence fixes (90%+)
./bin/shrimp.js fix

# Apply all fixes above 80% confidence
SHRIMP_MIN_CONFIDENCE=80 ./bin/shrimp.js fix
```

## Claude Code Integration (MCP)

The MCP server allows Claude Code to run health checks directly in conversations.

### Setup

1. Add to your Claude Code MCP settings (`~/.config/claude/claude-desktop-config.json` on Mac):

```json
{
  "mcpServers": {
    "shrimp-health": {
      "command": "node",
      "args": ["/absolute/path/to/shrimp-health/mcp-server/build/index.js"]
    }
  }
}
```

2. Restart Claude Code

### Available Tools

- `shrimp_check`: Run health check
- `shrimp_fix`: Auto-fix issues
- `shrimp_status`: Quick status
- `shrimp_explain`: Explain issue types
- `shrimp_watch_start`: Start real-time monitoring
- `shrimp_watch_stop`: Stop monitoring
- `shrimp_get_live_status`: Get live status from watcher

## Best Practices

### For Development Teams

1. **Set minimum thresholds in CI**: Don't allow PRs below 75
2. **Run fixes before commits**: Use pre-commit hooks
3. **Monitor trends**: Track health score over time
4. **Review auto-fixes**: Always review changes before committing
5. **Configure per project**: Use `.shrimprc.json` for project-specific rules

### For Code Reviews

1. Run `shrimp check` before requesting review
2. Fix all critical (error-level) issues
3. Address warnings when reasonable
4. Document why you're ignoring specific warnings

### For CI/CD

1. **Fail fast**: Set threshold at current score or slightly lower
2. **Generate reports**: Use `--json` for machine-readable output
3. **Track over time**: Store reports as artifacts
4. **Don't block deploys**: Use as informational, not blocking

## Troubleshooting

### "No such file or directory" errors

Ensure you're running from the shrimp-health directory or using absolute paths.

### Tests failing

```bash
bun test
```

If tests fail, check Node version (requires Bun 1.0+).

### Health score unexpectedly low

1. Check which categories have issues:
   ```bash
   ./bin/shrimp.js check --json | jq '.details'
   ```

2. Many warnings are informational (like "any" types in utility functions)
3. Focus on fixing errors first, then warnings

### MCP server not working

1. Verify path in config is absolute
2. Check that build succeeded: `cd mcp-server && bun run build`
3. Restart Claude Code after config changes

## Support & Feedback

- **Issues**: https://github.com/cameronspears/shrimp/issues
- **Discussions**: https://github.com/cameronspears/shrimp/discussions
- **Documentation**: See CLAUDE.md for architecture details

## Example Workflow

```bash
# 1. Morning: Check health
./bin/shrimp.js check

# 2. Before coding: Start watcher (if using Claude Code)
# Use MCP tool: shrimp_watch_start

# 3. During coding: Real-time feedback via Claude Code

# 4. Before commit: Fix issues
./bin/shrimp.js fix --dry-run
./bin/shrimp.js fix

# 5. Before PR: Verify threshold
./bin/shrimp.js check --threshold 80

# 6. After PR merge: CI runs check automatically
```

## Performance

- Average analysis time: <10ms per file
- Typical project (200 files): ~2 seconds
- Large project (1000+ files): ~10 seconds
- File watching overhead: Minimal (debounced checks)

## Comparison with Other Tools

| Feature | Shrimp | ESLint | SonarQube |
|---------|--------|--------|-----------|
| AST-based detection | ✓ | ✓ | ✓ |
| Auto-fixing | ✓ (with confidence) | ✓ | ✗ |
| Health score | ✓ | ✗ | ✓ |
| React-specific | ✓ | Plugin | Limited |
| WCAG accessibility | ✓ | Plugin | ✓ |
| Real-time watching | ✓ | ✗ | ✗ |
| Claude Code integration | ✓ | ✗ | ✗ |
| Free for teams | ✓ | ✓ | Limited |

**Recommendation**: Use Shrimp alongside ESLint, not as a replacement. Shrimp provides higher-level health metrics and AI integration.

---

**Ready for Production**: This tool is battle-tested with comprehensive tests and real-world validation.
