# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shrimp Health is an AI-powered code health monitoring CLI tool with automated fixes. It analyzes codebases for bugs, performance issues, code consistency, import problems, accessibility issues (WCAG), and Next.js best practices. The tool provides a 0-100 health score and can automatically fix issues either through simple pattern matching or by invoking Claude AI for complex fixes.

**Key differentiator:** Shrimp includes an MCP (Model Context Protocol) server that enables Claude Code to run health checks and apply fixes directly within conversations.

## Development Commands

### Build & Development
```bash
# Build TypeScript to dist/
bun run build

# Watch mode for development
bun run dev

# Build MCP server
cd mcp-server && bun install && bun run build
```

### Testing
```bash
# Run all tests
bun test

# Run unit tests only
bun test:unit

# Run integration tests only
bun test:integration

# Watch mode
bun test:watch

# Generate test report
bun run test:report

# Track quality trends
bun run test:track
```

### CLI Usage
```bash
# Run health check
./bin/shrimp.js check

# Auto-fix issues
./bin/shrimp.js fix

# Use Claude AI for complex fixes (requires ANTHROPIC_API_KEY)
./bin/shrimp.js fix --claude

# Check with threshold (exits 1 if below threshold)
./bin/shrimp.js check --threshold 85

# JSON output
./bin/shrimp.js check --json

# License activation
./bin/shrimp.js activate <license-key> <email>

# Status/usage info
./bin/shrimp.js status
```

## Architecture

### Core Components

**Entry Points:**
- `bin/shrimp.js` - CLI entry point using Commander.js
- `src/index.ts` - Main programmatic API (`ShrimpHealth` class)
- `mcp-server/src/index.ts` - MCP server for Claude Code integration

**Health Check Flow:**
1. `ShrimpHealth.check()` validates license and quota
2. Creates `CodebaseMaintenance` instance (src/core/health-check.ts)
3. `CodebaseMaintenance.run()` orchestrates all checks via `ShrimpChecks`
4. `ShrimpChecks` (src/core/health-analyzer.ts) runs all detectors
5. Results aggregated into `MaintenanceResult` with 0-100 health score

**Detector System:**
All detectors live in `src/detectors/` and follow a common pattern:
- Analyze individual files or entire codebase
- Return issues with severity levels (error/warning/info or critical/moderate/minor)
- Track severity counts for scoring
- Group issues by category

Available detectors:
- `bug-detector.ts` - Empty catch blocks, null handling, type issues
- `performance-detector.ts` - Inline objects, missing memoization, expensive loops
- `import-detector.ts` - Unused imports, circular dependencies, organization
- `consistency-detector.ts` - Naming conventions, patterns, file organization
- `nextjs-detector.ts` - Server/client components, image/font optimization
- `wcag-detector.ts` - Accessibility issues (alt text, ARIA, keyboard nav)

### Health Score Calculation

Starting from 100, points are deducted by each check:
- Bug issues: critical=5pts, warning=2pts, info=0.5pts (capped at 20)
- Performance: critical=4pts, moderate=2pts, minor=0.5pts (capped at 15)
- Next.js: errors=3pts, warnings=1pt, info=0.2pts (capped at 15)
- Consistency: 1pt per 3 issues (capped at 10)
- Imports: unused=0.5pts each, organization=0.3pts (capped at 10)
- Traditional checks (TODO comments, large files, complexity): various caps at 4-15pts

Final score: `Math.max(0, Math.min(100, score))`

### Auto-Fix System

**src/core/auto-fixer.ts:**
- Provides confidence-scored fixes (0.0-1.0)
- Safe fixes (confidence ≥ 0.9): unused imports, console.log removal, empty dirs
- Medium confidence (0.7-0.89): simple pattern replacements
- Low confidence (<0.7): marked for manual review or Claude AI

**Claude Integration (src/integrations/claude-integration.ts):**
- Invokes Claude API to fix complex issues
- Requires `ANTHROPIC_API_KEY` and Pro license
- Used via `--claude` flag

### Licensing System

**Free Tier:** 50 checks/month, basic detectors
**Pro ($6/mo):** Unlimited checks, Claude AI fixes, advanced detectors, git hooks
**Team ($24/mo):** Pro + multi-repo, team dashboard, CI/CD integration

Files:
- `src/licensing/license-validator.ts` - Validates license and quotas
- `src/licensing/usage-tracker.ts` - Tracks usage stats using `conf` package

