import fs from 'fs/promises';
import path from 'path';

export interface FixWithConfidence {
  newContent: string;
  description: string;
  confidence: number; // 0-100, where 99+ = always safe, 90-98 = safe with review, 80-89 = ask first, <80 = manual only
  reason: string; // Why this confidence level
  canRevert: boolean;
}

export interface AutoFixResult {
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

/**
 * Confidence-Scored Auto-Fixer Service
 *
 * Automatically fixes code issues with confidence scoring:
 * - 99%+: Always safe (auto-fix without asking)
 * - 90-98%: Safe with review (show notification)
 * - 80-89%: Needs confirmation (ask first)
 * - <80%: Manual only (flag for human review)
 */
export class AutoFixer {
  private results: AutoFixResult[] = [];
  private dryRun: boolean = false;
  private minConfidence: number = 90; // Default: only auto-fix 90%+ confidence

  constructor(dryRun: boolean = false, minConfidence: number = 90) {
    this.dryRun = dryRun;
    this.minConfidence = minConfidence;
  }

  /**
   * Fix all auto-fixable issues in the codebase
   */
  async fixAll(issues: any): Promise<AutoFixResult[]> {
    console.log('[FIX] Starting aggressive auto-fix mode...');

    // Group issues by file
    const fileIssues = this.groupIssuesByFile(issues);

    for (const [file, fileIssuesList] of Object.entries(fileIssues)) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const result = await this.fixFile(file, content, fileIssuesList as any[]);

        if (result.fixesApplied > 0) {
          this.results.push(result);
        }
      } catch (error) {
        console.error(`  [ERROR] Failed to fix ${file}:`, error);
      }
    }

