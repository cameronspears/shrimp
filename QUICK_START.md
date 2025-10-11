# Shrimp MVP - Quick Start Guide

## What We Built

You now have the core "invisible infrastructure" features:

### 1. File Watcher (`src/core/file-watcher.ts`)
Real-time background monitoring that:
- Watches all source files (ts, tsx, js, jsx)
- Runs fast incremental checks (< 50ms)
- Tracks health score with trends
- Stores up to 1000 issues in memory
- Debounces changes (500ms)

**Usage:**
```typescript
import { FileWatcher } from './src/core/file-watcher';

const watcher = new FileWatcher('.');
await watcher.start(); // Begins monitoring

const status = watcher.getStatus();
// {
//   isRunning: true,
//   healthScore: 89,
//   trend: 'improving',
//   issueCount: 23,
//   ...
// }

await watcher.stop();
```

### 2. Confidence Scoring (`src/core/auto-fixer.ts`)
Auto-fixer with trust levels:
- **99%+**: Always safe (removes unused imports, console.log)
- **90-98%**: Safe with review (adds inferred alt text)
- **80-89%**: Ask first (complex refactoring)
- **<80%**: Manual only (architectural changes)

**Usage:**
```typescript
import { AutoFixer } from './src/core/auto-fixer';

const fixer = new AutoFixer(false, 95); // Apply fixes >= 95% confidence
const results = await fixer.fixAll(issues);

results.forEach(result => {
  console.log(`Fixed ${result.fixesApplied} issues in ${result.file}`);
  console.log(`Always safe: ${result.summary.alwaysSafe}`);
  console.log(`Safe with review: ${result.summary.safeWithReview}`);
});
```

### 3. Working MCP Server (`mcp-server/`)
Claude Code can already use:
- ✅ `shrimp_check` - Run full health check
- ✅ `shrimp_fix` - Auto-fix issues
- ✅ `shrimp_status` - Get current status
- ✅ `shrimp_explain` - Explain issue types

### 4. What's Next (To Complete MVP)

Add 3 more MCP tools to make Claude Code proactive:
- `shrimp_watch_start` - Start background monitoring
- `shrimp_watch_stop` - Stop monitoring
- `shrimp_get_live_status` - Get real-time health

---

## Testing the Current Build

### 1. Build the Project
```bash
bun run build
```

### 2. Test File Watcher Directly
Create `test-watcher.ts`:
```typescript
import { FileWatcher } from './src/core/file-watcher';

async function test() {
  const watcher = new FileWatcher('.');

  console.log('Starting watcher...');
  await watcher.start();

  // Wait 30 seconds
  await new Promise(resolve => setTimeout(resolve, 30000));

  const status = watcher.getStatus();
  console.log('Status:', JSON.stringify(status, null, 2));

  await watcher.stop();
}

test();
```

Run: `bun run test-watcher.ts`

### 3. Test via MCP Server
```bash
cd mcp-server
npm run build
node build/index.js
```

Then in another terminal (or via Claude Code):
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "shrimp_check",
    "arguments": {}
  }
}
```

---

## The Vision (How It Will Work)

### Scenario 1: Claude Opens Project
```
User opens project in Claude Code
  ↓
Claude automatically calls shrimp_watch_start
  ↓
Shrimp starts monitoring files in background
  ↓
Claude: "Watching 234 files. Health: 89/100 ↑"
```

### Scenario 2: User Makes Changes
```
User edits Auth.tsx, adds unused import
  ↓
File watcher detects change after 500ms
  ↓
Incremental check finds issue (< 50ms)
  ↓
Health drops 89 → 88
  ↓
Claude checks shrimp_get_live_status
  ↓
Claude: "Noticed health dropped 1 point. You have 1 unused import.
         Want me to fix it?" (Confidence: 99%)
```

### Scenario 3: Before Committing
```
User: "Commit these changes"
  ↓
Claude calls shrimp_get_live_status
  ↓
