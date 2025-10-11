# Shrimp MVP Implementation Status

## Completed Features

### 1. File Watcher Mode (DONE)
**File:** `src/core/file-watcher.ts`

**Features:**
- Real-time file change monitoring with chokidar
- 500ms debouncing after last change
- Incremental health checks (< 50ms target per check)
- Memory-efficient issue storage (max 1000 issues)
- Health score tracking with trend calculation
- Singleton pattern for MCP server access

**Key Methods:**
- `start()` - Begin watching files
- `stop()` - Stop watching
- `getStatus()` - Get current watcher status
- `getAllIssues()` - Get all detected issues

**Performance:**
- Initial check: Full health analysis on startup
- Incremental checks: Fast pattern matching only
- Memory limit: 1000 issues max, sorted by severity

---

### 2. Confidence Scoring System (DONE)
**File:** `src/core/auto-fixer.ts`

**Interfaces:**
```typescript
interface FixWithConfidence {
  newContent: string;
  description: string;
  confidence: number; // 0-100
  reason: string;
  canRevert: boolean;
}

interface AutoFixResult {
  file: string;
  fixesApplied: number;
  changes: FixWithConfidence[];
  summary: {
    alwaysSafe: number; // 99+ confidence
    safeWithReview: number; // 90-98 confidence
    needsConfirmation: number; // 80-89 confidence
    manualOnly: number; // <80 confidence
  };
}
```

**Confidence Levels:**
- **99%+**: Always safe (unused imports, console.log, empty alt="")
- **90-98%**: Safe with review (inferred alt text, organize imports, empty catch comments)
- **80-89%**: Needs confirmation (complex refactoring, extract inline objects)
- **<80%**: Manual only (architectural changes, logic modifications)

---

## Remaining MVP Tasks

### 3. Enhanced MCP Tools (IN PROGRESS)

Need to add 3 new tools to `mcp-server/src/index.ts`:

#### `shrimp_watch_start`
**Purpose:** Start background file watching
**Parameters:**
- `path` (optional): Directory to watch
**Returns:**
```json
{
  "success": true,
  "message": "File watcher started",
  "filesWatched": 234,
  "initialHealth": 89
}
```

**Claude Code Usage:**
```typescript
// When user opens a project
await mcp.call('shrimp_watch_start');
// Now Claude knows health in real-time
```

#### `shrimp_watch_stop`
**Purpose:** Stop background watching
**Returns:**
```json
{
  "success": true,
  "message": "File watcher stopped",
  "finalHealth": 91,
  "checksPerformed": 47
}
```

#### `shrimp_get_live_status`
**Purpose:** Get real-time health from watcher (no re-scan)
**Parameters:**
- `includeIssues` (optional): Include top 10 issues
**Returns:**
```json
{
  "isRunning": true,
  "healthScore": 89,
  "previousScore": 87,
  "trend": "improving",
  "issueCount": 23,
  "topIssues": [
    {
      "file": "src/components/Auth.tsx",
      "line": 45,
      "category": "Unused Imports",
      "message": "Unused import 'useState'",
      "severity": "warning"
    }
  ],
  "lastCheckTime": 1234567890,
  "filesWatched": 234,
  "checksPerformed": 12
}
```

**Claude Code Usage:**
```typescript
// Before making changes
const before = await mcp.call('shrimp_get_live_status');

// ... Claude makes changes ...

// After making changes
const after = await mcp.call('shrimp_get_live_status');

if (after.healthScore < before.healthScore) {
  // Proactively notify user
  console.log(`Health dropped from ${before.healthScore} to ${after.healthScore}`);
}
```

---

## Implementation Steps

### Step 1: Update MCP Server (Next)

Add to `mcp-server/src/index.ts`:

```typescript
// At top of file
import { FileWatcher, getWatcherInstance, setWatcherInstance } from '../../src/core/file-watcher.js';

// Add schemas
const WatchStartSchema = z.object({
  path: z.string().optional(),
});

const WatchStopSchema = z.object({});

const GetLiveStatusSchema = z.object({
  includeIssues: z.boolean().optional(),
});

// Add to tools array in ListToolsRequestSchema
{
  name: 'shrimp_watch_start',
  description: 'Start background file watching for real-time health monitoring',
  inputSchema: { ... }
},
{
  name: 'shrimp_watch_stop',
  description: 'Stop background file watching',
  inputSchema: { ... }
},
{
  name: 'shrimp_get_live_status',
  description: 'Get real-time health status from file watcher',
  inputSchema: { ... }
}

// Add handlers in CallToolRequestSchema switch
case 'shrimp_watch_start': { ... }
case 'shrimp_watch_stop': { ... }
case 'shrimp_get_live_status': { ... }
```

### Step 2: Test End-to-End (Final)

Test the complete workflow:

1. Start MCP server
2. Call `shrimp_watch_start`
3. Change a file (add unused import)
4. Call `shrimp_get_live_status` - should show health drop
5. Call `shrimp_fix` with confidence=99
6. Call `shrimp_get_live_status` - should show health improve
7. Call `shrimp_watch_stop`

---

## The "Invisible Infrastructure" Experience

### User Opens Project in Claude Code

```
Claude Code: *[Automatically calls shrimp_watch_start]*
Shrimp: "Watching 234 files. Initial health: 89/100"
```

### User Asks Claude to Refactor

```
User: "Refactor the auth module"

Claude Code: *[Checks shrimp_get_live_status]*
Claude: "I see the auth module currently has health 75/100 with
5 unused imports and 2 empty catch blocks. I'll fix those as part
of the refactor."

*[Claude makes changes]*

Claude Code: *[Watches shrimp_get_live_status change 75→82]*
Claude: "Health improved to 82/100 after refactoring."
```

### Health Drops During Editing

```
*[User adds bad code]*

Claude Code: *[Detects shrimp_get_live_status dropped 89→84]*
Claude: "Wait - health just dropped 5 points. I notice you added
2 unused imports. Want me to clean those up?"
```

### Before Committing

```
User: "Commit these changes"

Claude Code: *[Checks shrimp_get_live_status]*
Claude: "Hold on - health dropped from 89→82. Let me fix these
issues first:
- 2 unused imports
- 1 missing alt text
*[Calls shrimp_fix with confidence=95]*
Done! Health back to 89/100. Ready to commit."
```

---

## Success Metrics

When this is done, users should be able to:

1. Open a project and have Shrimp start automatically ✅
2. See Claude proactively suggest fixes during conversations ⏳
3. Have health monitored in real-time without explicit checks ⏳
4. Get auto-fixes with confidence scores ✅
5. Trust that Shrimp works in the background ✅

---

## Next Actions

1. ✅ File watcher implementation
2. ✅ Confidence scoring infrastructure
3. ⏳ Add 3 new MCP tools (IN PROGRESS)
4. ⏳ Test end-to-end workflow
5. ⏳ Polish error handling
6. ⏳ Add CLI commands for manual testing

Then we launch! 🚀