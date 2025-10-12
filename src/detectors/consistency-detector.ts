import fs from 'fs/promises';
import path from 'path';

export interface ConsistencyIssue {
  file: string;
  line?: number;
  category: string;
  message: string;
  suggestion: string;
  examples?: string[];
}

export class ConsistencyDetector {
  private issues: ConsistencyIssue[] = [];
  private importStyles: Map<string, { absolute: number; relative: number }> = new Map();
  private errorHandlingPatterns: Map<string, number> = new Map();

  async analyzeCodebase(files: string[], fileContents?: Map<string, string>): Promise<ConsistencyIssue[]> {
    this.issues = [];

    // Analyze all files to detect patterns
    for (const file of files.slice(0, 50)) {
      try {
        let content: string;
        if (fileContents?.has(file)) {
          content = fileContents.get(file)!;
        } else {
          content = await fs.readFile(file, 'utf-8');
        }
        await this.collectPatterns(file, content);
      } catch (error) {
        // Skip files we can't read
      }
    }

    // Now detect inconsistencies based on collected patterns
    this.detectImportInconsistencies();
    this.detectErrorHandlingInconsistencies();
    this.detectFileOrganizationIssues(files);

    return this.issues;
  }

  async analyzeFile(file: string, content: string): Promise<void> {
    const lines = content.split('\n');

    this.detectInconsistentNaming(file, lines);
    this.detectInconsistentErrorHandling(file, lines);
    this.detectInconsistentExportPatterns(file, lines);
    this.detectInconsistentAsyncPatterns(file, lines);
    this.detectMagicNumbers(file, lines);
  }

  private async collectPatterns(file: string, content: string): Promise<void> {
    const lines = content.split('\n');

    // Collect import styles
    let absoluteImports = 0;
    let relativeImports = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Import patterns
      if (trimmed.startsWith('import ')) {
        if (trimmed.includes("from '@/") || trimmed.includes('from "@/')) {
          absoluteImports++;
        } else if (trimmed.includes("from './") || trimmed.includes('from "../')) {
          relativeImports++;
        }
      }

      // Error handling patterns
      if (trimmed.includes('try {')) {
        this.errorHandlingPatterns.set('try-catch', (this.errorHandlingPatterns.get('try-catch') || 0) + 1);
      }
      if (trimmed.includes('.catch(')) {
        this.errorHandlingPatterns.set('.catch', (this.errorHandlingPatterns.get('.catch') || 0) + 1);
      }
    }