License data stored in user config dir (~/.config/shrimp-health-nodejs/)

### MCP Server

**Location:** `mcp-server/`

Exposes 8 tools for Claude Code integration:
- `shrimp_check` - Run health checks
- `shrimp_fix` - Auto-fix issues (with dry-run support)
- `shrimp_status` - Quick health status
- `shrimp_explain` - Explain issue types
- `shrimp_watch_start` - Start real-time file watching
- `shrimp_watch_stop` - Stop file watching
- `shrimp_get_live_status` - Get cached watcher status

Implementation uses `@modelcontextprotocol/sdk` for stdio transport.

### File Watching (Real-time Monitoring)

**src/core/file-watcher.ts:**
- Uses `chokidar` for file system watching
- Debounces checks (1 second default)
- Maintains health score history
- Singleton pattern via `getWatcherInstance()`
- Started/stopped by MCP tools: `shrimp_watch_start`, `shrimp_watch_stop`

## Important Patterns

### File Filtering
Most checks use `shouldIgnoreFile()` to skip:
- Shrimp's own source files (shrimp, health-check, health-analyzer, detectors)
- node_modules, .next, .git, dist
- Generated files (*.generated.*)
- Test files (when appropriate)

Always respect this pattern when adding new detectors.

### Testing Strategy

**Unit Tests (tests/unit/):**
- Test individual detectors in isolation
- Use synthetic code samples
- Fast execution

**Integration Tests (tests/integration/):**
- Test full health check flow
- Use real project files
- Verify end-to-end behavior

**Baselines (tests/baselines/):**
- Track quality metrics over time
- Detect regressions in health scores
- Auto-generated by test:track script

### Configuration

Projects can include `.shrimprc.json`:
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
  "ignore": ["node_modules", "dist", ".next"],
  "thresholds": {
    "minimum": 80,
    "target": 95
  },
  "autofix": {
    "enabled": true,
    "claude": false
  }
}
```

Config is loaded by detectors/checks as needed.

## Adding New Detectors

1. Create `src/detectors/new-detector.ts` following existing pattern:
   - Export a class with `analyze()` or `analyzeFile()` method
   - Implement severity tracking
   - Provide `getIssues()` and `getSeverityCount()` methods

2. Add to `ShrimpChecks` in src/core/health-analyzer.ts:
   - Import detector
   - Add `checkNewFeature()` method
   - Call from `analyzeCodebaseHealth()` in src/core/health-check.ts
   - Assign point values and cap

3. Export from src/index.ts

4. Add filtering for self-checks to `shouldIgnoreFile()`

5. Add tests in tests/unit/

## TypeScript Configuration

- Target: ES2022
- Module: NodeNext (ESM with .js extensions in imports)
- Output: dist/
- Strict mode enabled
- Always use `.js` extensions in import paths (TypeScript ESM requirement)

## Dependencies

**Core:**
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - Spinners
- `boxen` - Boxes
- `chokidar` - File watching
- `conf` - User config storage

**MCP:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Schema validation

**Dev:**
- `typescript` - Compiler
- `@types/bun` - Bun runtime types (testing with Bun)

## Testing with Bun

This project uses Bun for testing (not Node.js):
- Tests run with `bun test`
- Bun provides built-in test runner
- Much faster than Jest/Mocha
- Native TypeScript support

## Common Gotchas

1. **ESM Imports:** Always use `.js` extensions even for `.ts` files (TypeScript ESM requirement)
   ```typescript
   import { foo } from './foo.js'; // Correct
   import { foo } from './foo';    // Wrong
   ```

2. **Self-Analysis:** Shrimp ignores its own files to avoid recursive issues. When testing locally, make sure `shouldIgnoreFile()` is properly configured.

3. **License Checks:** Most features require license validation. Free tier is limited to 50 checks/month.

4. **Detector Performance:** Each detector is limited to analyzing a subset of files (typically 20-30) to keep checks fast (<100ms target).

5. **MCP Server Path:** The MCP server uses relative paths to find the main CLI. Structure must remain: `mcp-server/build/index.js` → `../../bin/shrimp.js`

## CI/CD Integration

For GitHub Actions:
```yaml
- name: Health Check
  run: |
    npm install -g @shrimphealth/cli
    shrimp check --threshold 80 --json > health-report.json
```

For git hooks:
```bash
shrimp install-hooks  # Shows setup instructions
# Or manually: npx husky add .husky/pre-commit "shrimp check --threshold 80"
```