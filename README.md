# 🦐 Shrimp Health

> **AI-powered code health monitoring with automated fixes - 100% Open Source**

Keep your codebase clean, consistent, and bug-free with Shrimp Health - the open source code quality tool that can automatically fix issues using Claude AI.

[![npm version](https://badge.fury.io/js/%40shrimphealth%2Fcli.svg)](https://www.npmjs.com/package/shrimp-health)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-537%20passing-brightgreen)](tests/)
[![Precision](https://img.shields.io/badge/precision-66%25%2B-blue)](tests/validation/real-world-results.md)
[![Performance](https://img.shields.io/badge/avg%20speed-8ms%2Ffile-green)](tests/integration/real-world.test.ts)

## Why Shrimp Health?

Shrimp Health is your **quality copilot** - specifically designed for Next.js projects and Claude Code users. Unlike general linters, Shrimp focuses on catching the issues AI coding assistants tend to miss:

- **Framework-Aware**: Deep understanding of Next.js 15, Vercel, and React patterns
- **Production-Ready**: Validated on real Next.js projects (shadcn-ui, create-t3-app, and more)
- **High Precision**: 66%+ precision rate means actionable findings, not noise
- **Blazing Fast**: 8ms average per file - analyze 100 files in under a second
- **MCP Integration**: Works seamlessly inside Claude Code conversations
- **Battle-Tested**: 537 comprehensive tests ensure reliability

**Not a replacement for ESLint** - Shrimp complements your linter by focusing on architecture, performance, and Next.js-specific patterns that traditional linters miss.

## ✨ Features

### Comprehensive Health Checks
- 🐛 **Bug Detection** - Catch common bugs before they hit production
- ⚡ **Performance Analysis** - Identify performance bottlenecks
- 📦 **Import Optimization** - Clean up unused and disorganized imports
- 🎯 **Code Consistency** - Enforce patterns across your codebase
- 🧠 **Complexity Analysis** - Find overly complex functions
- ♿ **Accessibility (WCAG 2.0)** - Ensure your UI is accessible
- ⚛️ **Next.js Best Practices** - Framework-specific optimizations

### AI-Powered Auto-Fixing
- 🤖 **Claude Integration** - Automatically invoke Claude to fix complex issues
- 🔧 **Confidence-Scored Fixes** - Auto-fix with 0.0-1.0 confidence ratings
- 📊 **Health Score** - Get a 0-100 score for your codebase health
- 🎯 **Actionable Recommendations** - Know exactly what to improve

### Developer Experience
- ⚡ **Lightning Fast** - 8ms per file average (under 50ms target)
- 🪝 **Git Hooks** - Run automatically on every commit
- 📈 **Real-time Watching** - Monitor health as you code (via MCP)
- 🎨 **Beautiful CLI** - Clear, colorful output
- 🧪 **537 Tests** - Comprehensive test coverage for reliability

## 📦 Installation

```bash
# Global installation (recommended)
npm install -g shrimp-health

# Or use with npx (no installation)
npx shrimp-health check

# Project installation
npm install --save-dev shrimp-health
```

## 🚀 Quick Start

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

## 📖 Usage

### Basic Health Check

```bash
shrimp check
```

Output:
```
🦐 Shrimp Codebase Health Check v4.0
✅ Health Check completed in 87ms - Score: 92/100

📋 Recommendations:
  • Fix 2 critical bug(s)
  • Remove 5 unused import(s)
  • Address 3 Next.js warning(s)
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

## 🔧 Configuration

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

## 📊 What Gets Checked

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

## 🤖 Claude Integration

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

**NEW: Use Shrimp directly inside Claude Code conversations!**

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
- `shrimp_check` - Run health checks
- `shrimp_fix` - Auto-fix issues (with dry-run support)
- `shrimp_status` - Get quick status
- `shrimp_explain` - Explain issue types
- `shrimp_watch_start` - Start real-time file watching
- `shrimp_watch_stop` - Stop file watching
- `shrimp_get_live_status` - Get cached watcher status

## 📈 Health Score

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

## 📊 Validation & Performance

Shrimp Health has been validated against 5 real Next.js projects to ensure high precision and low false positive rates.

### Tested Projects
- **shadcn-ui** - 2,000+ component library
- **create-t3-app** - CLI scaffolding tool
- **tailwind-blog** - Content-focused blog
- **leerob.io** - Highly polished personal site (94.8/100 health score)
- **blog-starter** - Official Next.js example

### Results
- **66%+ Precision** - Two-thirds of findings are actionable
- **8.09ms Average** - Per file analysis time
- **537 Tests** - Comprehensive test suite
- **Real Projects** - Validated on production codebases

See [tests/validation/real-world-results.md](tests/validation/real-world-results.md) for detailed analysis.

### Performance Benchmarks
```
Average analysis time: 8ms per file
100 files: ~809ms
1,000 files: ~8 seconds
Target: <50ms per file ✓
Memory usage: <200MB typical
```

## 🛠️ API Usage

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

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup
```bash
# Clone the repository
git clone https://github.com/cameronapak/shrimp-health.git
cd shrimp-health

# Install dependencies
bun install

# Run tests (all 537 must pass!)
bun test

# Build the project
bun run build

# Build MCP server
cd mcp-server && bun install && bun run build
```

### Testing Requirements
- All 537 tests must pass before submitting PRs
- New features require corresponding test coverage
- Integration tests validate against real-world projects
- See [CLAUDE.md](CLAUDE.md) for detailed development guidelines

### Quality Standards
- Maintain 66%+ precision on validation projects
- Keep analysis time under 50ms per file
- Follow TypeScript strict mode
- Document all public APIs

## 📝 License

MIT License - see [LICENSE](LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/cameronapak/shrimp-health)
- [Validation Results](tests/validation/real-world-results.md)
- [Development Guide](CLAUDE.md)
- [MCP Setup Guide](mcp-server/SETUP.md)

## 💬 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/cameronapak/shrimp-health/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/cameronapak/shrimp-health/discussions)
- 📖 **Documentation**: See [CLAUDE.md](CLAUDE.md) for detailed docs

---

Made with 🦐 by the open source community
