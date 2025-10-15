# GitHub Actions Workflows

This directory contains automated workflows for Shrimp Health.

## Workflows

### `ci.yml` - Continuous Integration
**Trigger:** Push to any branch, pull requests

**What it does:**
- Runs all 406 tests across multiple Bun versions
- Enforces 84.56% code coverage minimum
- Runs Shrimp on itself (dogfooding with 95.8/100 health score)
- Uploads coverage reports

### `publish.yml` - Automated Publishing
**Trigger:** Git tags matching `v*` (e.g., v1.0.0)

**What it does:**
- Validates release by running all tests
- Builds the project
- Publishes to npm registry (requires NPM_TOKEN secret)

**Setup:**
1. Create npm token: https://www.npmjs.com/settings/tokens
2. Add to GitHub secrets: NPM_TOKEN

### `dependabot-auto-merge.yml` - Automated Dependency Updates
**Trigger:** Dependabot PRs

**What it does:**
- [OK] Auto-approves and merges: security updates, dev deps, patch/minor versions
- [WARN] Flags major version updates for manual review
- [AUTO] Fully automated - no manual intervention needed!

**Safe update criteria:**
- Security updates (always merge)
- Dev dependencies: @types/*, eslint, prettier, typescript
- Patch updates: 1.2.3 → 1.2.4
- Minor updates: 1.2.0 → 1.3.0

**Manual review required:**
- Major updates: 1.x.x → 2.x.x (breaking changes)

## Configuration

### Dependabot
Configuration: `.github/dependabot.yml`
- Runs monthly (1st Monday at 9am)
- Max 5 PRs for main dependencies
- Max 3 PRs for MCP server
- Automatically merged by `dependabot-auto-merge.yml`

## Secrets Required

- `NPM_TOKEN` - For automated npm publishing
- `GITHUB_TOKEN` - Automatically provided by GitHub

## Testing Locally

```bash
# Install act (GitHub Actions runner)
brew install act

# Run CI workflow locally
act -j test

# Run with specific Bun version
act -j test -s BUN_VERSION=latest
```
