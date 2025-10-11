# 🦐 Shrimp Health

> **AI-powered code health monitoring with automated fixes**

Keep your codebase clean, consistent, and bug-free with Shrimp Health - the only code quality tool that can automatically fix issues using Claude AI.

[![npm version](https://badge.fury.io/js/%40shrimphealth%2Fcli.svg)](https://www.npmjs.com/package/@shrimphealth/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

### Comprehensive Health Checks
- 🐛 **Bug Detection** - Catch common bugs before they hit production
- ⚡ **Performance Analysis** - Identify performance bottlenecks
- 📦 **Import Optimization** - Clean up unused and disorganized imports
- 🎯 **Code Consistency** - Enforce patterns across your codebase
- 🧠 **Complexity Analysis** - Find overly complex functions
- ♿ **Accessibility (WCAG)** - Ensure your UI is accessible
- ⚛️ **Next.js Best Practices** - Framework-specific optimizations

### AI-Powered Auto-Fixing
- 🤖 **Claude Integration** - Automatically invoke Claude to fix complex issues
- 🔧 **Simple Auto-Fixes** - Fix common issues automatically
- 📊 **Health Score** - Get a 0-100 score for your codebase health
- 🎯 **Actionable Recommendations** - Know exactly what to improve

### Developer Experience
- ⚡ **Lightning Fast** - Typically <100ms for health checks
- 🪝 **Git Hooks** - Run automatically on every commit
- 📈 **Trend Tracking** - Monitor health over time (Pro tier)
- 🎨 **Beautiful CLI** - Clear, colorful output

## 📦 Installation

```bash
# Global installation (recommended)
npm install -g @shrimphealth/cli

# Or use with npx (no installation)
npx @shrimphealth/cli check

# Project installation
npm install --save-dev @shrimphealth/cli
```

## 🚀 Quick Start

```bash
# Run health check
shrimp check

# Auto-fix simple issues
shrimp fix

# Invoke Claude for complex fixes (requires Pro)
shrimp fix --claude

# Run in CI/CD
shrimp check --threshold 80 --json
```

## 💰 Pricing

### Free Tier
- ✅ 50 health checks per month
- ✅ Basic detection (bugs, performance, imports)
- ✅ Health score
- ✅ Simple auto-fixes

### Pro - $6/month
- ✅ **Unlimited health checks**
- ✅ **Claude AI auto-fix** - Automatically fix complex issues
- ✅ **All advanced detectors** (WCAG, Next.js, consistency)
- ✅ **Git hooks** integration
- ✅ **Health trends** - Track improvements over time
- ✅ Priority support

### Team - $24/month (up to 5 users)
- ✅ Everything in Pro
- ✅ **Multi-repo support**
- ✅ **Team dashboard**
- ✅ **CI/CD integration**
- ✅ **Shared configuration**
- ✅ Custom rules

[Start Free Trial →](https://shrimphealth.com/pricing)

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

# Use Claude to fix complex issues (Pro only)
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
    npm install -g @shrimphealth/cli
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
- `shrimp_fix` - Auto-fix issues
- `shrimp_status` - Get quick status
- `shrimp_explain` - Explain issue types

## 📈 Health Score

Your health score (0-100) is calculated from:
- Bug severity and count (30%)
- Performance issues (25%)
- Code consistency (20%)
- Import cleanliness (10%)
- Accessibility (10%)
- Framework best practices (5%)

## 🛠️ API Usage

```typescript
import { HealthChecker } from '@shrimphealth/cli';

const checker = new HealthChecker({
  sourceRoot: './src',
  config: { /* ... */ }
});

const result = await checker.run();
console.log(`Health Score: ${result.healthScore}/100`);
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📝 License

MIT License - see [LICENSE](LICENSE)

## 🔗 Links

- [Website](https://shrimphealth.com)
- [Documentation](https://shrimphealth.com/docs)
- [Dashboard](https://shrimphealth.com/dashboard)
- [GitHub](https://github.com/yourusername/shrimp-health)
- [Twitter](https://twitter.com/shrimphealth)

## 💬 Support

- 📧 Email: support@shrimphealth.com
- 💬 Discord: [Join our community](https://discord.gg/shrimphealth)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/shrimp-health/issues)

---

Made with 🦐 by the Shrimp Health team
