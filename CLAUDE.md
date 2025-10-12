# CLAUDE.md

**Project Mission:** Quality control copilot for Claude Code users. Helps vibe coders maintain Next.js 15+ App Router best practices, Vercel deployment standards, WCAG 2.0 compliance, and code quality without manual cleanup.

## What This Tool Does

Shrimp Health is **NOT** a general-purpose linter competing with ESLint. It's a **Claude Code companion** that catches the specific issues Claude Code users face when building with AI:

**Core Value Proposition:**
- Next.js 15+ App Router patterns (Server Components, streaming, proper data fetching)
- Vercel deployment best practices (ISR, edge functions, middleware)
- WCAG 2.0 accessibility compliance (real issues, not noise)
- Code quality issues Claude tends to miss (empty catch blocks, missing error handling, performance anti-patterns)
- Consistency across AI-generated code

## Architecture Overview

### Entry Points
- `bin/shrimp.js` - CLI (Commander.js)
- `src/index.ts` - Programmatic API (ShrimpHealth class)
- `mcp-server/src/index.ts` - MCP server for Claude Code integration

### Core Flow
```
ShrimpHealth.check()
  → CodebaseMaintenance.run()
    → ShrimpChecks.analyzeCodebaseHealth()
      → Run all detectors in parallel
      → Aggregate results
      → Calculate 0-100 health score
```

### Detectors (src/detectors/)

All detectors follow the same pattern:
- `analyze(file, content)` → returns issues array
- `getSeverityCount()` → returns {error, warning, info}
- `getIssues()` → returns all issues
- Issues are aggregated and scored in src/core/health-check.ts

**Available Detectors:**
1. **bug-detector-ast.ts** - AST-based bug detection (empty catch, async errors, React hooks violations)
2. **performance-detector.ts** - React performance issues (inline objects, missing memoization)
3. **import-detector.ts** - Unused imports, circular deps, organization
4. **consistency-detector.ts** - Naming conventions, patterns
5. **nextjs-detector.ts** - Next.js 15 best practices (Server/Client components, Image/Font optimization)
6. **wcag-detector.ts** - WCAG 2.0 compliance (alt text, keyboard nav, ARIA)

### Health Score Calculation

Starts at 100, deducts points per issue type:
- Bugs: critical=5pts, warning=2pts, info=0.5pts (cap: 20)
- Performance: critical=4pts, moderate=2pts, minor=0.5pts (cap: 15)
- Next.js: error=3pts, warning=1pt, info=0.2pts (cap: 15)
- Consistency: 1pt per 3 issues (cap: 10)
- Imports: unused=0.5pts, organization=0.3pts (cap: 10)
- Traditional checks (large files, complexity): various caps

See src/core/health-analyzer.ts for full scoring logic.

### Auto-Fix System (src/core/auto-fixer.ts)

Confidence-scored fixes (0.0-1.0):
- **99%+**: Always safe (unused imports, empty aria-label removal)
- **90-98%**: Safe with review (empty catch comments, tabIndex fixes)
- **80-89%**: Needs confirmation (missing alt text placeholders)
- **<80%**: Manual only (complex refactors)

Constructor: `new AutoFixer(dryRun: boolean, minConfidence: number)`
- Set `dryRun=true` for preview mode
- Set `minConfidence` threshold (90+ recommended for production)

### File Watching (src/core/file-watcher.ts)

Real-time monitoring via chokidar:
- Debounced checks (500ms default)
- Maintains health score history
- Lightweight pattern matching (no full AST parse)
- Memory-limited issue tracking (max 1000 issues)
- Singleton pattern for MCP integration

### MCP Server (mcp-server/)

8 tools for Claude Code integration:
- `shrimp_check` - Run health checks
- `shrimp_fix` - Auto-fix with dry-run support
- `shrimp_status` - Quick health snapshot
- `shrimp_explain` - Explain issue types
- `shrimp_watch_start` - Start file watching
- `shrimp_watch_stop` - Stop watching
- `shrimp_get_live_status` - Get cached watcher status

## Production Readiness Roadmap

### Current Status: **Prototype** (Week 0)

**Completed:**
- [X] Core architecture
- [X] 6 detectors (bug, performance, import, consistency, Next.js, WCAG)
- [X] Auto-fixer with confidence scoring
- [X] File watcher for real-time monitoring
- [X] MCP server integration
- [X] Auto-fixer tests (17 tests)

**In Progress:**
- [ ] Test coverage (17 tests → 300+ tests target)
- [ ] False positive validation
- [ ] CI/CD pipeline

### Week 1-2: Test Foundation
**Priority: BugDetectorAST tests (this is the core value)**

- [ ] 50 tests for BugDetectorAST (empty catch, async errors, hooks, security, logic errors, type safety)
- [ ] 25 tests for PerformanceDetector
- [ ] 30 tests for WCAGDetector
- [ ] 25 tests for NextJSDetector
- [ ] 20 tests for ImportDetector
- [ ] 20 tests for ConsistencyDetector
- [ ] 25 tests for FileWatcher
- [ ] 20 tests for CLI commands (integration tests)
- [ ] 15 tests for health scoring logic

