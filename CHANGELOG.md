# Changelog

All notable changes to Shrimp Health will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-12

### First Production Release

This is the inaugural release of Shrimp Health - an AI-powered code health monitoring CLI tool designed specifically for Next.js projects and Claude Code users. This release represents a complete transformation from prototype to production-ready quality tool.

### Added

#### Comprehensive Testing Suite (362 New Tests)
- **BugDetectorAST**: 78 tests covering all bug detection patterns
  - Empty catch blocks (5 tests)
  - Async error handling (8 tests)
  - React hooks violations (10 tests)
  - Security vulnerabilities (12 tests)
  - Logic errors (15 tests)
  - Type safety issues (18 tests)
  - Edge cases and error conditions (10 tests)
- **FileWatcher**: 35 tests for real-time monitoring
  - File change detection and debouncing
  - Health score history tracking
  - Memory management and performance
  - Singleton pattern validation
- **CLI Integration**: 37 tests for command-line interface
  - `check` command with various flags
  - `fix` command with dry-run support
  - JSON output formatting
  - Error handling and exit codes
- **Health Check Orchestration**: 27 tests
  - End-to-end health check flow
  - Scoring algorithm validation
  - Configuration handling
- **Performance Detector**: 27 tests
  - Inline object detection in React components
  - Missing memoization patterns
  - Expensive operations in loops
- **WCAG Detector**: 52 tests
  - Missing alt text on images
  - Keyboard accessibility issues
  - ARIA label validation
  - Focus management patterns
- **NextJS Detector**: 37 tests
  - Server/Client component patterns
  - Image optimization checks
  - Font optimization validation
  - Next.js 15 App Router best practices
- **Import Detector**: 31 tests
  - Unused import detection
  - Circular dependency detection
  - Import organization validation
- **Consistency Detector**: 30 tests
  - Naming convention validation
  - Function pattern consistency
  - Error handling patterns
- **Auto-Fixer**: 17 tests (pre-existing, now integrated)
  - Confidence scoring validation
  - Dry-run mode testing
  - Fix application and verification

**Total Test Suite**: 379 tests (17 initial → 379 total) across 11 test files, ~7,300 lines of test code

#### CI/CD Infrastructure
- **GitHub Actions CI Pipeline** (.github/workflows/ci.yml)
  - Matrix testing across Bun versions (1.0.0, 1.1.0, latest)
  - Automated type checking with TypeScript
  - Test execution with coverage enforcement (80% minimum)
  - Coverage reporting to Codecov
  - Self-dogfooding: Shrimp runs health checks on itself (70% threshold)
  - Security audit job for dependency vulnerability scanning
  - MCP server build verification
  - Quality gates summary with fail-fast protection
- **Automated NPM Publishing** (.github/workflows/publish.yml)
  - Version validation between git tags and package.json
  - Pre-publish validation (tests, build, health check)
  - Automatic GitHub release creation
  - NPM package publishing to @shrimphealth/cli
- **Dependabot Configuration** (.github/dependabot.yml)
  - Weekly dependency updates for main package
  - Weekly updates for MCP server dependencies
  - Monthly GitHub Actions updates
  - Automatic PR assignment and labeling
  - Grouped updates for TypeScript, types, and MCP SDK

#### Real-World Validation
- Validated against 5 production Next.js projects:
  - gielinor-gains (personal project)
  - shadcn-ui
  - create-t3-app
  - taxonomy (Next.js example)
  - next-auth
- Performance metrics tracked:
  - Average analysis time: 8.09ms per file (target: <50ms)
  - 100 files analyzed in 809ms
  - Full test suite execution: ~56 seconds for 379 tests
- Real-world issue detection:
  - 537 total issues found across test projects
  - Average 2.50 issues per file
  - 35% warnings, 65% info severity distribution

#### MCP Server Integration
- 8 tools for seamless Claude Code integration:
  - `shrimp_check` - Run comprehensive health checks
  - `shrimp_fix` - Apply auto-fixes with dry-run support
  - `shrimp_status` - Get quick health snapshot with trends
  - `shrimp_explain` - Get detailed explanations of issue types
  - `shrimp_watch_start` - Start real-time file watching
  - `shrimp_watch_stop` - Stop file watching and get statistics
  - `shrimp_get_live_status` - Get cached watcher status (fast)
  - Error handling improvements and better MCP protocol compliance

#### Documentation
- **CLAUDE.md**: Comprehensive development guide
  - Project mission and architecture overview
  - Production readiness roadmap
  - Detector development guide with examples
  - Testing checklist and best practices
  - Common gotchas and technical decisions
  - Dos and Don'ts for development
- **README.md**: Updated with accurate metrics
  - Real performance numbers (8ms per file)
  - Actual test count (379 tests)
  - Precision rate (66%+)
  - Removed inaccurate marketing claims
  - Added "Why Shrimp Health?" section
  - Battle-tested badges and real statistics

### Changed

#### Open Source Transformation
- **Removed all licensing restrictions**: Shrimp Health is now 100% open source (MIT License)
- **Removed Pro/Team tier enforcement**: All features available to everyone
- **Removed remote analytics and telemetry**: No phone-home tracking
- **Removed monetization logic**: License validation code removed or stubbed
- Previous licensing system:
  - Free tier: 50 checks/month, basic detectors
  - Pro tier: $6/mo, unlimited checks, Claude AI, advanced detectors
  - Team tier: $24/mo, Pro + multi-repo, dashboard, CI/CD integration