    if (absoluteImports + relativeImports > 0) {
      this.importStyles.set(file, { absolute: absoluteImports, relative: relativeImports });
    }
  }

  private detectImportInconsistencies(): void {
    const totalAbsolute = Array.from(this.importStyles.values()).reduce(
      (sum, style) => sum + style.absolute,
      0
    );
    const totalRelative = Array.from(this.importStyles.values()).reduce(
      (sum, style) => sum + style.relative,
      0
    );

    // Determine dominant pattern
    const dominantPattern = totalAbsolute > totalRelative ? 'absolute' : 'relative';
    const threshold = 0.3; // 30% inconsistency threshold

    this.importStyles.forEach((style, file) => {
      const total = style.absolute + style.relative;
      if (total < 3) return; // Skip files with very few imports

      const inconsistentRatio =
        dominantPattern === 'absolute' ? style.relative / total : style.absolute / total;

      if (inconsistentRatio > threshold) {
        this.issues.push({
          file,
          category: 'Import Consistency',
          message: `Mixes ${style.absolute} absolute and ${style.relative} relative imports`,
          suggestion: `Codebase predominantly uses ${dominantPattern} imports (@/ paths)`,
        });
      }
    });
  }

  private detectErrorHandlingInconsistencies(): void {
    const total = Array.from(this.errorHandlingPatterns.values()).reduce((sum, count) => sum + count, 0);
    if (total === 0) return;

    const tryCatchCount = this.errorHandlingPatterns.get('try-catch') || 0;
    const catchCount = this.errorHandlingPatterns.get('.catch') || 0;

    const tryCatchRatio = tryCatchCount / total;
    const catchRatio = catchCount / total;

    if (tryCatchRatio > 0.2 && catchRatio > 0.2) {
      this.issues.push({
        file: 'Codebase-wide',
        category: 'Error Handling',
        message: `Mixed error handling: ${tryCatchCount} try-catch vs ${catchCount} .catch()`,
        suggestion: 'Standardize on async/await with try-catch for consistency',
      });
    }
  }

  private detectInconsistentNaming(file: string, lines: string[]): void {
    const functionNames: string[] = [];
    const variableNames: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract function names
      const funcMatch = line.match(/function\s+(\w+)/);
      if (funcMatch) functionNames.push(funcMatch[1]);

      const arrowFuncMatch = line.match(/const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
      if (arrowFuncMatch) functionNames.push(arrowFuncMatch[1]);

      // Extract variable names
      const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);
      if (varMatch && !arrowFuncMatch) variableNames.push(varMatch[1]);
    }

    // Check naming conventions
    const camelCaseFunctions = functionNames.filter((name) => /^[a-z][a-zA-Z0-9]*$/.test(name));
    const pascalCaseFunctions = functionNames.filter((name) => /^[A-Z][a-zA-Z0-9]*$/.test(name));

    if (
      camelCaseFunctions.length > 3 &&
      pascalCaseFunctions.length > 0 &&
      !file.includes('component')
    ) {
      this.issues.push({
        file,
        category: 'Naming Consistency',
        message: 'Mixes camelCase and PascalCase function names',
        suggestion: 'Use camelCase for functions, PascalCase for components/classes',
        examples: pascalCaseFunctions.slice(0, 3),
      });
    }
  }

  private detectInconsistentErrorHandling(file: string, lines: string[]): void {
    let tryCatchCount = 0;
    let dotCatchCount = 0;

    for (const line of lines) {
      if (line.includes('try {')) tryCatchCount++;
      if (line.includes('.catch(')) dotCatchCount++;
    }

    if (tryCatchCount > 0 && dotCatchCount > 0 && tryCatchCount + dotCatchCount > 5) {
      this.issues.push({
        file,
        category: 'Error Handling',
        message: `Mixes try-catch (${tryCatchCount}) and .catch() (${dotCatchCount}) patterns`,
        suggestion: 'Standardize on async/await with try-catch for better readability',
      });
    }
  }

  private detectInconsistentExportPatterns(file: string, lines: string[]): void {
    let defaultExports = 0;
    let namedExports = 0;

    for (const line of lines) {
      if (line.trim().startsWith('export default')) defaultExports++;
      if (line.trim().match(/^export (const|function|class|interface|type)/)) namedExports++;
    }

    // Pages should have default exports, utilities should use named
    const isPage =
      (file.includes('/pages/') || file.includes('/app/')) && file.endsWith('page.tsx');
    const isUtil = file.includes('/lib/') || file.includes('/utils/');

    if (isPage && defaultExports === 0 && namedExports > 0) {
      this.issues.push({
        file,
        category: 'Export Patterns',
        message: 'Page component should use default export',
        suggestion: 'Next.js pages require default export',
      });
    }

    if (isUtil && defaultExports > 0 && namedExports === 0) {
      this.issues.push({
        file,
        category: 'Export Patterns',
        message: 'Utility module uses default export',
        suggestion: 'Prefer named exports for utilities for better tree-shaking',
      });
    }
  }

  private detectInconsistentAsyncPatterns(file: string, lines: string[]): void {
    let asyncAwaitCount = 0;
    let thenChainCount = 0;

    for (const line of lines) {
      if (line.includes('async ') || line.includes('await ')) asyncAwaitCount++;
      if (line.includes('.then(')) thenChainCount++;
    }

    if (asyncAwaitCount > 3 && thenChainCount > 2) {
      this.issues.push({
        file,
        category: 'Async Patterns',
        message: 'Mixes async/await and Promise chains',
        suggestion: 'Prefer async/await for better readability and error handling',
      });
    }
  }

  private detectMagicNumbers(file: string, lines: string[]): void {
    // Skip marketing/content pages - they're full of layout numbers which is fine
    // False positive pattern #13: SVG files contain coordinates/dimensions that shouldn't be extracted to constants
    // This eliminates 1,000+ false positives (22% of all noise)
    if (
      file.includes('/marketing/') ||
      file.includes('page.tsx') ||
      file.includes('layout.tsx') ||
      file.endsWith('.svg') ||
      file.includes('/icons/') ||
      file.includes('/svg/')
    ) {
      return;
    }

    const magicNumbers: Array<{ line: number; value: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments, imports, JSX className attributes, and SVG-like attributes
      // False positive fix: SVG coordinates in JSX (viewBox, width, height, d, x, y, etc.)
      if (
        line.trim().startsWith('//') ||
        line.trim().startsWith('/*') ||
        line.includes('import ') ||
        line.includes('className=') ||
        line.includes('viewBox=') ||
        line.includes('width=') ||
        line.includes('height=') ||
        line.includes('<path') ||
        line.includes('<svg') ||
        line.includes('d="M')
      ) {
        continue;
      }

      // Find numeric literals (excluding common values)
      const numberMatches = line.match(/\b(\d+)\b/g);
      if (numberMatches) {
        for (const match of numberMatches) {
          const num = parseInt(match);

          // Skip common acceptable values
          if (
            num === 0 ||
            num === 1 ||
            num === 2 ||
            num === -1 ||
            num === 100 ||
            num === 1000 ||
            line.includes('useState') ||
            line.includes('setTimeout') ||
            line.includes('slice(') ||
            line.includes('Array(')
          ) {
            continue;
          }

          // Flag suspicious magic numbers
          if (num > 10 && !line.includes('//') && !line.includes('const ')) {
            magicNumbers.push({ line: i + 1, value: match });
          }
        }
      }
    }

    // Increase threshold - only flag if there are MANY magic numbers
    if (magicNumbers.length > 15) {
      this.issues.push({
        file,
        category: 'Code Quality',
        message: `${magicNumbers.length} magic numbers found`,
        suggestion: 'Extract magic numbers to named constants for clarity',
        examples: magicNumbers.slice(0, 3).map((m) => `Line ${m.line}: ${m.value}`),
      });
    }
  }

  private detectFileOrganizationIssues(files: string[]): void {
    const directories = new Map<string, string[]>();

    // Group files by directory
    for (const file of files) {
      const dir = path.dirname(file);
      if (!directories.has(dir)) {
        directories.set(dir, []);
      }
      directories.get(dir)!.push(file);
    }

    // Check for organizational issues
    directories.forEach((dirFiles, dir) => {
      // Too many files in one directory (but be lenient - components/ and utils/ are OK to be large)
      // Only flag if there are WAY too many files (50+)
      if (dirFiles.length > 50 && !dir.includes('node_modules')) {
        this.issues.push({
          file: dir,
          category: 'File Organization',
          message: `${dirFiles.length} files in single directory`,
          suggestion: 'Consider organizing into subdirectories by feature/domain',
        });
      }

      // Mixed file types (utils + components in same dir)
      const hasComponents = dirFiles.some(
        (f) => f.includes('component') || f.endsWith('.tsx') && !f.includes('util')
      );
      const hasUtils = dirFiles.some((f) => f.includes('util') || f.includes('helper'));

      if (hasComponents && hasUtils && dirFiles.length > 5) {
        this.issues.push({
          file: dir,
          category: 'File Organization',
          message: 'Directory mixes components and utilities',
          suggestion: 'Separate components and utilities into different directories',
        });
      }
    });
  }

  getIssues(): ConsistencyIssue[] {
    return this.issues;
  }

  getIssuesByCategory(): Record<string, ConsistencyIssue[]> {
    return this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, ConsistencyIssue[]>
    );
  }
}