Sees health dropped 89 → 82
  ↓
Claude: "Health dropped 7 points. Let me fix these first:
         - 2 unused imports (Confidence: 99%)
         - 1 missing alt text (Confidence: 92%)

         Fixing... Done! Health: 89/100. Ready to commit."
```

---

## Architecture

```
┌─────────────────────────────────────┐
│       Claude Code (Client)           │
│  ┌────────────────────────────────┐ │
│  │  MCP Client                     │ │
│  │  - Calls shrimp tools           │ │
│  │  - Gets live status             │ │
│  │  - Triggers auto-fixes          │ │
│  └────────────────────────────────┘ │
└───────────────┬─────────────────────┘
                │ MCP Protocol
┌───────────────┴─────────────────────┐
│    Shrimp MCP Server                 │
│  ┌────────────────────────────────┐ │
│  │  7 Tools:                       │ │
│  │  1. shrimp_check                │ │
│  │  2. shrimp_fix                  │ │
│  │  3. shrimp_status               │ │
│  │  4. shrimp_explain              │ │
│  │  5. shrimp_watch_start      NEW │ │
│  │  6. shrimp_watch_stop       NEW │ │
│  │  7. shrimp_get_live_status  NEW │ │
│  └────────────────────────────────┘ │
│                ↕                     │
│  ┌────────────────────────────────┐ │
│  │  FileWatcher (singleton)        │ │
│  │  - Chokidar file watching       │ │
│  │  - 500ms debounce               │ │
│  │  - Incremental checks           │ │
│  │  - Health scoring               │ │
│  └────────────────────────────────┘ │
│                ↕                     │
│  ┌────────────────────────────────┐ │
│  │  Auto-Fixer                     │ │
│  │  - Confidence scoring           │ │
│  │  - Safe auto-fixes              │ │
│  │  - Revertible changes           │ │
│  └────────────────────────────────┘ │
│                ↕                     │
│  ┌────────────────────────────────┐ │
│  │  Detectors                      │ │
│  │  - Bugs, Performance            │ │
│  │  - Imports, WCAG                │ │
│  │  - Next.js, Consistency         │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## Next Steps to Complete MVP

1. **Add 3 New MCP Tools** (30 minutes)
   - Implement shrimp_watch_start
   - Implement shrimp_watch_stop
   - Implement shrimp_get_live_status

2. **Test End-to-End** (15 minutes)
   - Start watcher
   - Make file changes
   - Verify live status updates
   - Test auto-fixing
   - Stop watcher

3. **Polish & Document** (15 minutes)
   - Add error handling
   - Write usage docs
   - Create demo video
   - Update README

**Total time to MVP: ~1 hour**

---

## Dependencies Installed

```json
{
  "chokidar": "^4.0.3",  // File watching
  "chalk": "^5.3.0",     // Terminal colors
  "commander": "^12.0.0", // CLI framework
  "ora": "^8.0.1",       // Spinners
  "boxen": "^7.1.1",     // Terminal boxes
  "conf": "^12.0.0"      // Config management
}
```

---

## Key Files

- `src/core/file-watcher.ts` - Real-time monitoring ✅
- `src/core/auto-fixer.ts` - Confidence-scored fixes ✅
- `src/core/health-analyzer.ts` - Detector orchestration ✅
- `src/detectors/` - Issue detection (6 detectors) ✅
- `mcp-server/src/index.ts` - MCP integration ⏳ (needs 3 tools)

---

## The Spellcheck Experience

When complete, Shrimp will be like spellcheck for code:

1. **Always watching** - Runs in background automatically
2. **Instant feedback** - Shows health changes in real-time
3. **Auto-fixes silently** - High confidence issues fixed without asking
4. **Learns project patterns** - Adapts confidence based on your code
5. **Never gets in the way** - Claude mentions it only when helpful
6. **Builds trust** - Conservative fixes that you can always revert

Users should barely know Shrimp exists - it just works.

---

Ready to finish the MVP! 🦐