- Now: All features free, no restrictions, no tracking

#### Precision Improvements (2.1x Better)
- **False positive rate**: Reduced from 71.6% to ~34% (66% precision)
- **Import organization checks disabled**: Style preferences not health issues
  - Eliminated 1,200+ false positives from import sorting
  - Import checks now focus on unused imports and circular dependencies only
- **SVG file handling improved**: Skip magic number detection for SVG files
  - Fixed 1,000+ false positives from binary detection in text-based SVG files
- **Next.js framework exports**: Better detection of framework-provided exports
  - Fixed 50+ false positives for `generateMetadata`, `generateStaticParams`, etc.
  - These are Next.js framework patterns, not dead code
- **Async error handling**: Refined for Next.js App Router patterns
  - Fixed 100+ false positives in async route handlers and server components
  - Better understanding of Next.js error boundaries
- **Performance detector**: Exclude idiomatic .map() patterns
  - Fixed 150+ false positives for standard array operations
  - Focus on actual performance issues (inline objects in render, missing memoization)

#### Scoring Algorithm Refinements
- Bug detection scoring improvements:
  - Better severity classification (critical, warning, info)
  - Cap adjustments to prevent score over-penalization
  - Point deductions: critical=5pts, warning=2pts, info=0.5pts (cap: 20pts)
- Performance scoring:
  - Focused on React-specific issues
  - Point deductions: critical=4pts, moderate=2pts, minor=0.5pts (cap: 15pts)
- Next.js scoring:
  - Framework-aware pattern recognition
  - Point deductions: error=3pts, warning=1pt, info=0.2pts (cap: 15pts)
- Import scoring:
  - Organization checks removed (style, not health)
  - Unused imports: 0.5pts each, circular deps: 2pts each (cap: 10pts)

#### CLI Experience
- **JSON output**: Now clean without progress logs interfering
- **Progress indicators**: Better visual feedback during analysis
- **Error messages**: More actionable and context-aware
- **Exit codes**: Proper failure codes for CI/CD integration

### Fixed

#### Critical Bug Fixes
- **FileWatcher path doubling bug**: Fixed critical issue where file paths were duplicated
  - Caused by incorrect path joining logic
  - Would break watch mode after first file change
  - Now uses proper path resolution
- **JSON output corruption**: Progress logs no longer mix with JSON output
  - Added `--json` flag awareness to logger
  - Ensures clean JSON for CI/CD pipelines
- **Health score edge cases**: Fixed calculation errors at boundary conditions
  - Scores now properly capped at 0-100 range
  - No more negative scores or scores >100

#### Detector Fixes
- **Performance detector**: 9 test failures fixed
  - Inline object detection now respects React patterns
  - Memoization checks account for functional updates
  - Loop performance checks ignore trivial iterations
- **Import detector**: False positive reduction
  - Better TypeScript import resolution
  - Respects barrel file exports
  - Handles dynamic imports correctly
- **Bug detector**: AST parsing edge cases
  - Better error recovery for malformed code
  - Handles TypeScript decorators correctly
  - Supports latest ECMAScript features
- **WCAG detector**: Accessibility pattern recognition
  - Better ARIA attribute validation
  - Recognizes semantic HTML patterns
  - Handles conditional accessibility correctly
- **Next.js detector**: Framework pattern recognition
  - Detects Server/Client component boundaries correctly
  - Respects Next.js 15 conventions
  - Handles App Router patterns properly

### Removed

#### Licensing System
- License validation and enforcement code
- Usage quota tracking and enforcement
- Remote license activation endpoints
- Pro/Team tier feature gating
- License key validation utilities
- Usage analytics and telemetry

#### Unimplemented Features
- References to non-existent pricing pages
- Team dashboard (was never built)
- Multi-repo support (not implemented)
- License management commands from docs

### Performance

- **Average file analysis**: 8.09ms (well under 50ms target)
- **100 file benchmark**: 809ms total
- **Full test suite**: ~56 seconds for 379 tests
- **Memory usage**: Efficient with large codebases (tested on 200+ file projects)
- **MCP server**: Minimal overhead, responds in <100ms for cached queries

### Security

- Dependency security scanning in CI
- No remote data collection or telemetry
- Local-only configuration storage
- No API keys required for core functionality (Claude integration optional)

---

## Development Timeline

- **2025-10-11**: Initial commit - Project scaffolding and core architecture
- **2025-10-11**: Removed emojis, added ASCII art for professional appearance
- **2025-10-11**: Comprehensive testing suite with Bun integration (17 → 230+ tests)
- **2025-10-11**: Added MVP features (file watching, confidence-scored auto-fixing)
- **2025-10-11**: Fixed MCP server bugs and improved error handling
- **2025-10-12**: Production-ready improvements (critical bug fixes, scoring refinements, open source transformation)

---

## Links

- [GitHub Repository](https://github.com/cameronspears/shrimp)
- [NPM Package](https://www.npmjs.com/package/@shrimphealth/cli)
- [Issue Tracker](https://github.com/cameronspears/shrimp/issues)
- [Discussions](https://github.com/cameronspears/shrimp/discussions)

---

## Migration Guide

### From Pre-1.0 (Internal Prototypes)

This is the first public release. No migration needed.

### License Key Holders

All features are now free. License keys are no longer required. Simply update to v1.0.0:

```bash
npm update -g @shrimphealth/cli
```

All previously Pro/Team features (Claude integration, advanced detectors, unlimited checks) are now available to everyone.

---

Made with care by the open source community 🦐