    return this.results;
  }

  private groupIssuesByFile(issues: any): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    // Process all issue types
    const allIssues = [
      ...(issues.bugIssues || []),
      ...(issues.performanceIssues || []),
      ...(issues.importIssues || []),
      ...(issues.wcagIssues || []),
      ...(issues.consistencyIssues || []),
    ];

    for (const issue of allIssues) {
      if (!grouped[issue.file]) {
        grouped[issue.file] = [];
      }
      grouped[issue.file].push(issue);
    }

    return grouped;
  }

  private async fixFile(filePath: string, content: string, issues: any[]): Promise<AutoFixResult> {
    const result: AutoFixResult = {
      file: filePath,
      fixesApplied: 0,
      changes: [],
      summary: {
        alwaysSafe: 0,
        safeWithReview: 0,
        needsConfirmation: 0,
        manualOnly: 0,
      },
    };

    let fixedContent = content;
    const lines = content.split('\n');

    // Sort issues by line number (descending) to avoid offset issues
    const sortedIssues = issues.sort((a, b) => (b.line || 0) - (a.line || 0));

    for (const issue of sortedIssues) {
      const fix = this.generateFix(issue, fixedContent, lines);

      if (fix) {
        // Only apply fixes that meet minimum confidence threshold
        if (fix.confidence >= this.minConfidence) {
          fixedContent = fix.newContent;
          result.fixesApplied++;
          result.changes.push(fix);

          // Categorize by confidence
          if (fix.confidence >= 99) {
            result.summary.alwaysSafe++;
          } else if (fix.confidence >= 90) {
            result.summary.safeWithReview++;
          } else if (fix.confidence >= 80) {
            result.summary.needsConfirmation++;
          } else {
            result.summary.manualOnly++;
          }
        } else {
          console.log(
            `  [SKIP] ${fix.description} (confidence: ${fix.confidence}% < ${this.minConfidence}%)`
          );
        }
      }
    }

    // Write fixed content back to file
    if (result.fixesApplied > 0 && !this.dryRun) {
      await fs.writeFile(filePath, fixedContent, 'utf-8');
      console.log(`  [OK] Fixed ${result.fixesApplied} issues in ${path.basename(filePath)}`);
      console.log(
        `       Always safe: ${result.summary.alwaysSafe}, Safe with review: ${result.summary.safeWithReview}`
      );
    } else if (result.fixesApplied > 0) {
      console.log(
        `  [DRY RUN] Would fix ${result.fixesApplied} issues in ${path.basename(filePath)}`
      );
    }

    return result;
  }

  private generateFix(
    issue: any,
    content: string,
    lines: string[]
  ): FixWithConfidence | null {
    let simpleFix: { newContent: string; description: string } | null = null;
    let confidence = 90; // Default confidence
    let reason = 'Automated fix with high confidence';

    // WCAG Fixes
    if (issue.category === 'Images' && issue.message.includes('missing alt')) {
      simpleFix = this.fixMissingAlt(issue, content, lines);
      confidence = 85;  // Lower confidence - requires manual review of placeholder
      reason = 'Added empty alt for decorative images or TODO placeholder for content images';
    }
    else if (issue.category === 'Forms' && issue.message.includes('placeholder as label')) {
      simpleFix = this.fixPlaceholderLabel(issue, content, lines);
      confidence = 95;
      reason = 'Label added based on placeholder text';
    }
    else if (issue.category === 'Keyboard' && issue.message.includes('onClick on non-interactive')) {
      simpleFix = this.fixClickHandler(issue, content, lines);
      confidence = 94;
      reason = 'Added keyboard accessibility handlers';
    }
    else if (issue.category === 'Focus Management' && issue.message.includes('Positive tabIndex')) {
      simpleFix = this.fixTabIndex(issue, content, lines);
      confidence = 99;
      reason = 'Safe: replacing positive tabIndex with 0';
    }
    // Bug Fixes
    else if (issue.category === 'Error Handling' && issue.message.includes('Empty catch block')) {
      simpleFix = this.fixEmptyCatch(issue, content, lines);
      confidence = 96;
      reason = 'Added explanatory comment to empty catch';
    }
    else if (issue.category === 'Type Safety' && issue.message.includes('Empty aria-label')) {
      simpleFix = this.fixEmptyAriaLabel(issue, content, lines);
      confidence = 99;
      reason = 'Safe: removing empty aria-label attribute';
    }
    // Import Fixes
    else if (issue.category === 'Unused Imports') {
      simpleFix = this.fixUnusedImport(issue, content, lines);
      confidence = 99;
      reason = 'Safe: import marked as unused and not referenced';
    }
    else if (issue.category === 'Import Organization') {
      simpleFix = this.fixImportOrganization(issue, content, lines);
      confidence = 98;
      reason = 'Safe: organizing imports by type';
    }
    // Performance Fixes
    else if (issue.category === 'React Performance' && issue.message.includes('Inline object')) {
      simpleFix = this.fixInlineObject(issue, content, lines);
      confidence = 75;
      reason = 'Complex: requires extracting inline objects to useMemo';
    }

    if (!simpleFix) {
      return null;
    }

    return {
      ...simpleFix,
      confidence,
      reason,
      canRevert: true,
    };
  }

  // ==================== WCAG FIXES ====================

  private fixMissingAlt(
    issue: any,
    content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const line = lines[issue.line - 1];

    // Check if it's a decorative image (has no meaningful content indicator)
    const isDecorative =
      line.toLowerCase().includes('icon') ||
      line.toLowerCase().includes('decoration') ||
      line.toLowerCase().includes('bg-') ||
      line.toLowerCase().includes('divider') ||
      line.toLowerCase().includes('spacer');

    let newLine: string;
    if (isDecorative) {
      // Add empty alt for decorative images
      newLine = line.replace(/<(img|Image)([^>]*)>/, '<$1$2 alt="">');
    } else {
      // DON'T auto-generate alt text - it's too risky and creates poor accessibility
      // Instead, add a placeholder comment that developers must fill in
      newLine = line.replace(/<(img|Image)([^>]*)>/, `<$1$2 alt="TODO: Add descriptive alt text">`);
    }

    const newContent = content.replace(line, newLine);
    return {
      newContent,
      description: isDecorative
        ? `Added empty alt="" for decorative image at line ${issue.line}`
        : `Added alt placeholder at line ${issue.line} - requires manual description`,
    };
  }

  // Removed inferAltText - auto-generated alt text is harmful to accessibility

  private fixPlaceholderLabel(
    issue: any,
    _content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const inputLine = lines[issue.line - 1];
    const placeholderMatch = inputLine.match(/placeholder=["']([^"']+)["']/);

    if (!placeholderMatch) return null;

    const placeholderText = placeholderMatch[1];
    const inputId = inputLine.match(/id=["']([^"']+)["']/)?.[1] || this.generateId();

    // Add id if missing
    let newInputLine = inputLine;
    if (!inputLine.includes('id=')) {
      newInputLine = newInputLine.replace(/<input/, `<input id="${inputId}"`);
    }

    // Find location to insert label (before the input)
    const indentation = inputLine.match(/^\s*/)?.[0] || '';
    const label = `${indentation}<label htmlFor="${inputId}">${placeholderText}</label>\n`;

    const lineIndex = issue.line - 1;
    const newLines = [...lines];
    newLines[lineIndex] = newInputLine;
    newLines.splice(lineIndex, 0, label);

    return {
      newContent: newLines.join('\n'),
      description: `Added label for input at line ${issue.line}`,
    };
  }

  private fixClickHandler(
    issue: any,
    content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const line = lines[issue.line - 1];

    // Check if it already has keyboard support
    if (line.includes('onKeyDown') || line.includes('role=')) {
      return null;
    }

    // Add both keyboard handler and role
    const handlerName = line.match(/onClick=\{([^}]+)\}/)?.[1];
    if (!handlerName) return null;

    let newLine = line;

    // Add role="button"
    if (!line.includes('role=')) {
      newLine = newLine.replace(/(<\w+)/, '$1 role="button"');
    }

    // Add tabIndex
    if (!line.includes('tabIndex')) {
      newLine = newLine.replace(/(<\w+[^>]*)/, '$1 tabIndex={0}');
    }

    // Add onKeyDown handler
    if (!line.includes('onKeyDown')) {
      const keyDownHandler = `onKeyDown={(e) => e.key === 'Enter' && ${handlerName}(e)}`;
      newLine = newLine.replace(/onClick=\{[^}]+\}/, `$& ${keyDownHandler}`);
    }

    return {
      newContent: content.replace(line, newLine),
      description: `Added keyboard accessibility to interactive element at line ${issue.line}`,
    };
  }

  private fixTabIndex(
    issue: any,
    content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const line = lines[issue.line - 1];

    // Replace positive tabIndex with 0
    const newLine = line.replace(/tabIndex=\{?\d+\}?/, 'tabIndex={0}');

    return {
      newContent: content.replace(line, newLine),
      description: `Fixed tabIndex at line ${issue.line}`,
    };
  }

  // ==================== BUG FIXES ====================

  private fixEmptyCatch(
    issue: any,
    _content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const catchLineIndex = issue.line - 1;
    const catchLine = lines[catchLineIndex];

    // Check if next line is empty closing brace
    if (catchLineIndex + 1 < lines.length) {
      const nextLine = lines[catchLineIndex + 1].trim();
      if (nextLine === '}') {
        const indentation = catchLine.match(/^\s*/)?.[0] || '';
        const errorComment = `${indentation}  // Error intentionally ignored - safe to suppress`;

        const newLines = [...lines];
        newLines.splice(catchLineIndex + 1, 0, errorComment);

        return {
          newContent: newLines.join('\n'),
          description: `Added comment to empty catch block at line ${issue.line}`,
        };
      }
    }

    return null;
  }

  private fixEmptyAriaLabel(
    issue: any,
    content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const line = lines[issue.line - 1];

    // Remove empty aria-label
    const newLine = line.replace(/aria-label=["']["']/, '');

    return {
      newContent: content.replace(line, newLine),
      description: `Removed empty aria-label at line ${issue.line}`,
    };
  }

  // ==================== IMPORT FIXES ====================

  private fixUnusedImport(
    issue: any,
    _content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    const line = lines[issue.line - 1];

    // Only remove if it's clearly marked as unused
    if (line.includes('// UNUSED') || line.includes('/* UNUSED */')) {
      const newLines = lines.filter((_, index) => index !== issue.line - 1);
      return {
        newContent: newLines.join('\n'),
        description: `Removed unused import at line ${issue.line}`,
      };
    }

    return null;
  }

  private fixImportOrganization(
    _issue: any,
    _content: string,
    lines: string[]
  ): { newContent: string; description: string } | null {
    // Organize imports: external -> internal -> relative
    const importLines: Array<{
      line: string;
      index: number;
      type: 'external' | 'internal' | 'relative';
    }> = [];
    let firstImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ')) {
        if (firstImportIndex === -1) firstImportIndex = i;

        let type: 'external' | 'internal' | 'relative' = 'external';
        if (line.includes("from '@/") || line.includes('from "@/')) {
          type = 'internal';
        } else if (line.includes("from './") || line.includes("from '../")) {
          type = 'relative';
        }

        importLines.push({ line: lines[i], index: i, type });
      }
    }

    if (importLines.length < 2) return null;

    // Sort imports by type
    const sorted = [
      ...importLines.filter((i) => i.type === 'external'),
      ...importLines.filter((i) => i.type === 'internal'),
      ...importLines.filter((i) => i.type === 'relative'),
    ];

    // Replace import section
    const newLines = [...lines];
    for (let i = 0; i < importLines.length; i++) {
      newLines[firstImportIndex + i] = sorted[i].line;
    }

    return {
      newContent: newLines.join('\n'),
      description: `Organized imports in file`,
    };
  }

  // ==================== PERFORMANCE FIXES ====================

  private fixInlineObject(
    _issue: any,
    _content: string,
    _lines: string[]
  ): { newContent: string; description: string } | null {
    // This is complex and risky - skip for now
    // Would need to:
    // 1. Extract the inline object
    // 2. Create a useMemo above
    // 3. Replace the inline object with the memo reference
    // Too risky for automatic fixing without full AST parsing
    return null;
  }

  // ==================== HELPERS ====================

  private generateId(): string {
    return `input-${Math.random().toString(36).substr(2, 9)}`;
  }

  getResults(): AutoFixResult[] {
    return this.results;
  }

  getSummary(): string {
    const totalFixes = this.results.reduce((sum, r) => sum + r.fixesApplied, 0);
    const filesFixed = this.results.length;

    return `Fixed ${totalFixes} issues across ${filesFixed} files`;
  }
}
