export interface ImportIssue {
  file: string;
  line: number;
  category: string;
  message: string;
  suggestion: string;
}

export class ImportDetector {
  private issues: ImportIssue[] = [];

  async analyze(file: string, content: string): Promise<ImportIssue[]> {
    this.issues = [];

    const lines = content.split('\n');

    this.detectUnusedImports(file, lines, content);
    // DISABLED: Import organization is a stylistic preference, not a health issue
    // False positive pattern #11: Flagging import order creates 1,200+ noise issues (93% of import detector output)
    // this.detectImportOrganization(file, lines);
    this.detectCircularDependencies(file, lines);
    this.detectDuplicateImports(file, lines);
    this.detectHeavyImports(file, lines);

    return this.issues;
  }

  private detectUnusedImports(file: string, lines: string[], content: string): void {
    const imports: Array<{ line: number; symbols: string[]; source: string }> = [];

    // Extract all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('import ') && !line.includes('import type')) {
        const symbols: string[] = [];

        // Named imports: import { foo, bar } from 'baz'
        // Also handle aliased imports: import { foo as bar } - we need to check for 'bar' usage
        const namedMatch = line.match(/import\s+\{([^}]+)\}\s+from/);
        if (namedMatch) {
          const namedImports = namedMatch[1]
            .split(',')
            .map((s) => {
              const parts = s.trim().split(' as ');
              // If aliased, use the alias name; otherwise use the import name
              return parts.length > 1 ? parts[1].trim() : parts[0].trim();
            });
          symbols.push(...namedImports);
        }

        // Default import: import foo from 'bar'
        const defaultMatch = line.match(/import\s+(\w+)\s+from/);
        if (defaultMatch && !line.includes('{')) {
          symbols.push(defaultMatch[1]);
        }

        // Namespace import: import * as foo from 'bar'
        const namespaceMatch = line.match(/import\s+\*\s+as\s+(\w+)/);
        if (namespaceMatch) {
          symbols.push(namespaceMatch[1]);
        }

        const sourceMatch = line.match(/from\s+['"]([^'"]+)['"]/);
        const source = sourceMatch ? sourceMatch[1] : '';

