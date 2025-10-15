# Shrimp Health

> **Claude MCP Server for Next.js 15+ Code Quality - 100% Open Source**

Keep your Next.js codebase clean, WCAG 2.0 compliant, and following best practices with Shrimp Health - the MCP server designed for Claude Code that automatically monitors and fixes code quality issues.

[![npm version](https://badge.fury.io/js/shrimp-health.svg)](https://www.npmjs.com/package/shrimp-health)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-406%20passing-brightgreen)](tests/)
[![Coverage](https://img.shields.io/badge/coverage-84.56%25-brightgreen)](tests/)
[![Performance](https://img.shields.io/badge/avg%20speed-19ms%2Ffile-green)](tests/integration/real-world.test.ts)

## Why Shrimp Health?

Shrimp Health is your **quality copilot** - an MCP server specifically designed for Claude Code users building Next.js 15+ applications. Unlike general linters, Shrimp focuses on App Router best practices, WCAG 2.0 compliance, and keeping your codebase clean:

- **Next.js 15+ Focused**: Deep understanding of App Router, Server Components, and Vercel patterns
- **WCAG 2.0 Compliance**: Automated accessibility checks for your UI components
- **Production-Ready**: 406 tests with 84.56% coverage ensure reliability
- **Fast**: 19ms average per file - analyze your entire codebase in seconds
- **MCP Native**: Works seamlessly inside Claude Code conversations
- **Battle-Tested**: Validated on real Next.js projects and self-dogfooded

**Not a replacement for ESLint** - Shrimp complements your linter by focusing on Next.js patterns, accessibility, and best practices that traditional linters miss.

## Features

### Comprehensive Health Checks
- **Bug Detection** - Catch common bugs before they hit production
- **Performance Analysis** - Identify performance bottlenecks
- **Import Optimization** - Clean up unused and disorganized imports
- **Code Consistency** - Enforce patterns across your codebase
- **Complexity Analysis** - Find overly complex functions
- **Accessibility (WCAG 2.0)** - Ensure your UI is accessible
- **Next.js Best Practices** - Framework-specific optimizations

### AI-Powered Auto-Fixing
- **Claude Integration** - Automatically invoke Claude to fix complex issues
- **Confidence-Scored Fixes** - Auto-fix with 0.0-1.0 confidence ratings
- **Health Score** - Get a 0-100 score for your codebase health
- **Actionable Recommendations** - Know exactly what to improve

### Developer Experience
- **Lightning Fast** - 19ms per file average (under 50ms target)
- **Git Hooks** - Run automatically on every commit
- **Real-time Watching** - Monitor health as you code (via MCP)
- **Beautiful CLI** - Clear, colorful output
- **406 Tests** - Comprehensive test coverage with 84.56% coverage

## Installation

```bash
# Global installation (recommended)
npm install -g shrimp-health

# Or use with npx (no installation)
npx shrimp-health check

# Project installation
npm install --save-dev shrimp-health
```

## Quick Start

```bash
# Run health check
shrimp check

# Auto-fix simple issues
shrimp fix

# Invoke Claude for complex fixes (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=your_key_here
shrimp fix --claude

# Run in CI/CD
shrimp check --threshold 80 --json

# View usage statistics
shrimp status
```

## Usage

### Basic Health Check

```bash
shrimp check
```

Output:
```
Shrimp Codebase Health Check v4.0
[OK] Health Check completed in 87ms - Score: 92/100

Recommendations:
  - Fix 2 critical bug(s)
  - Remove 5 unused import(s)
  - Address 3 Next.js warning(s)
```

### Auto-Fix

```bash
# Fix simple issues automatically
shrimp fix

# Use Claude to fix complex issues (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=your_key_here
shrimp fix --claude
```

### Git Hook Integration

```bash
# Install git hooks
shrimp install-hooks

# Uninstall
shrimp uninstall-hooks
```

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
shrimp check --threshold 85 || exit 1
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Health Check
  run: |
    npm install -g shrimp-health
    shrimp check --threshold 80 --json > health-report.json
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
    "*.test.ts"
  ],
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

## What Gets Checked

### Bug Detection
- Empty catch blocks
- Missing error handling
- Type safety issues
- Null/undefined handling
- Array access bugs

### Performance Issues
- Inline objects in render
- Missing memoization
- Expensive operations in loops
- Memory leaks

### Import Issues
- Unused imports
- Circular dependencies
- Import organization
- Missing dependencies

### Code Consistency
- Naming conventions
- Function patterns
- Error handling patterns
- File organization

### Accessibility (WCAG)
- Missing alt text
- Keyboard accessibility
- Focus management
- ARIA labels

### Next.js Patterns
- Server/client components
- Image optimization
- Font optimization
- Route best practices

## Claude Integration

Shrimp can automatically invoke Claude to fix complex issues:

```bash
# Enable Claude auto-fix (requires API key)
export ANTHROPIC_API_KEY=your_key_here
shrimp fix --claude
```

Claude will:
1. Read your codebase context
2. Understand the detected issues
3. Apply fixes while maintaining your code style
4. Run verification checks

### Claude Code (MCP) Integration

Use Shrimp directly inside Claude Code conversations!

Shrimp includes an MCP (Model Context Protocol) server that lets Claude Code run health checks and apply fixes automatically during your conversations.

**Quick Setup:**

```bash
# Build the MCP server
cd mcp-server
bun install && bun run build

# Add to Claude Code config (~/.config/Claude/claude_desktop_config.json)
{
  "mcpServers": {
    "shrimp-health": {
      "command": "node",
      "args": ["/full/path/to/shrimp-health/mcp-server/build/index.js"]
    }
  }
}
```

**Then restart Claude Code and try:**

> "Run a health check on this project"

Claude Code will automatically use Shrimp's tools! See [mcp-server/SETUP.md](mcp-server/SETUP.md) for full instructions.

**Available MCP Tools:**
- `shrimp_check` - Run health checks with threshold enforcement
- `shrimp_fix` - Auto-fix issues (with dry-run support)
- `shrimp_status` - Get quick status with detailed breakdown
- `shrimp_explain` - Explain issue types with examples
- `shrimp_watch_start` - Start real-time file watching
- `shrimp_watch_stop` - Stop file watching and get statistics
- `shrimp_get_live_status` - Get cached watcher status (fast, no re-scan)
- `shrimp_precommit` - Pre-commit checks for git hooks (NEW!)

## Health Score

Your health score (0-100) is calculated from:
- Bug severity and count (30%)
- Performance issues (25%)
- Code consistency (20%)
- Import cleanliness (10%)
- Accessibility (10%)
- Framework best practices (5%)

Points are deducted based on issue severity:
- Critical bugs: -5pts each (capped at 20pts)
- Performance issues: -4pts each (capped at 15pts)
- Next.js violations: -3pts each (capped at 15pts)
- Consistency issues: -1pt per 3 issues (capped at 10pts)
- Import issues: -0.5pts each (capped at 10pts)

## Validation & Performance

Shrimp Health has been validated against 5 real Next.js projects to ensure high precision and low false positive rates.

### Tested Projects
- **shadcn-ui** - 2,000+ component library
- **create-t3-app** - CLI scaffolding tool
- **tailwind-blog** - Content-focused blog
- **leerob.io** - Highly polished personal site (94.8/100 health score)
- **blog-starter** - Official Next.js example

### Results
- **406 Tests** - 84.56% coverage for reliability
- **19ms Average** - Per file analysis time
- **Self-Dogfooded** - Shrimp runs on itself (95.8/100 health score)
- **Real Projects** - Validated on production Next.js codebases

### Performance Benchmarks
```
Average analysis time: 19.02ms per file
100 files: ~1.9 seconds
1,000 files: ~19 seconds
Target: <50ms per file ✓
Memory usage: <200MB typical
```

## API Usage

```typescript
import { ShrimpHealth } from 'shrimp-health';

const shrimp = new ShrimpHealth({
  sourceRoot: './src',
  config: { /* ... */ }
});

const result = await shrimp.check();
console.log(`Health Score: ${result.healthScore}/100`);
console.log(`Issues: ${result.totalIssues}`);
```

## Contributing

We welcome contributions! Here's how to get started:

### Development Setup
```bash
# Clone the repository
git clone https://github.com/cameronspears/shrimp-health.git
cd shrimp-health

# Install dependencies
bun install

# Run tests (all 406 must pass!)
bun test

# Build the project
bun run build

# Build MCP server
cd mcp-server && bun install && bun run build
```

### Testing Requirements
- All 406 tests must pass before submitting PRs
- Maintain 84.56%+ test coverage
- New features require corresponding test coverage
- Integration tests validate against real-world projects
- See [CLAUDE.md](CLAUDE.md) for detailed development guidelines

### Quality Standards
- Keep analysis time under 50ms per file (currently 19ms)
- Follow TypeScript strict mode
- Document all public APIs
- Self-dogfood: Shrimp must score 95+ on itself

## License

MIT License - see [LICENSE](LICENSE)

## Links

- [GitHub Repository](https://github.com/cameronspears/shrimp-health)
- [Development Guide](CLAUDE.md)
- [MCP Setup Guide](mcp-server/SETUP.md)

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/cameronspears/shrimp-health/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cameronspears/shrimp-health/discussions)
- **Documentation**: See [CLAUDE.md](CLAUDE.md) for detailed docs

---

Made by the open source community