**Target: 230+ tests by end of Week 2**

### Week 3-4: Validation & CI

- [ ] Run against 10 real Next.js 15 projects
- [ ] Measure false positive rates (target: <10%)
- [ ] GitHub Actions CI/CD with coverage enforcement (80%+)
- [ ] Performance benchmarks (target: <50ms per file)
- [ ] Self-dogfooding (run Shrimp on itself in CI)

### Week 5-6: Polish & Launch

- [ ] Fix top 10 false positive patterns
- [ ] Improve error messages and UX
- [ ] Complete API documentation
- [ ] Simplify or remove licensing system
- [ ] Publish to npm as shrimp-health
- [ ] Create launch materials (demo video, docs site)

## Development Commands

### Build & Dev
```bash
bun run build        # Build TypeScript to dist/
bun run dev          # Watch mode
cd mcp-server && bun install && bun run build  # Build MCP server
```

### Testing
```bash
bun test             # Run all tests
bun test:unit        # Unit tests only
bun test:integration # Integration tests only
bun test:watch       # Watch mode
bun test --coverage  # With coverage report
```

### CLI Usage
```bash
./bin/shrimp.js check              # Health check
./bin/shrimp.js fix                # Auto-fix (simple)
./bin/shrimp.js fix --claude       # Auto-fix with Claude AI (Pro)
./bin/shrimp.js check --threshold 85  # With threshold
./bin/shrimp.js check --json       # JSON output
```

## Dos & Don'ts for Claude Code

### DO

1. **Write comprehensive tests** - We need 300+ tests to be production-ready. Always write tests for new detectors or bug fixes.

2. **Focus on high-signal issues** - Only flag things that Claude Code users will actually want to fix. We're not ESLint.

3. **Validate against real Next.js projects** - Test detectors against real repos, not just synthetic examples.

4. **Optimize for false positives, not false negatives** - It's better to miss some issues than to flag too much noise. Precision > Recall.

5. **Use confidence scoring for auto-fixes** - Never auto-fix with <90% confidence without user approval.

6. **Respect the file filtering** - Always use `shouldIgnoreFile()` to skip node_modules, .next, dist, test files, and Shrimp's own source.

7. **Maintain AST-based detection** - Use `@typescript-eslint/typescript-estree` for accurate pattern matching, not just regex.

8. **Dogfood the tool** - Run Shrimp on itself. If we flag our own code incorrectly, that's a bug.

9. **Keep scoring transparent** - Health score should be explainable. Document penalty values clearly.

10. **Test for performance** - Every detector should run in <50ms on typical files. Profile and optimize.

### DON'T

1. **Don't add generic linting rules** - We're not ESLint. Only add checks that help Claude Code users with Next.js/Vercel/WCAG.

2. **Don't flag style preferences** - No tabs vs spaces, no semicolon debates. Focus on correctness and best practices.

3. **Don't parse files we shouldn't analyze** - Respect `shouldIgnoreFile()`. Never analyze node_modules, .next, dist, .git.

4. **Don't create tests without running them** - Always verify tests pass before committing.

5. **Don't tune scores to be artificially high** - Health scores should reflect reality. Don't add "reduced penalty" hacks to make projects look better.

6. **Don't auto-fix without confidence** - If you can't give a fix 90%+ confidence, don't do it automatically.

7. **Don't add features without tests** - No new detectors, no new fixes, nothing without comprehensive test coverage.

8. **Don't ignore performance** - We claim "<100ms typically" - make that real. Profile everything.

9. **Don't break the MCP server** - The MCP integration is a key differentiator. Test it works with Claude Code.

10. **Don't document features that don't exist** - README references pricing pages, dashboards, etc. that aren't built. Fix or remove.

## Detector Development Guide

### Adding a New Detector

1. Create `src/detectors/new-detector.ts`:
```typescript
export class NewDetector {
  private issues: Issue[] = [];

  async analyze(file: string, content: string): Promise<Issue[]> {
    // Parse with AST if needed
    const ast = parseTypeScript(content);

    // Detect issues
    // ...

    return this.issues;
  }

  getSeverityCount() {
    return {
      error: this.issues.filter(i => i.severity === 'error').length,
      warning: this.issues.filter(i => i.severity === 'warning').length,
      info: this.issues.filter(i => i.severity === 'info').length,
    };
  }
}
```

2. Add to `ShrimpChecks` (src/core/health-analyzer.ts):
```typescript
async checkNewFeature(): Promise<number> {
  const detector = new NewDetector();
  // ... run detector
  return Math.min(deduction, CAP);
}
```

3. Call from `analyzeCodebaseHealth()` in src/core/health-check.ts

4. Write 20+ tests in `tests/unit/new-detector.test.ts`