        if (symbols.length > 0) {
          imports.push({ line: i + 1, symbols, source });
        }
      }
    }

    // Check usage of each imported symbol
    for (const { line, symbols, source } of imports) {
      const unusedSymbols: string[] = [];

      for (const symbol of symbols) {
        // Create a regex to find usage of this symbol
        // Exclude the import line itself
        const usageRegex = new RegExp(`\\b${symbol}\\b(?!.*from)`, 'g');
        const contentWithoutImports = content
          .split('\n')
          .filter((_, idx) => idx + 1 !== line)
          .join('\n');

        const matches = contentWithoutImports.match(usageRegex);
        const usageCount = matches ? matches.length : 0;

        // Symbol is unused if it appears only in the import
        // BUT: Check for common patterns like Redis.fromEnv(), Class.method()
        const staticMethodPattern = new RegExp(`\\b${symbol}\\.(fromEnv|create|init|from)\\(`);
        const hasStaticMethod = staticMethodPattern.test(contentWithoutImports);

        if (usageCount === 0 && !hasStaticMethod) {
          unusedSymbols.push(symbol);
        }
      }

      if (unusedSymbols.length > 0) {
        // Only report if all symbols from this import are unused
        if (unusedSymbols.length === symbols.length) {
          this.issues.push({
            file,
            line,
            category: 'Unused Imports',
            message: `Unused import: ${unusedSymbols.join(', ')}`,
            suggestion: `Remove unused import from '${source}'`,
          });
        } else if (unusedSymbols.length > 0) {
          this.issues.push({
            file,
            line,
            category: 'Unused Imports',
            message: `Unused symbols in import: ${unusedSymbols.join(', ')}`,
            suggestion: `Remove unused symbols from import`,
          });
        }
      }
    }
  }

  private detectImportOrganization(file: string, lines: string[]): void {
    const importLines: Array<{ line: number; content: string; type: string }> = [];

    // Collect all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('import ')) {
        let type = 'external';

        if (line.includes("from './") || line.includes('from "../')) {
          type = 'relative';
        } else if (line.includes("from '@/")) {
          type = 'absolute';
        } else if (line.includes('import type')) {
          type = 'type';
        }

        importLines.push({ line: i + 1, content: line, type });
      } else if (line && !line.startsWith('//') && importLines.length > 0) {
        // Stop collecting after first non-import, non-comment line
        break;
      }
    }

    if (importLines.length < 3) return; // Too few imports to organize

    // Check if imports are grouped by type
    let lastType = '';
    let typeChanges = 0;
    const typeOrder: string[] = [];

    for (const { type } of importLines) {
      if (type !== lastType) {
        typeChanges++;
        typeOrder.push(type);
        lastType = type;
      }
    }

    // If imports switch back and forth between types, they're poorly organized
    const uniqueTypes = new Set(typeOrder);
    if (typeChanges > uniqueTypes.size * 1.5 && importLines.length > 5) {
      this.issues.push({
        file,
        line: importLines[0].line,
        category: 'Import Organization',
        message: 'Imports are not grouped by type',
        suggestion: 'Group imports: external → absolute (@/) → relative (./)',
      });
    }

    // Check if imports are sorted within groups
    for (let i = 1; i < importLines.length; i++) {
      const prev = importLines[i - 1];
      const curr = importLines[i];

      if (prev.type === curr.type) {
        const prevSource = prev.content.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '';
        const currSource = curr.content.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '';

        if (prevSource && currSource && prevSource > currSource) {
          this.issues.push({
            file,
            line: curr.line,
            category: 'Import Organization',
            message: 'Imports not sorted alphabetically within group',
            suggestion: 'Sort imports alphabetically within each group for consistency',
          });
          break; // Only report once per file
        }
      }
    }
  }

  private detectCircularDependencies(file: string, lines: string[]): void {
    const imports = new Set<string>();

    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        const match = line.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          const importPath = match[1];
          // Convert relative imports to absolute for comparison
          if (importPath.startsWith('.')) {
            imports.add(importPath);
          }
        }
      }
    }

    // Simple heuristic: if a file imports from a nearby file, check for potential circularity
    // This is a simplified check - full circular dependency detection requires graph analysis
    const fileName = file.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || '';

    for (const importPath of imports) {
      if (importPath.includes(fileName) && importPath.startsWith('.')) {
        this.issues.push({
          file,
          line: 1,
          category: 'Circular Dependencies',
          message: 'Potential circular dependency detected',
          suggestion: 'Review import structure to avoid circular dependencies',
        });
      }
    }
  }

  private detectDuplicateImports(file: string, lines: string[]): void {
    const importSources = new Map<string, Array<{ line: number; isType: boolean }>>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('import ')) {
        const match = line.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          const source = match[1];
          const isTypeImport = line.includes('import type');

          if (!importSources.has(source)) {
            importSources.set(source, []);
          }
          importSources.get(source)!.push({ line: i + 1, isType: isTypeImport });
        }
      }
    }

    // Check for duplicate imports from same source
    // BUT: type imports and value imports from same source are OK
    importSources.forEach((imports, source) => {
      const valueImports = imports.filter((imp) => !imp.isType);
      const typeImports = imports.filter((imp) => imp.isType);

      // Only flag if multiple VALUE imports or multiple TYPE imports from same source
      if (valueImports.length > 1) {
        this.issues.push({
          file,
          line: valueImports[1].line,
          category: 'Duplicate Imports',
          message: `Multiple value imports from '${source}'`,
          suggestion: 'Combine value imports from same source into single statement',
        });
      }
      if (typeImports.length > 1) {
        this.issues.push({
          file,
          line: typeImports[1].line,
          category: 'Duplicate Imports',
          message: `Multiple type imports from '${source}'`,
          suggestion: 'Combine type imports from same source into single statement',
        });
      }
    });
  }

  private detectHeavyImports(file: string, lines: string[]): void {
    // Skip for component files where heavy libraries might be necessary
    if (file.includes('/app/') || file.startsWith('app/') || file.includes('/pages/') || file.startsWith('pages/')) return;

    const heavyLibraries = [
      { name: 'lodash', alternative: 'Use native array methods or import specific functions' },
      { name: 'moment', alternative: 'Use date-fns or native Intl API' },
      { name: 'axios', alternative: 'Use native fetch API' },
      { name: 'jquery', alternative: 'Use native DOM methods or React' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('import ')) {
        for (const { name, alternative } of heavyLibraries) {
          if (line.includes(`'${name}'`) || line.includes(`"${name}"`)) {
            // Check if importing entire library vs specific function
            const isFullImport =
              line.includes(`import ${name}`) ||
              line.includes(`import * as ${name}`) ||
              !line.includes('{');

            if (isFullImport) {
              this.issues.push({
                file,
                line: i + 1,
                category: 'Heavy Imports',
                message: `Importing entire '${name}' library`,
                suggestion: alternative,
              });
            }
          }
        }

        // Check for barrel imports (importing from index)
        if (
          (line.includes("from './index'") || line.includes('from "../index"')) &&
          line.includes('{')
        ) {
          const symbolCount = (line.match(/,/g) || []).length + 1;
          if (symbolCount > 5) {
            this.issues.push({
              file,
              line: i + 1,
              category: 'Heavy Imports',
              message: 'Large barrel import may import unnecessary code',
              suggestion: 'Import directly from source files for better tree-shaking',
            });
          }
        }
      }
    }
  }

  getIssues(): ImportIssue[] {
    return this.issues;
  }

  getIssuesByCategory(): Record<string, ImportIssue[]> {
    return this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, ImportIssue[]>
    );
  }
}