5. Add to `shouldIgnoreFile()` if detector analyzes itself

### Detector Testing Checklist

For every detector, test:
- [X] True positives (finds real issues)
- [X] True negatives (doesn't flag correct code)
- [X] False positive cases (common patterns that look wrong but aren't)
- [X] Edge cases (empty files, malformed syntax, etc.)
- [X] Performance (should handle 1000+ line files quickly)
- [X] Severity accuracy (is "error" really an error?)

## File Structure Reference

```
shrimp-health/
├── bin/
│   └── shrimp.js           # CLI entry point
├── src/
│   ├── core/
│   │   ├── auto-fixer.ts       # Confidence-scored fixes
│   │   ├── file-watcher.ts     # Real-time monitoring
│   │   ├── health-analyzer.ts  # ShrimpChecks orchestration
│   │   └── health-check.ts     # CodebaseMaintenance
│   ├── detectors/
│   │   ├── bug-detector-ast.ts     # AST-based bug detection
│   │   ├── consistency-detector.ts # Naming, patterns
│   │   ├── import-detector.ts      # Unused imports, circular deps
│   │   ├── nextjs-detector.ts      # Next.js 15 best practices
│   │   ├── performance-detector.ts # React performance
│   │   └── wcag-detector.ts        # WCAG 2.0 compliance
│   ├── integrations/
│   │   └── claude-integration.ts # Claude API for complex fixes
│   ├── licensing/
│   │   ├── license-validator.ts  # License checks (needs work)
│   │   └── usage-tracker.ts      # Usage stats
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── utils/
│   │   ├── ast-parser.ts       # AST parsing utilities
│   │   └── logger.ts           # Structured logging
│   └── index.ts                # Public API
├── tests/
│   ├── unit/
│   │   ├── auto-fixer.test.ts       # [X] 17 tests
│   │   └── bug-detector-ast.test.ts # [X] 1 test
│   └── integration/
│       └── real-world.test.ts       # [X] 1 test (gielinor-gains)
├── mcp-server/              # MCP server for Claude Code
│   ├── src/
│   │   └── index.ts         # 8 MCP tools
│   ├── README.md
│   └── SETUP.md
├── README.md                # User-facing docs
├── CLAUDE.md               # This file
└── package.json
```

## Configuration

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
  "ignore": ["node_modules", "dist", ".next", "*.test.ts"],
  "thresholds": {
    "minimum": 80,
    "target": 95
  },
  "autofix": {
    "enabled": true,
    "minConfidence": 90
  }
}
```

## Key Technical Decisions

### Why AST-based detection?
Regex-based detection has too many false positives. AST parsing with `@typescript-eslint/typescript-estree` gives us accurate pattern matching at acceptable performance cost.

### Why confidence scoring for fixes?
Auto-fixing is dangerous. Confidence scores let users control risk tolerance. 99%+ confidence fixes are safe to run automatically. Lower confidence fixes need review.

### Why file watching?
Claude Code users iterate quickly. Real-time feedback (via MCP) helps them catch issues as they code, not after.

### Why not use ESLint under the hood?
ESLint is too general-purpose and too noisy. We need focused detection on Next.js 15 + Vercel + WCAG issues that Claude Code users actually face.

### Why MCP integration?
This is the killer feature. Claude Code users can say "check my code quality" and Shrimp runs automatically. Seamless AI-assisted development.

## Common Gotchas

1. **ESM Imports** - Always use `.js` extensions even for `.ts` files:
   ```typescript
   import { foo } from './foo.js';  // Correct
   import { foo } from './foo';     // Wrong
   ```

2. **Self-Analysis** - Shrimp ignores its own files. When testing locally, `shouldIgnoreFile()` must be properly configured.

3. **License Checks** - Most features check licenses. Free tier is 50 checks/month. This needs to be simplified or removed.

4. **Detector Performance** - Each detector is limited to ~20-30 files for speed. Must scale this for production.

5. **MCP Server Path** - MCP server uses relative paths to find the CLI. Don't break the structure: `mcp-server/build/index.js` → `../../bin/shrimp.js`

## Monitoring & Metrics

**Track these metrics as we build:**
- Test coverage (target: 80%+)
- False positive rate (target: <10%)
- Performance per file (target: <50ms)
- Health score distribution (real projects should average 70-85, not 95+)
- Issue detection counts by category
- Auto-fix success rate

## Next Steps (Priority Order)

1. **Build BugDetectorAST test suite** (50 tests) - This is the core value prop
2. **Add tests for other detectors** (100 tests total)
3. **Set up CI/CD** with coverage enforcement
4. **Validate against 10 real Next.js projects** - Measure false positives
5. **Performance optimization** - Hit <50ms per file target
6. **Simplify or remove licensing** - It's currently half-baked
7. **Polish UX** - Better errors, progress indicators
8. **Publish to npm** - shrimp-health

---

**Remember:** We're building a quality copilot for Claude Code users, not a general-purpose linter. Every feature should serve that mission.
